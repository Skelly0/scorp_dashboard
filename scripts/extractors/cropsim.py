"""Extract the Cropsim food-economics page data.

The live Cropsim tab exposes three compact named blocks:

- CropsimProductionTable: header + rows of food type production.
- CropsimDemandTable: header + rows of class food demand.
- CropsimAggregateTable: labelled aggregate scalars.

The existing food-security scalar named ranges remain the authoritative
source for the headline ratio/per-cap/variety metrics.
"""
from __future__ import annotations

import re
from typing import Any

from extractors._common import coerce_number, read_named_range, scalar_named


_AGGREGATE_KEY_BY_LABEL = {
    "total food supply": "total_supply",
    "total food demand": "total_demand",
    "food security ratio": "security_ratio",
    "food per cap": "per_cap",
    "variety index": "variety_index",
    "food variety index": "variety_index",
}


def extract(wb) -> dict[str, Any]:
    production = _parse_production(read_named_range(wb, "CropsimProductionTable"))
    demand = _parse_demand(read_named_range(wb, "CropsimDemandTable"))
    aggregate_values = _parse_aggregates(read_named_range(wb, "CropsimAggregateTable"))

    computed_supply = sum(row["total_units"] or 0 for row in production)
    computed_demand = sum(row["total_demand"] or 0 for row in demand)

    total_supply = aggregate_values.get("total_supply", computed_supply)
    total_demand = aggregate_values.get("total_demand", computed_demand)
    security_ratio = scalar_named(wb, "FoodSecurityRatio")
    per_cap = scalar_named(wb, "FoodPerCap")
    variety_index = scalar_named(wb, "FoodVarietyIndex")

    if security_ratio is None:
        security_ratio = aggregate_values.get("security_ratio")
    if per_cap is None:
        per_cap = aggregate_values.get("per_cap")
    if variety_index is None:
        variety_index = aggregate_values.get("variety_index")

    balance = (
        total_supply - total_demand
        if total_supply is not None and total_demand is not None
        else None
    )

    _add_share(production, "total_units", total_supply)
    _add_share(demand, "total_demand", total_demand)

    return {
        "metrics": {
            "total_supply": total_supply,
            "total_demand": total_demand,
            "balance": balance,
            "security_ratio": security_ratio,
            "per_cap": per_cap,
            "variety_index": variety_index,
            "production_types": len(production),
            "demand_classes": len(demand),
        },
        "production": production,
        "demand": demand,
    }


def _parse_production(rows: list[list[Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in rows[1:]:
        food_type = _text(_cell(row, 0))
        if not food_type:
            continue
        out.append({
            "food_type": food_type,
            "total_units": coerce_number(_cell(row, 1)),
            "calorie_mult": coerce_number(_cell(row, 2)),
            "share": None,
        })
    return out


def _parse_demand(rows: list[list[Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in rows[1:]:
        class_name = _text(_cell(row, 0))
        if not class_name:
            continue
        out.append({
            "class_name": class_name,
            "pop": coerce_number(_cell(row, 1)),
            "per_cap_demand": coerce_number(_cell(row, 2)),
            "total_demand": coerce_number(_cell(row, 3)),
            "share": None,
        })
    return out


def _parse_aggregates(rows: list[list[Any]]) -> dict[str, float]:
    out: dict[str, float] = {}
    for row in rows:
        label = _normalise_label(_cell(row, 0))
        key = _AGGREGATE_KEY_BY_LABEL.get(label)
        if not key:
            continue
        value = coerce_number(_cell(row, 1))
        if value is not None:
            out[key] = value
    return out


def _add_share(rows: list[dict[str, Any]], value_key: str, total: float | None) -> None:
    if total in (None, 0):
        return
    for row in rows:
        value = row.get(value_key)
        row["share"] = value / total if value is not None else None


def _cell(row: list[Any], idx: int) -> Any:
    return row[idx] if idx < len(row) else None


def _text(value: Any) -> str | None:
    if value in (None, ""):
        return None
    text = str(value).strip()
    return text or None


def _normalise_label(value: Any) -> str:
    text = _text(value)
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip().lower()
