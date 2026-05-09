from __future__ import annotations

import pytest

from extractors import cropsim


def test_cropsim_extracts_metrics(wb):
    result = cropsim.extract(wb)

    assert set(result.keys()) == {"metrics", "production", "demand"}
    metrics = result["metrics"]
    assert metrics["total_supply"] == pytest.approx(188.5275)
    assert metrics["total_demand"] == pytest.approx(179.55)
    assert metrics["balance"] == pytest.approx(8.9775)
    assert metrics["security_ratio"] == pytest.approx(1.05)
    assert metrics["per_cap"] == pytest.approx(1.20)
    assert metrics["variety_index"] == pytest.approx(0.78)


def test_cropsim_extracts_production_rows_with_shares(wb):
    result = cropsim.extract(wb)
    production = result["production"]

    assert len(production) == 5
    assert production[0] == {
        "food_type": "Greens",
        "total_units": 50.0,
        "calorie_mult": 1.0,
        "share": pytest.approx(50.0 / 188.5275),
    }
    assert production[-1]["food_type"] == "Fruits"


def test_cropsim_extracts_demand_rows_with_shares(wb):
    result = cropsim.extract(wb)
    demand = result["demand"]

    assert len(demand) == 11
    industrial = next(row for row in demand if row["class_name"] == "Industrial Workers")
    assert industrial["pop"] == 4170
    assert industrial["per_cap_demand"] == pytest.approx(0.015)
    assert industrial["total_demand"] == pytest.approx(62.55)
    assert industrial["share"] == pytest.approx(62.55 / 179.55)


def test_cropsim_missing_tables_degrades_to_scalar_metrics(wb):
    del wb.defined_names["CropsimProductionTable"]
    del wb.defined_names["CropsimDemandTable"]
    del wb.defined_names["CropsimAggregateTable"]

    result = cropsim.extract(wb)
    assert result["production"] == []
    assert result["demand"] == []
    assert result["metrics"]["security_ratio"] == pytest.approx(1.05)
    assert result["metrics"]["total_supply"] == 0
    assert result["metrics"]["total_demand"] == 0
