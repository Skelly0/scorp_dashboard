"""Extract data for the Demographics page.

Colony-wide totals + housing + food security. Per-class mortality data
lives on pops.json (see extractors/pops.py) — Demographics route reads
$pops.classes for its Class Vitals table.
"""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, read_named_range
from extractors.status import _avg_satisfaction, _net_delta_pct


def extract(wb) -> dict[str, Any]:
    pop_total = _population_total(wb)
    base = _scalar(wb, "Var_BaseGrowthRate")
    elasticity = _scalar(wb, "Var_GrowthSatElasticity")
    cdr = _scalar(wb, "EffectiveCDR")
    effective_growth = base * elasticity if (base is not None and elasticity is not None) else None
    return {
        "totals": {
            "pop": pop_total,
            "effective_cdr": cdr,
            "total_deaths": _scalar(wb, "TotalDeathsPerTurn"),
            "effective_growth_rate": effective_growth,
            "net_delta_pct": _net_delta_pct(effective_growth, cdr),
            "avg_satisfaction": _avg_satisfaction(wb),
        },
        "housing": {
            "capacity": _scalar(wb, "HousingCapacity"),
            "pop": pop_total,
            "ratio": _scalar(wb, "HousingRatio"),
            "overcrowding_exp": _scalar(wb, "Var_HousingOvercrowdingExp"),
            "growth_mult": _scalar(wb, "HousingGrowthMult"),
        },
        "food": {
            "security_ratio": _scalar(wb, "FoodSecurityRatio"),
            "per_cap": _scalar(wb, "FoodPerCap"),
            "variety_index": _scalar(wb, "FoodVarietyIndex"),
        },
    }


def _scalar(wb, name: str) -> float | None:
    rows = read_named_range(wb, name)
    if not rows or not rows[0]:
        return None
    return coerce_number(rows[0][0])


def _population_total(wb) -> int:
    rows = read_named_range(wb, "PopsimPop")
    total = 0.0
    for row in rows:
        v = coerce_number(row[0])
        if v is not None:
            total += v
    return int(total)
