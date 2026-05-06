"""Extract data for the Status (landing) page."""
from __future__ import annotations

from typing import Any

from extractors._common import (
    avg_satisfaction,
    coerce_number,
    net_delta_pct,
    population_total,
    scalar_named,
)

OVERTON_AXES = [
    ("expansion", "OvertonExpn"),
    ("authority", "OvertonAuth"),
    ("corporate", "OvertonCorp"),
    ("technocratic", "OvertonTech"),
    ("faith", "OvertonFaith"),
    ("materialist", "OvertonMat"),
]


def extract(wb) -> dict[str, Any]:
    pop_total = population_total(wb)
    return {
        "year": _year(wb),
        "treasury": _treasury(wb),
        "stability": scalar_named(wb, "Stability"),
        "crisis_factor": scalar_named(wb, "CrisisFactor"),
        "population_total": pop_total,
        "resources": _resources(wb),
        "overton": _overton(wb),
        "active_situations": _active_situations(wb),
        "gov_approval": scalar_named(wb, "EffectiveGovApproval"),
        "demographics": _demographics_block(wb, pop_total),
    }


def _year(wb) -> int | None:
    """Year sits at Colony!H1; surfaced via the optional Var_Year named range.

    Returned as int (years are whole numbers); None when the workbook predates
    the Var_Year addition. The historical snapshot writer uses this as the
    archival index, so a missing value just means history is paused — sync
    itself still succeeds.
    """
    raw = scalar_named(wb, "Var_Year")
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
    return {key: scalar_named(wb, name) for key, name in OVERTON_AXES}


def _active_situations(wb) -> list[dict[str, Any]]:
    """Live Situations sheet layout: Name | Crisis Contribution | Description | Tier.
    Returns [] if the sheet doesn't exist."""
    if "Situations" not in wb.sheetnames:
        return []
    out: list[dict[str, Any]] = []
    ws = wb["Situations"]
    # Live layout (CLAUDE.md gotcha #13): banner row 1, header row 2, data row 3+.
    # Columns: Name | Crisis Contribution | Description | Tier.
    for row in ws.iter_rows(min_row=3, values_only=True):
        if not row or row[0] in (None, ""):
            continue
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


def _housing_util(pop: float | None, capacity: float | None) -> float | None:
    """Returns pop/capacity ratio (0..∞). None when capacity is missing or 0."""
    if capacity in (None, 0):
        return None
    if pop is None:
        return None
    return pop / capacity


def _demographics_block(wb, pop_total: int) -> dict:
    """Aggregate demographics scalars consumed by Status's Pulse row.

    Soft-optional Var_* ranges return None when missing — scalar_named
    handles that (read_named_range returns [] for unknown names, so
    scalar_named short-circuits to None).
    """
    base = scalar_named(wb, "Var_BaseGrowthRate")
    elasticity = scalar_named(wb, "Var_GrowthSatElasticity")
    cdr = scalar_named(wb, "EffectiveCDR")
    capacity = scalar_named(wb, "HousingCapacity")
    effective_growth = base * elasticity if (base is not None and elasticity is not None) else None
    return {
        "base_growth_rate": base,
        "sat_elasticity": elasticity,
        "effective_growth_rate": effective_growth,
        "effective_cdr": cdr,
        "total_deaths": scalar_named(wb, "TotalDeathsPerTurn"),
        "net_delta_pct": net_delta_pct(effective_growth, cdr),
        "housing_capacity": capacity,
        "housing_util": _housing_util(pop_total, capacity),
        "avg_satisfaction": avg_satisfaction(wb),
    }
