"""Extract the TechTable reference table.

The named range is a 2D block: header row at the top, one row per tech.
Headers are matched by name (not column index) so the GM can reorder columns
without breaking the player view. Unknown headers are silently dropped.

Effect groups are anchored on the literal `Effect N - Target` header strings
(or the en-dash variant `Effect N — Target`); the parser then consumes the
next two columns of each group as `Type` and `Mag`. Reordering across groups
is safe; reordering within a group breaks the assumption.

Soft-optional: missing range → returns {'techs': [], 'branches': []}, sync
still succeeds, frontend renders an empty-state band.
"""
from __future__ import annotations

import logging
import re
from typing import Any

from extractors._common import coerce_number, read_named_range

_log = logging.getLogger(__name__)

_KNOWN_EFFECT_TYPES = {"yield", "workforce", "upkeep"}

# Branches are listed in this order at the top of the canonical list. Any
# branches that appear in the data but are not in this set are appended at
# the end in encounter order — a single new branch never disrupts column
# layout, but it does land at the rightmost edge.
_CANONICAL_BRANCHES = (
    "Agriculture", "Industry", "Mining", "Energy", "Civic", "Science",
)

# Header → top-level output key. Anything not listed is silently dropped.
_TOP_HEADER_KEYS: dict[str, str] = {
    "Name":        "name",
    "Branch":      "branch",
    "Description": "description",
}

_TOP_NUMERIC_HEADER_KEYS: dict[str, str] = {
    "Tier":      "tier",
    "Cost (RP)": "cost_rp",
}

_TOP_BOOL_HEADER_KEYS: dict[str, str] = {
    "Researched": "researched",
    "Available":  "available",
}

# Match `Effect 1 - Target`, `Effect 1 — Target`, with arbitrary whitespace.
# The integer in group 1 is the effect's 1-based index.
_EFFECT_TARGET_HEADER_RE = re.compile(
    r"^Effect\s+(\d+)\s*[-–—]\s*Target$", re.IGNORECASE
)


def extract(wb) -> dict[str, Any]:
    rows = read_named_range(wb, "TechTable")
    if not rows or len(rows) < 2:
        return {"techs": [], "branches": []}

    header_row = [_norm_header(h) for h in rows[0]]
    effect_starts = _find_effect_starts(header_row)

    techs: list[dict[str, Any]] = []
    seen_branches: list[str] = []

    for row in rows[1:]:
        name = _value_for_header(row, header_row, "Name")
        if name in (None, ""):
            continue

        rec: dict[str, Any] = {
            "name": str(name),
            "branch": None,
            "tier": None,
            "cost_rp": None,
            "prereqs": [],
            "researched": False,
            "available": False,
            "effects": [],
            "description": None,
        }

        for header, raw in zip(header_row, row):
            if not header:
                continue
            if header in _TOP_HEADER_KEYS:
                key = _TOP_HEADER_KEYS[header]
                if key == "name":
                    continue
                rec[key] = None if raw in (None, "") else str(raw)
                continue
            if header in _TOP_NUMERIC_HEADER_KEYS:
                num = coerce_number(raw)
                rec[_TOP_NUMERIC_HEADER_KEYS[header]] = (
                    int(num) if num is not None else None
                )
                continue
            if header in _TOP_BOOL_HEADER_KEYS:
                rec[_TOP_BOOL_HEADER_KEYS[header]] = _coerce_bool(raw)
                continue
            if header in ("Prereq 1", "Prereq 2"):
                if raw not in (None, ""):
                    rec["prereqs"].append(str(raw).strip())
                continue
            # Effect headers are handled positionally below.

        # Walk effect groups positionally.
        for start_col in effect_starts:
            target = row[start_col] if start_col < len(row) else None
            if target in (None, ""):
                continue
            type_raw = row[start_col + 1] if start_col + 1 < len(row) else None
            mag_raw = row[start_col + 2] if start_col + 2 < len(row) else None

            type_str = (str(type_raw).strip() if type_raw not in (None, "") else "")
            type_slug = type_str.lower() if type_str else ""
            if type_slug and type_slug not in _KNOWN_EFFECT_TYPES:
                _log.warning(
                    "extractor tech: unknown effect type '%s' on '%s'",
                    type_str, rec["name"],
                )
            rec["effects"].append({
                "target": str(target),
                "type": type_slug,
                "type_raw": type_str if type_str else None,
                "mag": coerce_number(mag_raw),
            })

        if rec["branch"] and rec["branch"] not in seen_branches:
            seen_branches.append(rec["branch"])

        techs.append(rec)

    branches = _order_branches(seen_branches)
    return {"techs": techs, "branches": branches}


def _norm_header(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split())


def _value_for_header(row, header_row, header: str):
    for i, h in enumerate(header_row):
        if h == header:
            return row[i] if i < len(row) else None
    return None


def _find_effect_starts(header_row: list[str]) -> list[int]:
    """Return the column indices of `Effect N - Target` headers, sorted by N."""
    found: list[tuple[int, int]] = []  # (effect_n, col_idx)
    for i, h in enumerate(header_row):
        m = _EFFECT_TARGET_HEADER_RE.match(h or "")
        if m:
            found.append((int(m.group(1)), i))
    found.sort(key=lambda t: t[0])
    return [col for _, col in found]


def _coerce_bool(raw: Any) -> bool:
    if raw is True:
        return True
    if raw is False or raw is None or raw == "":
        return False
    if isinstance(raw, str):
        return raw.strip().upper() in ("TRUE", "YES", "1")
    if isinstance(raw, (int, float)):
        return raw != 0
    return False


def _order_branches(seen: list[str]) -> list[str]:
    canonical = [b for b in _CANONICAL_BRANCHES if b in seen]
    extras = [b for b in seen if b not in _CANONICAL_BRANCHES]
    return canonical + extras
