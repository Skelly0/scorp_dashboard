"""Extract data for the Situations page.

Wave 1: Situations / Stability Modifiers / Tier Ladder sheets may not exist yet —
the extractor returns empty arrays instead of crashing, so the frontend can render
an empty-state.
"""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number


def extract(wb) -> dict[str, Any]:
    return {
        "active": _active(wb),
        "ended": _ended(wb),
        "stability_modifiers": _stab_mods(wb),
        "tier_ladder": _tier_ladder(wb),
    }


def _situations_rows(wb):
    """Read the Situations sheet's data rows.

    Live layout (CLAUDE.md gotcha #13): banner row 1, header row 2, data row 3+.
    Columns: Name | Crisis Contribution | Description | Tier.
    The 4-col live layout is canonical; padding tolerates any narrower fixture.
    """
    if "Situations" not in wb.sheetnames:
        return []
    ws = wb["Situations"]
    out = []
    for row in ws.iter_rows(min_row=3, values_only=True):
        if not row or row[0] in (None, ""):
            continue
        padded = list(row) + [None, None, None, None]
        name, crisis, desc, _tier = padded[:4]
        out.append({"name": name, "description": desc, "crisis_factor_raw": crisis})
    return out


def _active(wb):
    return [
        {"name": r["name"], "description": r["description"],
         "crisis_factor": coerce_number(r["crisis_factor_raw"])}
        for r in _situations_rows(wb)
        if r["crisis_factor_raw"] != "Ended"
    ]


def _ended(wb):
    return [
        {"name": r["name"], "description": r["description"], "crisis_factor": None}
        for r in _situations_rows(wb)
        if r["crisis_factor_raw"] == "Ended"
    ]


def _stab_mods(wb):
    if "Stability Modifiers" not in wb.sheetnames:
        return []
    ws = wb["Stability Modifiers"]
    out = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[0] in (None, ""):
            continue
        out.append({"name": row[0], "description": row[1] if len(row) > 1 else None,
                    "factor": coerce_number(row[2]) if len(row) > 2 else None})
    return out


def _tier_ladder(wb):
    if "Tier Ladder" not in wb.sheetnames:
        return []
    ws = wb["Tier Ladder"]
    out = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[0] in (None, ""):
            continue
        tier, active, consequence = (list(row) + [None, None, None])[:3]
        out.append({"tier": tier, "active": bool(active), "consequence": consequence})
    return out
