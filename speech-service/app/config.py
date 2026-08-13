from __future__ import annotations

import os
from dataclasses import dataclass


def _boolean(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _integer(name: str, default: int, minimum: int = 1) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return max(minimum, int(raw))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    model_size: str
    device: str
    compute_type: str
    alignment_mode: str
    max_upload_mb: int
    max_concurrency: int
    preload_model: bool
    internal_token: str | None
    default_language: str
    beam_size: int
    phoneme_service_url: str | None = None
    phoneme_service_token: str | None = None
    phoneme_timeout_seconds: int = 12

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


def load_settings() -> Settings:
    alignment_mode = os.getenv("VOICEACT_ALIGNMENT", "off").strip().lower()
    if alignment_mode not in {"off", "mfa", "whisperx", "required"}:
        alignment_mode = "whisperx"

    token = os.getenv("VOICEACT_INTERNAL_TOKEN", "").strip()
    phoneme_url = os.getenv("VOICEACT_PHONEME_SERVICE_URL", "").strip().rstrip("/")
    phoneme_token = os.getenv("VOICEACT_PHONEME_SERVICE_TOKEN", "").strip()
    return Settings(
        model_size=os.getenv("VOICEACT_MODEL_SIZE", "small").strip(),
        device=os.getenv("VOICEACT_DEVICE", "cpu").strip().lower(),
        compute_type=os.getenv("VOICEACT_COMPUTE_TYPE", "int8").strip().lower(),
        alignment_mode=alignment_mode,
        max_upload_mb=_integer("VOICEACT_MAX_UPLOAD_MB", 24),
        max_concurrency=_integer("VOICEACT_MAX_CONCURRENCY", 1),
        preload_model=_boolean("VOICEACT_PRELOAD_MODEL", False),
        internal_token=token or None,
        default_language=os.getenv("VOICEACT_DEFAULT_LANGUAGE", "fr").strip().lower(),
        beam_size=_integer("VOICEACT_BEAM_SIZE", 5),
        phoneme_service_url=phoneme_url or None,
        phoneme_service_token=phoneme_token or None,
        phoneme_timeout_seconds=_integer("VOICEACT_PHONEME_TIMEOUT_SECONDS", 12, 2),
    )
