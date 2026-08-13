from __future__ import annotations

import logging
import threading
import time
from pathlib import Path
from typing import Any

from .config import Settings
from .acoustics import analyze_acoustics
from .phonemes import request_phoneme_alignment
from .schemas import TimedWord, TranscriptionResponse

logger = logging.getLogger("voiceact.speech")


class SpeechEngineError(RuntimeError):
    """Raised when inference cannot produce a useful timed transcript."""


class SpeechEngine:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._model: Any | None = None
        self._align_models: dict[str, tuple[Any, Any]] = {}
        self._load_lock = threading.Lock()
        self._inference_lock = threading.Lock()
        self.load_error: str | None = None
        self.aligner_error: str | None = None

    @property
    def model_loaded(self) -> bool:
        return self._model is not None

    @property
    def aligner_loaded(self) -> bool:
        return bool(self._align_models)

    def _load_model(self) -> Any:
        if self._model is not None:
            return self._model

        with self._load_lock:
            if self._model is not None:
                return self._model
            try:
                from faster_whisper import WhisperModel

                logger.info(
                    "Loading faster-whisper model=%s device=%s compute=%s",
                    self.settings.model_size,
                    self.settings.device,
                    self.settings.compute_type,
                )
                self._model = WhisperModel(
                    self.settings.model_size,
                    device=self.settings.device,
                    compute_type=self.settings.compute_type,
                )
                self.load_error = None
            except Exception as exc:  # dependency/model failures must surface in readiness
                self.load_error = f"{type(exc).__name__}: {exc}"
                logger.exception("Unable to load the speech model")
                raise SpeechEngineError("Le modèle de transcription n'a pas pu être chargé.") from exc
        return self._model

    def preload(self) -> None:
        self._load_model()
        if self.settings.alignment_mode in {"whisperx", "required"}:
            try:
                self._load_align_model(self.settings.default_language)
            except Exception as exc:
                if self.settings.alignment_mode == "required":
                    raise SpeechEngineError("Le modèle d'alignement WhisperX n'a pas pu être préchargé.") from exc
                logger.warning("WhisperX could not be preloaded; faster-whisper remains ready: %s", exc)

    def _load_align_model(self, language: str) -> tuple[Any, Any]:
        if language in self._align_models:
            return self._align_models[language]

        try:
            import whisperx

            with self._load_lock:
                if language not in self._align_models:
                    model_a, metadata = whisperx.load_align_model(
                        language_code=language,
                        device=self.settings.device,
                    )
                    self._align_models[language] = (model_a, metadata)
            self.aligner_error = None
            return self._align_models[language]
        except Exception as exc:
            self.aligner_error = f"{type(exc).__name__}: {exc}"
            raise

    def _whisperx_align(
        self,
        path: Path,
        language: str,
        raw_segments: list[dict[str, Any]],
    ) -> list[TimedWord]:
        import whisperx

        model_a, metadata = self._load_align_model(language)
        audio = whisperx.load_audio(str(path))
        aligned = whisperx.align(
            raw_segments,
            model_a,
            metadata,
            audio,
            self.settings.device,
            return_char_alignments=False,
        )

        words: list[TimedWord] = []
        for item in aligned.get("word_segments", []):
            word = str(item.get("word", "")).strip()
            start, end = item.get("start"), item.get("end")
            if not word or not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
                continue
            if end < start:
                continue
            score = item.get("score")
            confidence = float(score) if isinstance(score, (int, float)) else None
            words.append(TimedWord(word=word, start=float(start), end=float(end), confidence=confidence))
        return words

    def transcribe(
        self,
        path: Path,
        language: str | None = None,
        expected_text: str | None = None,
    ) -> TranscriptionResponse:
        started = time.perf_counter()
        language_hint = (language or self.settings.default_language).strip().lower()

        # CTranslate2 models are not assumed thread-safe. HTTP concurrency is bounded too,
        # but this lock protects direct/internal calls to the engine.
        with self._inference_lock:
            model = self._load_model()
            segments_iter, info = model.transcribe(
                str(path),
                language=language_hint or None,
                beam_size=self.settings.beam_size,
                word_timestamps=True,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 300},
                condition_on_previous_text=False,
            )
            segments = list(segments_iter)

            raw_segments: list[dict[str, Any]] = []
            fallback_words: list[TimedWord] = []
            text_parts: list[str] = []
            for segment in segments:
                clean_text = segment.text.strip()
                if clean_text:
                    text_parts.append(clean_text)
                    raw_segments.append(
                        {"start": float(segment.start), "end": float(segment.end), "text": clean_text}
                    )
                for word in segment.words or []:
                    clean_word = word.word.strip()
                    if not clean_word or word.end < word.start:
                        continue
                    probability = getattr(word, "probability", None)
                    fallback_words.append(
                        TimedWord(
                            word=clean_word,
                            start=float(word.start),
                            end=float(word.end),
                            confidence=float(probability) if isinstance(probability, (int, float)) else None,
                        )
                    )

            text = " ".join(text_parts).strip()
            if not text or not fallback_words:
                raise SpeechEngineError("Aucune parole suffisamment claire n'a été détectée.")

            words = fallback_words
            alignment = "faster-whisper"
            if self.settings.alignment_mode in {"whisperx", "required"} and raw_segments:
                try:
                    aligned_words = self._whisperx_align(path, info.language or language_hint, raw_segments)
                    if aligned_words:
                        words = aligned_words
                        alignment = "whisperx"
                    elif self.settings.alignment_mode == "required":
                        raise SpeechEngineError("WhisperX n'a produit aucun horodatage exploitable.")
                except Exception as exc:
                    if self.settings.alignment_mode == "required":
                        raise SpeechEngineError("L'alignement précis WhisperX a échoué.") from exc
                    logger.warning("WhisperX unavailable; using faster-whisper timestamps: %s", exc)

        duration = float(getattr(info, "duration", 0) or 0) or max(word.end for word in words)
        acoustics = None
        try:
            acoustics = analyze_acoustics(path)
        except Exception as exc:
            # Transcription remains useful, but clients will refuse to validate prosody
            # when this explicit acoustic payload is absent.
            logger.warning("Praat acoustic analysis unavailable for %s: %s", path.name, exc)
        phoneme_alignment = None
        phoneme_alignment_error = None
        if expected_text:
            try:
                phoneme_alignment = request_phoneme_alignment(path, expected_text, self.settings)
                if phoneme_alignment is None:
                    phoneme_alignment_error = "Le service d'alignement phonémique n'est pas configuré."
            except Exception as exc:
                phoneme_alignment_error = f"{type(exc).__name__}: {exc}"
                logger.warning("MFA phoneme alignment unavailable for %s: %s", path.name, exc)
        processing_ms = round((time.perf_counter() - started) * 1000)
        return TranscriptionResponse(
            text=text,
            language=getattr(info, "language", None) or language_hint,
            duration=duration,
            words=words,
            model=self.settings.model_size,
            alignment=alignment,
            processingMs=processing_ms,
            acoustics=acoustics,
            phonemeAlignment=phoneme_alignment,
            phonemeAlignmentError=phoneme_alignment_error,
        )
