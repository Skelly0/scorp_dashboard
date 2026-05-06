"""Tests for the Status page extractor."""
from __future__ import annotations

from extractors.status import extract


def test_extract_returns_treasury_block(wb):
    result = extract(wb)
    assert result["treasury"] == {"money": 487, "delta": -12}


def test_extract_returns_stability_and_crisis(wb):
    result = extract(wb)
    assert result["stability"] == 0.42
    assert result["crisis_factor"] == 0.38


def test_extract_returns_population_total(wb):
    result = extract(wb)
    # Sum of fixture's class populations.
    assert result["population_total"] == 15870


def test_extract_returns_resource_flow_strip(wb):
    result = extract(wb)
    resources = result["resources"]
    names = [r["name"] for r in resources]
    assert names == ["Food", "Materials", "Ore", "Energy", "Housing", "He-3", "Water"]
    assert resources[0] == {"name": "Food", "current": 0, "delta": -2}
    assert resources[6] == {"name": "Water", "current": 60, "delta": -1}


def test_extract_returns_overton_window(wb):
    result = extract(wb)
    assert result["overton"] == {
        "expansion": 5.0,
        "authority": 4.5,
        "corporate": 5.0,
        "technocratic": 4.0,
        "faith": 4.0,
        "materialist": 4.0,
    }


def test_extract_active_situations_empty_when_no_situations_sheet(wb):
    """Wave 1: Situations sheet doesn't exist yet — extractor should return [] not crash."""
    result = extract(wb)
    assert result["active_situations"] == []


def test_extract_returns_year(wb):
    result = extract(wb)
    assert result["year"] == 12


def test_extract_year_none_when_named_range_missing(wb):
    del wb.defined_names["Var_Year"]
    result = extract(wb)
    assert result["year"] is None


def test_extract_returns_gov_approval(wb):
    result = extract(wb)
    assert result["gov_approval"] == 0.62


def test_extract_gov_approval_none_when_range_missing(wb):
    del wb.defined_names["EffectiveGovApproval"]
    result = extract(wb)
    assert result["gov_approval"] is None


def test_avg_satisfaction_population_weighted(wb):
    """Weighted mean across PopsimSatisfaction × PopsimPop."""
    from extractors.status import _avg_satisfaction
    # Fixture: all sat = 0.40, all pops varied. Weighted mean = 0.40.
    assert _avg_satisfaction(wb) == 0.40


def test_avg_satisfaction_returns_none_when_total_pop_zero(wb):
    """Guard against division by zero when every pop cell is zero/None."""
    from extractors.status import _avg_satisfaction
    pop_sheet = wb["Popsim"]
    for row in range(5, 20):  # PopsimPop range B5:B19
        pop_sheet.cell(row=row, column=2, value=0)
    assert _avg_satisfaction(wb) is None
