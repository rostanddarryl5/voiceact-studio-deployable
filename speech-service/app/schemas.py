from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TimedWord(BaseModel):
    word: str
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    confidence: float | None = Field(default=None, ge=0, le=1)


class AcousticFrameResponse(BaseModel):
    time: float = Field(ge=0)
    pitchHz: float | None = Field(default=None, ge=0)
    intensityDb: float | None = None


class AcousticMetricsResponse(BaseModel):
    source: Literal["praat-parselmouth"] = "praat-parselmouth"
    quality: Literal["high", "limited"]
    sampleRate: int = Field(gt=0)
    frameStepMs: int = Field(gt=0)
    pitchMedianHz: float | None = Field(default=None, ge=0)
    pitchP10Hz: float | None = Field(default=None, ge=0)
    pitchP90Hz: float | None = Field(default=None, ge=0)
    pitchRangeSemitones: float = Field(ge=0)
    voicedRatio: float = Field(ge=0, le=1)
    intensityMeanDb: float | None = None
    intensityRangeDb: float = Field(ge=0)
    hnrMeanDb: float | None = None
    frames: list[AcousticFrameResponse]


class PhonemeInterval(BaseModel):
    phone: str
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    durationMs: int = Field(ge=0)
    wordIndex: int | None = Field(default=None, ge=0)
    phoneGoodness: float | None = Field(default=None, ge=0)


class PhonemeWordInterval(BaseModel):
    word: str
    start: float = Field(ge=0)
    end: float = Field(ge=0)


class PhonemeAlignmentResponse(BaseModel):
    source: Literal["montreal-forced-aligner"]
    model: str
    language: str
    status: Literal["aligned"]
    scoreKind: Literal["alignment-only", "mfa-phone-confidence"] = "alignment-only"
    scoringVersion: str = "mfa-boundaries-v1"
    canScorePronunciation: bool = False
    confidenceCoverage: float = Field(default=0, ge=0, le=1)
    scoringReason: str
    words: list[PhonemeWordInterval]
    phones: list[PhonemeInterval]


class TranscriptionResponse(BaseModel):
    text: str
    language: str | None
    duration: float | None
    words: list[TimedWord]
    provider: Literal["voiceact-local"] = "voiceact-local"
    model: str
    alignment: Literal["faster-whisper", "whisperx"]
    processingMs: int = Field(ge=0)
    acoustics: AcousticMetricsResponse | None = None
    phonemeAlignment: PhonemeAlignmentResponse | None = None
    phonemeAlignmentError: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok", "ready", "degraded"]
    model: str
    device: str
    computeType: str
    alignmentMode: str
    modelLoaded: bool
    alignerLoaded: bool
    phonemeServiceConfigured: bool
    loadError: str | None = None
    alignerError: str | None = None


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody
