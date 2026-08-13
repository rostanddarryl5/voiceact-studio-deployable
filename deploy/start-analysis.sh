#!/usr/bin/env bash
set -euo pipefail

export PORT="${PORT:-8000}"
export VOICEACT_MODEL_SIZE="${VOICEACT_MODEL_SIZE:-small}"
export VOICEACT_INTERNAL_TOKEN="${VOICEACT_INTERNAL_TOKEN:-}"
export VOICEACT_PHONEME_SERVICE_TOKEN="${VOICEACT_PHONEME_SERVICE_TOKEN:-$VOICEACT_INTERNAL_TOKEN}"
export VOICEACT_PHONEME_SERVICE_URL="${VOICEACT_PHONEME_SERVICE_URL:-http://127.0.0.1:8020}"
export VOICEACT_ALIGNMENT="${VOICEACT_ALIGNMENT:-mfa}"
export VOICEACT_DEVICE="${VOICEACT_DEVICE:-cpu}"
export VOICEACT_COMPUTE_TYPE="${VOICEACT_COMPUTE_TYPE:-int8}"
export VOICEACT_MAX_CONCURRENCY="${VOICEACT_MAX_CONCURRENCY:-1}"
export VOICEACT_PRELOAD_MODEL="${VOICEACT_PRELOAD_MODEL:-false}"
export VOICEACT_MAX_UPLOAD_MB="${VOICEACT_MAX_UPLOAD_MB:-24}"
export HF_HOME="${HF_HOME:-/models/huggingface}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-/models/cache}"
export TORCH_HOME="${TORCH_HOME:-/models/torch}"
export MFA_ROOT_DIR="${MFA_ROOT_DIR:-/models}"

mkdir -p "$HF_HOME" "$XDG_CACHE_HOME" "$TORCH_HOME" "$MFA_ROOT_DIR"

healthcheck() {
  local url="$1"
  micromamba run -n base python - "$url" <<'PY'
import sys
import urllib.request

urllib.request.urlopen(sys.argv[1], timeout=5).read()
PY
}

cleanup() {
  if [[ -n "${MFA_PID:-}" ]]; then
    kill "$MFA_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cd /service/mfa-service
micromamba run -n base uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 8020 \
  --workers 1 \
  --proxy-headers &
MFA_PID=$!

for attempt in $(seq 1 60); do
  if healthcheck http://127.0.0.1:8020/health/ready >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$MFA_PID" 2>/dev/null; then
    echo "VoiceAct MFA service stopped during startup." >&2
    exit 1
  fi
  sleep 1
done

if ! healthcheck http://127.0.0.1:8020/health/ready >/dev/null 2>&1; then
  echo "VoiceAct MFA service did not become ready." >&2
  exit 1
fi

cd /service/speech-service
exec micromamba run -n base uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "$PORT" \
  --workers 1 \
  --proxy-headers
