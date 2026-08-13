from __future__ import annotations

import os
import secrets
import subprocess
import tempfile
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

from .confidence import attach_phone_goodness
from .textgrid_parser import alignment_payload

MFA_ROOT = os.getenv("MFA_ROOT_DIR", "/models")
INTERNAL_TOKEN = os.getenv("VOICEACT_INTERNAL_TOKEN", "").strip() or None
ACOUSTIC_MODEL = os.getenv("VOICEACT_MFA_ACOUSTIC_MODEL", "french_mfa")
DICTIONARY_MODEL = os.getenv("VOICEACT_MFA_DICTIONARY_MODEL", "french_mfa")
MFA_ALIGNMENT_TIMEOUT_SECONDS = max(60, min(900, int(os.getenv("VOICEACT_MFA_ALIGNMENT_TIMEOUT_SECONDS", "480"))))
G2P_MODEL = os.getenv("VOICEACT_MFA_G2P_MODEL", "french_mfa")
MAX_AUDIO_BYTES = 24 * 1024 * 1024

app = FastAPI(title="VoiceAct MFA Service", version="1.0.0", docs_url=None, redoc_url=None)


def require_token(value: str | None) -> None:
    if INTERNAL_TOKEN and (value is None or not secrets.compare_digest(value, INTERNAL_TOKEN)):
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health/ready")
def health_ready():
    try:
        return {"status": "ready", "engine": "montreal-forced-aligner", "version": mfa_version()}
    except (OSError, subprocess.SubprocessError) as exc:
        raise HTTPException(status_code=503, detail=f"MFA unavailable: {exc}") from exc


@lru_cache(maxsize=1)
def mfa_version() -> str:
    result = subprocess.run(["mfa", "version"], capture_output=True, text=True, timeout=15, check=True)
    return result.stdout.strip()


@app.post("/v1/alignments")
async def align(
    audio: UploadFile = File(...),
    expected_text: str = Form(...),
    x_voiceact_internal_token: str | None = Header(default=None),
):
    require_token(x_voiceact_internal_token)
    expected_text = " ".join(expected_text.split()).strip()
    if not expected_text or len(expected_text) > 2_000:
        raise HTTPException(status_code=400, detail="expected_text must contain 1 to 2000 characters")
    payload = await audio.read(MAX_AUDIO_BYTES + 1)
    await audio.close()
    if len(payload) < 512 or len(payload) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="invalid audio size")

    with tempfile.TemporaryDirectory(prefix="voiceact-mfa-") as directory:
        root = Path(directory)
        corpus = root / "corpus"
        aligned = root / "aligned"
        corpus.mkdir()
        aligned.mkdir()
        source = root / "source.audio"
        wav = corpus / "take.wav"
        transcript = corpus / "take.txt"
        output = aligned / "take.TextGrid"
        temporary = root / "mfa-work"
        config = root / "phone-confidence.yaml"
        source.write_bytes(payload)
        transcript.write_text(expected_text, encoding="utf-8")
        config.write_text("phone_confidence: true\n", encoding="utf-8")

        try:
            subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-i", str(source), "-ac", "1", "-ar", "16000", str(wav)],
                capture_output=True,
                text=True,
                timeout=60,
                check=True,
            )
            command = [
                "mfa", "align", str(corpus), DICTIONARY_MODEL, ACOUSTIC_MODEL,
                str(aligned), "--output_format", "long_textgrid",
                "--g2p_model_path", G2P_MODEL, "--config_path", str(config),
                "--temporary_directory", str(temporary), "--no_final_clean",
                "--single_speaker", "--no_use_mp", "--quiet", "--clean", "--overwrite",
            ]
            subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=MFA_ALIGNMENT_TIMEOUT_SECONDS,
                check=True,
                env={
                    **os.environ,
                    "MFA_ROOT_DIR": MFA_ROOT,
                    "PYTHONPATH": os.pathsep.join(
                        part
                        for part in (
                            str(Path(__file__).resolve().parent),
                            os.environ.get("PYTHONPATH", ""),
                        )
                        if part
                    ),
                    "VOICEACT_MFA_PHONE_CONFIDENCE": "1",
                },
            )
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(status_code=504, detail="phoneme alignment timed out") from exc
        except subprocess.CalledProcessError as exc:
            message = (exc.stderr or exc.stdout or "MFA alignment failed")[-1_000:]
            raise HTTPException(status_code=422, detail=message) from exc

        if not output.exists():
            raise HTTPException(status_code=422, detail="MFA did not produce a TextGrid")
        words, phones = alignment_payload(output.read_text(encoding="utf-8"))
        if not phones:
            raise HTTPException(status_code=422, detail="MFA did not produce phoneme intervals")
        phones, confidence_coverage = attach_phone_goodness(root, phones)
        can_score = confidence_coverage >= 0.7
        return {
            "source": "montreal-forced-aligner",
            "model": ACOUSTIC_MODEL,
            "language": "fr",
            "status": "aligned",
            "scoreKind": "mfa-phone-confidence" if can_score else "alignment-only",
            "scoringVersion": "mfa-phone-goodness-v1",
            "canScorePronunciation": can_score,
            "confidenceCoverage": confidence_coverage,
            "scoringReason": (
                "Marge acoustique MFA disponible pour la majorité des phonèmes."
                if can_score
                else "L'alignement localise les sons, mais MFA n'a pas fourni assez de confiance acoustique."
            ),
            "words": words,
            "phones": phones,
        }
