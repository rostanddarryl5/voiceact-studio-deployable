from __future__ import annotations

import asyncio
import logging
import secrets
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from .config import load_settings
from .engine import SpeechEngine, SpeechEngineError
from .schemas import ErrorResponse, HealthResponse, TranscriptionResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
settings = load_settings()
engine = SpeechEngine(settings)
inference_slots = asyncio.Semaphore(settings.max_concurrency)

SUPPORTED_CONTENT_TYPES = {
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/m4a": ".m4a",
}


def error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


def require_internal_token(x_voiceact_internal_token: str | None = Header(default=None)) -> None:
    expected = settings.internal_token
    if expected is None:
        return
    if x_voiceact_internal_token is None or not secrets.compare_digest(x_voiceact_internal_token, expected):
        raise error(401, "UNAUTHORIZED", "Le service vocal a refusé cette requête.")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.preload_model:
        await run_in_threadpool(engine.preload)
    yield


app = FastAPI(
    title="VoiceAct Speech Service",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "HTTP_ERROR", "message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content={"error": detail})


@app.get("/health/live", response_model=HealthResponse)
async def health_live() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model=settings.model_size,
        device=settings.device,
        computeType=settings.compute_type,
        alignmentMode=settings.alignment_mode,
        modelLoaded=engine.model_loaded,
        alignerLoaded=engine.aligner_loaded,
        phonemeServiceConfigured=settings.phoneme_service_url is not None,
        loadError=engine.load_error,
        alignerError=engine.aligner_error,
    )


@app.get("/health/ready", response_model=HealthResponse)
async def health_ready() -> HealthResponse:
    if engine.load_error:
        raise error(503, "MODEL_UNAVAILABLE", "Le modèle vocal n'est pas disponible.")
    return HealthResponse(
        status="ready",
        model=settings.model_size,
        device=settings.device,
        computeType=settings.compute_type,
        alignmentMode=settings.alignment_mode,
        modelLoaded=engine.model_loaded,
        alignerLoaded=engine.aligner_loaded,
        phonemeServiceConfigured=settings.phoneme_service_url is not None,
        loadError=None,
        alignerError=engine.aligner_error,
    )


@app.post(
    "/v1/transcriptions",
    response_model=TranscriptionResponse,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}, 413: {"model": ErrorResponse}},
    dependencies=[Depends(require_internal_token)],
)
async def transcribe(
    audio: UploadFile = File(...),
    language: str | None = None,
    expected_text: str | None = Form(default=None),
) -> TranscriptionResponse:
    content_type = (audio.content_type or "").split(";", 1)[0].lower()
    if content_type not in SUPPORTED_CONTENT_TYPES:
        raise error(415, "AUDIO_TYPE_UNSUPPORTED", "Ce format audio n'est pas pris en charge.")

    temp_path: Path | None = None
    total = 0
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=SUPPORTED_CONTENT_TYPES[content_type]) as temp:
            temp_path = Path(temp.name)
            while chunk := await audio.read(1024 * 1024):
                total += len(chunk)
                if total > settings.max_upload_bytes:
                    raise error(
                        413,
                        "AUDIO_TOO_LARGE",
                        f"Le fichier audio dépasse {settings.max_upload_mb} Mo.",
                    )
                temp.write(chunk)

        if total < 512:
            raise error(400, "AUDIO_EMPTY", "Le fichier audio est vide ou incomplet.")

        if expected_text is not None:
            expected_text = " ".join(expected_text.split()).strip()
            if not expected_text or len(expected_text) > 2_000:
                raise error(400, "EXPECTED_TEXT_INVALID", "Le texte attendu doit contenir entre 1 et 2000 caractères.")

        async with inference_slots:
            return await run_in_threadpool(engine.transcribe, temp_path, language, expected_text)
    except SpeechEngineError as exc:
        raise error(422, "TRANSCRIPTION_FAILED", str(exc)) from exc
    finally:
        await audio.close()
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
