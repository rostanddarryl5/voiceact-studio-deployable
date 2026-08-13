from __future__ import annotations

from pathlib import Path

import httpx

from .config import Settings
from .schemas import PhonemeAlignmentResponse


def request_phoneme_alignment(
    path: Path,
    expected_text: str,
    settings: Settings,
) -> PhonemeAlignmentResponse | None:
    if not settings.phoneme_service_url:
        return None
    headers = (
        {"X-VoiceAct-Internal-Token": settings.phoneme_service_token}
        if settings.phoneme_service_token
        else None
    )
    with path.open("rb") as audio:
        response = httpx.post(
            f"{settings.phoneme_service_url}/v1/alignments",
            headers=headers,
            data={"expected_text": expected_text},
            files={"audio": (path.name, audio, "application/octet-stream")},
            timeout=settings.phoneme_timeout_seconds,
        )
    response.raise_for_status()
    return PhonemeAlignmentResponse.model_validate(response.json())
