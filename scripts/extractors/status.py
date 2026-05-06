"""Extract data for the Status (landing) page."""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, read_named_range

OVERTON_AXES = [
    ("expansion", "OvertonExpn"),
    ("authority", "OvertonAuth"),
    ("corporate", "OvertonCorp"),
    ("technocratic", "OvertonTech"),
    ("faith", "OvertonFaith"),
    ("materialist", "OvertonMat"),
]


def extract(wb) -> dict[str, Any]:
    return {
        "year": _year(wb),
        "treasury": _treasury(wb),
        "stability": _scalar_named(wb, "Stability"),
        "crisis_factor": _scalar_named(wb, "CrisisFactor"),
        "population_total": _population_total(wb),
        "resources": _resources(wb),
        "overton": _overton(wb),
        "gov_approval": _scalar_named(wb, "EffectiveGovApproval"),
        "active_situations": _active_situations(wb),
    }


def _year(wb) -> int | None:
    """Year sits at Colony!H1; surfaced via the optional Var_Year named range.

    Returned as int (years are whole numbers); None when the workbook predates
    the Var_Year addition. The historical snapshot writer uses this as the
    archival index, so a missing value just means history is paused — sync
    itself still succeeds.
    """
    raw = _scalar_named(wb, "Var_Year")
    return int(raw) if raw is not None else None


def _treasury(wb) -> dict[str, Any]:
    """Read treasury balance from Colony!B3, derive delta from the Money row
    in the resource table (Income/turn − Upkeep/turn at row 13)."""
    money = None
    delta = None
    if "Colony" in wb.sheetnames:
        ws = wb["Colony"]
        money = coerce_number(ws["B3"].value)
        # Find the Money row in the resource table (rows 8-15)
        for r in range(8, 16):
            if str(ws.cell(row=r, column=1).value or "").strip().lower() == "money":
                income = coerce_number(ws.cell(row=r, column=3).value) or 0
                upkeep = coerce_number(ws.cell(row=r, column=4).value) or 0
                delta = income - upkeep
                break
    return {"money": money, "delta": delta}


def _population_total(wb) -> int:
    rows = read_named_range(wb, "PopsimPop")
    total = 0.0
    for row in rows:
        v = coerce_number(row[0])
        if v is not None:
            total += v
    return int(total)


def _resources(wb) -> list[dict[str, Any]]:
    """Read Colony!A8:D15 — name / reserve / income/turn / upkeep/turn.
    Delta = income − upkeep."""
    if "Colony" not in wb.sheetnames:
        return []
    ws = wb["Colony"]
    out = []
    for r in range(8, 16):
        name = ws.cell(row=r, column=1).value
        if not name or name == "":
            continue
        reserve = coerce_number(ws.cell(row=r, column=2).value)
        income = coerce_number(ws.cell(row=r, column=3).value) or 0
        upkeep = coerce_number(ws.cell(row=r, column=4).value) or 0
        out.append({
            "name": name,
            "current": reserve,
            "delta": income - upkeep,
        })
    return out


def _overton(wb) -> dict[str, float | None]:
    return {key: _scalar_named(wb, name) for key, name in OVERTON_AXES}


def _scalar_named(wb, name: str) -> float | None:
    rows = read_named_range(wb, name)
    if not rows or not rows[0]:
        return None
    return coerce_number(rows[0][0])


def _active_situations(wb) -> list[dict[str, Any]]:
    """Live Situations sheet layout: Name | Crisis Contribution | Description | Tier.
    Returns [] if the sheet doesn't exist."""
    if "Situations" not in wb.sheetnames:
        return []
    out: list[dict[str, Any]] = []
    ws = wb["Situations"]
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[0] in (None, ""):
            continue
        # Tolerate both 3-col fixture and 4-col live layouts
        padded = list(row) + [None, None, None, None]
        name, crisis, desc, _tier = padded[:4]
        if crisis == "Ended":
            continue  # Status banner shows ongoing only.
        out.append({
            "name": name,
            "description": desc,
            "crisis_factor": coerce_number(crisis),
        })
    return out
