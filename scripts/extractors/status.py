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
        "treasury": _treasury(wb),
        "stability": _scalar(wb, "Politics", "B1"),
        "crisis_factor": _scalar(wb, "Politics", "E1"),
        "population_total": _population_total(wb),
        "resources": _resources(wb),
        "overton": _overton(wb),
        "active_situations": _active_situations(wb),
    }


def _treasury(wb) -> dict[str, Any]:
    money = read_named_range(wb, "TreasuryMoney")
    delta = read_named_range(wb, "TreasuryMoneyDelta")
    return {
        "money": coerce_number(money[0][0]) if money else None,
        "delta": coerce_number(delta[0][0]) if delta else None,
    }


def _scalar(wb, sheet: str, cell: str) -> float | None:
    return coerce_number(wb[sheet][cell].value)


def _population_total(wb) -> int:
    rows = read_named_range(wb, "PopsimPop")
    total = 0.0
    for row in rows:
        v = coerce_number(row[0])
        if v is not None:
            total += v
    return int(total)


def _resources(wb) -> list[dict[str, Any]]:
    rows = read_named_range(wb, "ResourceFlows")
    out = []
    for row in rows:
        if not row or row[0] in (None, ""):
            continue
        out.append({
            "name": row[0],
            "current": coerce_number(row[1]),
            "delta": coerce_number(row[2]),
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
    """Return [] if the Wave-2 Situations sheet doesn't exist yet."""
    if "Situations" not in wb.sheetnames:
        return []
    out: list[dict[str, Any]] = []
    ws = wb["Situations"]
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[0] in (None, ""):
            continue
        name, desc, crisis = (row + (None, None, None))[:3]
        if crisis == "Ended":
            continue  # Status banner shows ongoing only.
        out.append({"name": name, "description": desc, "crisis_factor": coerce_number(crisis)})
    return out
