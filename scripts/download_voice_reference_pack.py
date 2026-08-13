"""Build VoiceAct's small, licensed reference-voice pack.

The script intentionally downloads a curated subset instead of a whole corpus.
It enforces a hard byte limit and records provenance for every file. MLS readers
are labelled as audited open narration, never as professional voice actors.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = ROOT / "public" / "references" / "voice-pack"
MANIFEST_PATH = ROOT / "docs" / "knowledge" / "sources" / "VOICE_REFERENCE_MANIFEST.json"
MAX_BYTES = 5 * 1024**3
DATASET = "facebook/multilingual_librispeech"
CONFIG = "french"
SPLIT = "test"
API = "https://datasets-server.huggingface.co/filter"

# Speakers were selected from the official MLS French metainfo. Keeping several
# readers prevents the learner from overfitting to one timbre.
SPEAKERS = [
    {"id": "1406", "voice_profile": "masculine", "display": "MLS-FR M1"},
    {"id": "296", "voice_profile": "masculine", "display": "MLS-FR M2"},
    {"id": "2216", "voice_profile": "masculine", "display": "MLS-FR M3"},
    {"id": "12977", "voice_profile": "feminine", "display": "MLS-FR F1"},
    {"id": "10179", "voice_profile": "feminine", "display": "MLS-FR F2"},
    {"id": "12080", "voice_profile": "feminine", "display": "MLS-FR F3"},
    {"id": "2154", "voice_profile": "feminine", "display": "MLS-FR F4"},
]

SAMPLES_PER_SPEAKER = 4


def get_json(url: str, retries: int = 4) -> dict:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            req = Request(url, headers={"User-Agent": "VoiceAct-reference-pack/1.0"})
            with urlopen(req, timeout=90) as response:
                return json.load(response)
        except Exception as exc:  # network retry
            last_error = exc
            time.sleep(2**attempt)
    raise RuntimeError(f"Unable to query {url}: {last_error}")


def download(url: str, destination: Path, current_total: int) -> tuple[int, str]:
    if destination.exists() and destination.stat().st_size:
        data = destination.read_bytes()
        return len(data), hashlib.sha256(data).hexdigest()

    destination.parent.mkdir(parents=True, exist_ok=True)
    req = Request(url, headers={"User-Agent": "VoiceAct-reference-pack/1.0"})
    with urlopen(req, timeout=180) as response:
        declared = int(response.headers.get("Content-Length") or 0)
        if declared and current_total + declared > MAX_BYTES:
            raise RuntimeError("The 5 GiB VoiceAct pack limit would be exceeded")
        digest = hashlib.sha256()
        written = 0
        partial = destination.with_suffix(destination.suffix + ".part")
        with partial.open("wb") as handle:
            while True:
                block = response.read(1024 * 1024)
                if not block:
                    break
                written += len(block)
                if current_total + written > MAX_BYTES:
                    raise RuntimeError("The 5 GiB VoiceAct pack limit was exceeded")
                digest.update(block)
                handle.write(block)
        partial.replace(destination)
        return written, digest.hexdigest()


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def audio_source(row: dict) -> str:
    audio = row.get("audio")
    if isinstance(audio, list):
        audio = audio[0] if audio else {}
    if not isinstance(audio, dict) or not audio.get("src"):
        raise RuntimeError(f"No audio source for row {row.get('id')}")
    return audio["src"]


def main() -> int:
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    entries: list[dict] = []
    total = sum(path.stat().st_size for path in PUBLIC_ROOT.rglob("*") if path.is_file())

    for speaker in SPEAKERS:
        where = f'"speaker_id"=\'{speaker["id"]}\''
        query = urlencode(
            {
                "dataset": DATASET,
                "config": CONFIG,
                "split": SPLIT,
                "where": where,
                "offset": 0,
                "length": SAMPLES_PER_SPEAKER + 2,
            }
        )
        payload = get_json(f"{API}?{query}")
        candidates = [item.get("row", {}) for item in payload.get("rows", [])]
        selected = [row for row in candidates if 45 <= len(clean_text(row.get("transcript", ""))) <= 260]
        if len(selected) < SAMPLES_PER_SPEAKER:
            selected = candidates

        for row in selected[:SAMPLES_PER_SPEAKER]:
            item_id = row.get("id") or f'{speaker["id"]}-{len(entries)}'
            folder = PUBLIC_ROOT / "mls-fr" / speaker["voice_profile"]
            destination = folder / f"{item_id}.opus"
            size, digest = download(audio_source(row), destination, total)
            total = sum(path.stat().st_size for path in PUBLIC_ROOT.rglob("*") if path.is_file())
            entries.append(
                {
                    "id": f"mls-fr-{item_id}",
                    "corpus": "Multilingual LibriSpeech French",
                    "speakerId": speaker["id"],
                    "displayVoice": speaker["display"],
                    "voiceProfile": speaker["voice_profile"],
                    "language": "fr-FR",
                    "sourceTier": "audited_open_narration",
                    "professionalActorVerified": False,
                    "allowedUses": ["articulation", "rhythm", "narration", "storytelling"],
                    "excludedClaims": ["professional_actor", "acted_emotion", "advertising_delivery", "dubbing_performance"],
                    "transcript": clean_text(row.get("transcript", "")),
                    "localPath": f"/{destination.relative_to(ROOT / 'public').as_posix()}",
                    "bytes": size,
                    "sha256": digest,
                    "sourceUrl": "https://www.openslr.org/94/",
                    "datasetUrl": "https://huggingface.co/datasets/facebook/multilingual_librispeech",
                    "license": "CC BY 4.0",
                    "attribution": "Pratap et al., Multilingual LibriSpeech; original recordings from LibriVox",
                }
            )
            print(f"{speaker['display']} {item_id}: {size / 1024:.1f} KiB")

    siwis = ROOT / "public" / "references" / "siwis" / "emph_book_s01_0001.wav"
    if siwis.exists():
        entries.append(
            {
                "id": "siwis-emph-book-s01-0001",
                "corpus": "SIWIS French Speech Synthesis Database",
                "displayVoice": "SIWIS Pro F1",
                "voiceProfile": "feminine",
                "language": "fr-FR",
                "sourceTier": "professional_voice_talent",
                "professionalActorVerified": True,
                "allowedUses": ["articulation", "rhythm", "intonation", "emphasis", "narration"],
                "transcript": "Et qu'il le veuille ou non, nous reviendrons vers le nord, c'est-a-dire au pays des honnetes gens.",
                "localPath": "/references/siwis/emph_book_s01_0001.wav",
                "bytes": siwis.stat().st_size,
                "sha256": hashlib.sha256(siwis.read_bytes()).hexdigest(),
                "sourceUrl": "https://datashare.ed.ac.uk/items/1de74991-eede-4b48-8fbe-6c2abaed88d8",
                "license": "CC BY 4.0",
                "attribution": "Yamagishi, Honnet, Garner and Lazaridis; University of Edinburgh CSTR",
            }
        )

    # Coverage is explicit: a missing professional recording is not silently
    # replaced by a merely readable audiobook sample.
    coverage = {
        "availableNow": {
            "articulation": ["feminine", "masculine"],
            "rhythm": ["feminine", "masculine"],
            "narration": ["feminine", "masculine"],
            "storytelling": ["feminine", "masculine"],
            "intonationProfessional": ["feminine"],
            "emphasisProfessional": ["feminine"],
        },
        "commissionRequiredFrenchProfessional": {
            "dubbingFilmSeries": ["feminine", "masculine"],
            "animation": ["feminine", "masculine"],
            "videoGame": ["feminine", "masculine"],
            "advertisingUgc": ["feminine", "masculine"],
            "newsJournalism": ["feminine", "masculine"],
            "horrorSuspense": ["feminine", "masculine"],
            "shortDynamic": ["feminine", "masculine"],
        },
    }
    manifest = {
        "schemaVersion": 1,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "hardLimitBytes": MAX_BYTES,
        "downloadedPackBytes": sum(entry["bytes"] for entry in entries),
        "selectionPolicy": {
            "calibrationProfile": "The learner's sex/register calibrates acoustic ranges only.",
            "examplePreference": "Example voice preference is stored separately and may be feminine, masculine, or alternating.",
            "legal": "Only commercially compatible files are shipped. Non-commercial emotion corpora are excluded.",
            "quality": "MLS is open narration, not certified professional acting. SIWIS is verified professional voice talent.",
        },
        "coverage": coverage,
        "entries": entries,
    }
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (PUBLIC_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Pack: {manifest['downloadedPackBytes'] / 1024**2:.2f} MiB / 5120 MiB")
    print(f"Manifest: {MANIFEST_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
