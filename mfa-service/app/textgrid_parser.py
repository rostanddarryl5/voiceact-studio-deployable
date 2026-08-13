from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Interval:
    start: float
    end: float
    label: str


_TIER_START = re.compile(r"^\s*item \[\d+\]:\s*$")
_INTERVAL_START = re.compile(r"^\s*intervals \[\d+\]:\s*$")
_ASSIGNMENT = re.compile(r'^\s*(name|xmin|xmax|text)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s]+))\s*$')


def parse_long_textgrid(content: str) -> dict[str, list[Interval]]:
    """Parse the small, stable subset of Praat long TextGrid emitted by MFA."""
    tiers: dict[str, list[Interval]] = {}
    tier_name: str | None = None
    interval: dict[str, str] | None = None

    def commit_interval() -> None:
        nonlocal interval
        if tier_name and interval and {"xmin", "xmax", "text"}.issubset(interval):
            label = interval["text"].strip()
            start, end = float(interval["xmin"]), float(interval["xmax"])
            if label and end >= start:
                tiers.setdefault(tier_name, []).append(Interval(start, end, label))
        interval = None

    for line in content.splitlines():
        if _TIER_START.match(line):
            commit_interval()
            tier_name = None
            continue
        if _INTERVAL_START.match(line):
            commit_interval()
            interval = {}
            continue
        match = _ASSIGNMENT.match(line)
        if not match:
            continue
        key, quoted, raw = match.groups()
        value = (quoted if quoted is not None else raw or "").replace(r'\"', '"')
        if key == "name" and interval is None:
            tier_name = value
            tiers.setdefault(tier_name, [])
        elif interval is not None and key in {"xmin", "xmax", "text"}:
            interval[key] = value
    commit_interval()
    return tiers


def alignment_payload(content: str) -> tuple[list[dict], list[dict]]:
    tiers = parse_long_textgrid(content)
    word_tier = next((items for name, items in tiers.items() if "word" in name.lower()), [])
    phone_tier = next((items for name, items in tiers.items() if "phone" in name.lower()), [])
    words = [
        {"word": item.label, "start": item.start, "end": item.end}
        for item in word_tier
        if item.label not in {"<eps>", "sil", "sp", "spn"}
    ]
    phones: list[dict] = []
    for phone in phone_tier:
        if phone.label in {"<eps>", "sil", "sp", "spn"}:
            continue
        midpoint = (phone.start + phone.end) / 2
        word_index = next(
            (index for index, word in enumerate(words) if word["start"] <= midpoint <= word["end"]),
            None,
        )
        phones.append(
            {
                "phone": phone.label,
                "start": phone.start,
                "end": phone.end,
                "durationMs": round((phone.end - phone.start) * 1_000),
                "wordIndex": word_index,
            }
        )
    return words, phones
