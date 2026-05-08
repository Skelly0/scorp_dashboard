"""Extract data for the Demographics page.

Colony-wide totals + housing + food security. Per-class mortality data
lives on pops.json (see extractors/pops.py) — Demographics route reads
$pops.classes for its Class Vitals table.
"""
from __future__ import annotations

from typing import Any

from extractors._common import (
    avg_satisfaction,
    net_delta_pct,
    population_total,
    scalar_named,
)


def extract(wb) -> dict[str, Any]:
    pop_total = population_total(wb)
    base = scalar_named(wb, "Var_BaseGrowthRate")
    elasticity = scalar_named(wb, "Var_GrowthSatElasticity")
    cdr = scalar_named(wb, "EffectiveCDR")
    effective_growth = base * elasticity if (base is not None and elasticity is not None) else None
    capacity = scalar_named(wb, "HousingCapacity")
    # Ratio is derived from pop/capacity rather than read from HousingRatio:
    # the GM's named-range cell has drifted to 0 in the live workbook even with
    # real pop+capacity, so pop and capacity are treated as the authoritative
    # inputs.
    ratio = (
        pop_total / capacity
        if (capacity not in (None, 0) and pop_total is not None)
        else None
    )
    return {
        "totals": {
            "pop": pop_total,
            "effective_cdr": cdr,
            "total_births": scalar_named(wb, "TotalBirths"),
            "total_deaths": scalar_named(wb, "TotalDeathsPerTurn"),
            "effective_growth_rate": effective_growth,
            "net_delta_pct": net_delta_pct(effective_growth, cdr),
            "avg_satisfaction": avg_satisfaction(wb),
        },
        "housing": {
            "capacity": capacity,
            "pop": pop_total,
            "ratio": ratio,
            "overcrowding_exp": scalar_named(wb, "Var_HousingOvercrowdingExp"),
            "growth_mult": scalar_named(wb, "HousingGrowthMult"),
        },
        "food": {
            "security_ratio": scalar_named(wb, "FoodSecurityRatio"),
            "per_cap": scalar_named(wb, "FoodPerCap"),
            "variety_index": scalar_named(wb, "FoodVarietyIndex"),
        },
    }
