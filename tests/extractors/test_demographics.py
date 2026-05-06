"""Tests for the new Demographics page extractor."""
from __future__ import annotations

import pytest

from extractors.demographics import extract


def test_extract_returns_top_level_blocks(wb):
    result = extract(wb)
    assert set(result.keys()) == {"totals", "housing", "food"}


def test_totals_block_shape(wb):
    result = extract(wb)
    totals = result["totals"]
    assert set(totals.keys()) == {
        "pop", "effective_cdr", "total_deaths",
        "effective_growth_rate", "net_delta_pct", "avg_satisfaction",
    }


def test_totals_values(wb):
    result = extract(wb)
    totals = result["totals"]
    assert totals["pop"] == 15870  # sum of fixture's class populations
    assert totals["effective_cdr"] == 0.0125
    assert totals["total_deaths"] == 280
    assert totals["effective_growth_rate"] == pytest.approx(0.020 * 0.95)
    assert totals["avg_satisfaction"] == 0.40


def test_housing_block_shape(wb):
    result = extract(wb)
    housing = result["housing"]
    assert set(housing.keys()) == {"capacity", "pop", "ratio", "overcrowding_exp", "growth_mult"}
    assert housing["capacity"] == 16500
    assert housing["pop"] == 15870
    assert housing["ratio"] == 0.96
    assert housing["overcrowding_exp"] == 1.5
    assert housing["growth_mult"] == 0.92


def test_housing_soft_optional_growth_mult_missing(wb):
    """Removing HousingGrowthMult should make it None, not crash."""
    del wb.defined_names["HousingGrowthMult"]
    result = extract(wb)
    assert result["housing"]["growth_mult"] is None
    assert result["housing"]["capacity"] == 16500  # other fields unaffected


def test_housing_soft_optional_overcrowding_missing(wb):
    del wb.defined_names["Var_HousingOvercrowdingExp"]
    result = extract(wb)
    assert result["housing"]["overcrowding_exp"] is None


def test_food_block_shape(wb):
    result = extract(wb)
    food = result["food"]
    assert set(food.keys()) == {"security_ratio", "per_cap", "variety_index"}
    assert food["security_ratio"] == 1.05
    assert food["per_cap"] == 1.20
    assert food["variety_index"] == 0.78


def test_avg_satisfaction_zero_pop_guard(wb):
    """All-zero PopsimPop -> avg_satisfaction is None (no div-by-zero)."""
    pop_sheet = wb["Popsim"]
    for row in range(5, 20):
        pop_sheet.cell(row=row, column=2, value=0)
    result = extract(wb)
    assert result["totals"]["avg_satisfaction"] is None
    assert result["totals"]["pop"] == 0


def test_housing_capacity_zero_means_ratio_passthrough(wb):
    """When capacity is 0 in the workbook, ratio is whatever the workbook says (we
    don't second-guess HousingRatio); pop is still emitted unchanged."""
    wb["Colony"]["C12"] = 0
    result = extract(wb)
    assert result["housing"]["capacity"] == 0
    # ratio comes straight from HousingRatio cell - we don't recompute on the fly.
    assert result["housing"]["ratio"] == 0.96


def test_housing_both_soft_optionals_missing(wb):
    """Both HousingGrowthMult and Var_HousingOvercrowdingExp missing → both None;
    rest of housing block unaffected."""
    del wb.defined_names["HousingGrowthMult"]
    del wb.defined_names["Var_HousingOvercrowdingExp"]
    result = extract(wb)
    assert result["housing"]["growth_mult"] is None
    assert result["housing"]["overcrowding_exp"] is None
    assert result["housing"]["capacity"] == 16500
    assert result["housing"]["ratio"] == 0.96


def test_effective_growth_rate_none_when_base_growth_rate_missing(wb):
    """Soft-optional Var_BaseGrowthRate absent → effective_growth_rate and net_delta_pct chain to None."""
    del wb.defined_names["Var_BaseGrowthRate"]
    result = extract(wb)
    assert result["totals"]["effective_growth_rate"] is None
    assert result["totals"]["net_delta_pct"] is None
