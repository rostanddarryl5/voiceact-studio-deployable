from __future__ import annotations

import sqlite3
import logging
from pathlib import Path

logger = logging.getLogger("voiceact.mfa")

def _confidence_rows(database_path: Path) -> list[tuple[float, float, str, float]]:
    """Read MFA's raw phone_goodness evidence without depending on MFA internals."""
    connection = sqlite3.connect(f"file:{database_path}?mode=ro", uri=True, timeout=2)
    try:
        tables = {
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        }
        if not {"phone_interval", "phone"}.issubset(tables):
            return []
        return [
            (float(begin), float(end), str(phone), float(goodness))
            for begin, end, phone, goodness in connection.execute(
                """
                SELECT pi.begin, pi.end, p.phone, pi.phone_goodness
                FROM phone_interval AS pi
                JOIN phone AS p ON p.id = pi.phone_id
                WHERE pi.phone_goodness IS NOT NULL
                ORDER BY pi.begin, pi.end
                """
            )
            if goodness is not None and float(goodness) >= 0
        ]
    finally:
        connection.close()


def attach_phone_goodness(
    temporary_directory: Path,
    phones: list[dict],
    tolerance_seconds: float = 0.04,
) -> tuple[list[dict], float]:
    """
    Attach MFA phone confidence to exported intervals.

    MFA deliberately does not include ``phone_goodness`` in TextGrid/JSON
    exports, but stores it in its SQLite workflow database. Matching by
    boundaries keeps this adapter isolated from private MFA Python APIs.
    """
    rows: list[tuple[float, float, str, float]] = []
    database_paths = list(temporary_directory.rglob("*.db"))
    logger.info("MFA confidence scan found %s database(s)", len(database_paths))
    for database_path in database_paths:
        try:
            candidate = _confidence_rows(database_path)
        except (OSError, sqlite3.DatabaseError):
            continue
        if len(candidate) > len(rows):
            rows = candidate

    if not rows:
        logger.warning("MFA confidence scan found no phone_goodness rows")
        return phones, 0.0

    available = list(rows)
    enriched: list[dict] = []
    matched = 0
    for phone in phones:
        best_index = None
        best_distance = float("inf")
        for index, (begin, end, _label, _goodness) in enumerate(available):
            distance = abs(float(phone["start"]) - begin) + abs(float(phone["end"]) - end)
            if distance < best_distance:
                best_index = index
                best_distance = distance
        item = dict(phone)
        if best_index is not None and best_distance <= tolerance_seconds * 2:
            _begin, _end, _label, goodness = available.pop(best_index)
            item["phoneGoodness"] = round(goodness, 6)
            matched += 1
        else:
            item["phoneGoodness"] = None
        enriched.append(item)

    return enriched, matched / max(1, len(phones))
