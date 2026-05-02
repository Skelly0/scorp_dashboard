"""Extract data for the Population (high-level) page."""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, filter_blank_rows, read_named_range

WORLDVIEW_AXES = ["expansion", "authority", "corporate", "technocratic", "faith", "materialist"]


def extract(wb) -> dict[str, Any]:
    classes = filter_blank_rows(read_named_range(wb, "ClassTable"))
    pops = read_named_range(wb, "PopsimPop")
    worldview_rows = read_named_range(wb, "PopsimWorldview")

    enriched: list[dict[str, Any]] = []
    total_pop = 0.0
    for i, row in enumerate(classes):
        name, tier = row[0], row[1]
        pop = coerce_number(pops[i][0]) if i < len(pops) else None
        if pop is None:
            continue
        total_pop += pop
        wv_row = worldview_rows[i] if i < len(worldview_rows) else [None] * 6
        worldview = {axis: coerce_number(wv_row[j]) for j, axis in enumerate(WORLDVIEW_AXES)}
        enriched.append({
            "name": name,
            "tier": tier,
            "pop": int(pop),
            "share": None,  # filled below
            "political_weight": coerce_number(row[3]) if len(row) > 3 else None,
            "worldview": worldview,
        })

    for c in enriched:
        c["share"] = c["pop"] / total_pop if total_pop else 0.0

    tier_totals: dict[str, float] = {"Upper": 0.0, "Middle": 0.0, "Lower": 0.0}
    for c in enriched:
        if c["tier"] in tier_totals:
            tier_totals[c["tier"]] += c["share"]

    return {"classes": enriched, "tier_totals": tier_totals}
