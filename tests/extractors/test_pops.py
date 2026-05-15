"""Tests for the Pops Detailed page extractor."""
from __future__ import annotations

import pytest

from extractors.pops import extract


def test_extract_returns_class_records(wb):
    result = extract(wb)
    assert len(result["classes"]) == 11


def test_extract_income_block_complete(wb):
    result = extract(wb)
    bureaucrats = result["classes"][0]
    inc = bureaucrats["income"]
    assert inc["gross_per_cap"] == 12.0
    assert inc["income_tax_per_cap"] == 1.2
    assert inc["wealth_tax_per_cap"] == 0.24
    assert inc["effective_tax_rate"] == 0.12
    assert inc["disposable_per_cap"] == 12.0 * 0.88
    # Total income before tax = pop * gross_per_cap
    assert inc["total_gross"] == bureaucrats["pop"] * 12.0


def test_extract_status_block_complete(wb):
    result = extract(wb)
    bureaucrats = result["classes"][0]
    s = bureaucrats["status"]
    assert s["radicalisation"] == 0.20
    assert s["abject_poverty"] == 0.10
    assert s["organisation"] == 0.30
    assert s["literacy"] == 0.65


def test_extract_additional_income_breakdown(wb):
    result = extract(wb)
    a = result["classes"][0]["additional_income"]
    assert a["welfare"] == 0.5
    assert a["subsidies"] == 0.2
    assert a["total"] == 0.7


def test_extract_satisfaction_present(wb):
    result = extract(wb)
    assert result["classes"][0]["satisfaction"] == 0.40


def test_extract_living_standards_block(wb):
    result = extract(wb)
    b = result["classes"][0]
    assert b["standard_of_living"] == 0.42
    assert b["expected_sol"] == 0.55
    assert b["social_privileges"] == 0.30


def test_pops_per_class_mortality_present(wb):
    from extractors.pops import extract
    result = extract(wb)
    assert len(result["classes"]) > 0
    first = result["classes"][0]
    assert "mortality_rate" in first
    assert "deaths_per_turn" in first
    assert "births_per_turn" in first
    assert "unemployed_count" in first


def test_pops_mortality_values_from_fixture(wb):
    from extractors.pops import extract
    result = extract(wb)
    # First class: mortality 0.010, pop 970 -> deaths ~ 9 (int), births = deaths + 4 = 13
    first = result["classes"][0]
    assert first["mortality_rate"] == pytest.approx(0.010)
    assert first["deaths_per_turn"] == 9  # int(970 * 0.010)
    assert first["births_per_turn"] == 13  # deaths + 4 in fixture


def test_pops_mobility_in_out_present(wb):
    result = extract(wb)
    first = result["classes"][0]
    # Fixture seeds row 24 → in=2, out=1; row 25 → in=3, out=2; ...
    assert first["mobility_in"] == 2
    assert first["mobility_out"] == 1
    second = result["classes"][1]
    assert second["mobility_in"] == 3
    assert second["mobility_out"] == 2


def test_pops_mobility_optional_when_range_missing(wb):
    """Removing the soft-optional mobility ranges should not break extraction."""
    del wb.defined_names["PopsimMobilityIn"]
    del wb.defined_names["PopsimMobilityOut"]
    result = extract(wb)
    for cls in result["classes"]:
        assert cls["mobility_in"] is None
        assert cls["mobility_out"] is None


def test_pops_weekly_hours_worked_present(wb):
    result = extract(wb)
    first = result["classes"][0]
    second = result["classes"][1]
    assert first["workforce"]["weekly_hours_worked"] == 42
    assert second["workforce"]["weekly_hours_worked"] == 41


def test_pops_weekly_hours_worked_optional_when_range_missing(wb):
    del wb.defined_names["WeeklyHoursWorkedTable"]
    result = extract(wb)
    for cls in result["classes"]:
        assert cls["workforce"]["weekly_hours_worked"] is None


def test_pops_satisfaction_breakdown_present(wb):
    """Per-class satisfaction_breakdown dict surfaces all 11 sources."""
    result = extract(wb)
    first = result["classes"][0]
    bd = first["satisfaction_breakdown"]
    expected_keys = {
        "food", "housing", "employment", "ownership", "services",
        "faith", "entertainment", "tax", "wages", "safety", "situations",
    }
    assert set(bd) == expected_keys


def test_pops_satisfaction_breakdown_values(wb):
    """Fixture seeds value = 0.30 + class_idx*0.05 + source_idx*0.01.
    Spot-check first and last sources for two classes."""
    result = extract(wb)
    first = result["classes"][0]
    assert first["satisfaction_breakdown"]["food"] == pytest.approx(0.30)
    assert first["satisfaction_breakdown"]["situations"] == pytest.approx(0.40)
    second = result["classes"][1]
    assert second["satisfaction_breakdown"]["food"] == pytest.approx(0.35)
    assert second["satisfaction_breakdown"]["situations"] == pytest.approx(0.45)


def test_pops_satisfaction_breakdown_optional_when_range_missing(wb):
    """Removing the soft-optional table should leave all sources as None."""
    del wb.defined_names["PopsimSatisfactionFullTable"]
    result = extract(wb)
    for cls in result["classes"]:
        bd = cls["satisfaction_breakdown"]
        assert all(v is None for v in bd.values())


def test_pops_consumption_present(wb):
    """Per-class consumption block surfaces water/energy/materials per-cap and total."""
    result = extract(wb)
    first = result["classes"][0]  # Bureaucrats, pop 970
    cons = first["consumption"]
    assert set(cons) == {"water", "energy", "materials"}
    # Fixture seeds water=0.005, energy=0.020, materials=0.010 per cap.
    assert cons["water"]["per_cap"] == pytest.approx(0.005)
    assert cons["water"]["total"] == pytest.approx(970 * 0.005)
    assert cons["energy"]["per_cap"] == pytest.approx(0.020)
    assert cons["energy"]["total"] == pytest.approx(970 * 0.020)
    assert cons["materials"]["per_cap"] == pytest.approx(0.010)
    assert cons["materials"]["total"] == pytest.approx(970 * 0.010)


def test_pops_consumption_optional_when_ranges_missing(wb):
    """Removing the soft-optional consumption ranges should not break extraction."""
    del wb.defined_names["WaterDemandByClass"]
    del wb.defined_names["EnergyDemandByClass"]
    del wb.defined_names["MaterialsDemandByClass"]
    result = extract(wb)
    for cls in result["classes"]:
        cons = cls["consumption"]
        for resource in ("water", "energy", "materials"):
            assert cons[resource]["per_cap"] is None
            assert cons[resource]["total"] is None


def test_pops_consumption_partial_when_one_range_missing(wb):
    """A single missing range degrades only that resource; others still extract."""
    del wb.defined_names["EnergyDemandByClass"]
    result = extract(wb)
    first = result["classes"][0]
    assert first["consumption"]["water"]["per_cap"] == pytest.approx(0.005)
    assert first["consumption"]["energy"]["per_cap"] is None
    assert first["consumption"]["energy"]["total"] is None
    assert first["consumption"]["materials"]["per_cap"] == pytest.approx(0.010)


def test_pops_handles_short_mortality_range(wb):
    """If MortalityRates has fewer rows than ClassTable, missing rows surface as None - no IndexError."""
    from openpyxl.workbook.defined_name import DefinedName
    # Override MortalityRates to point at 5 rows of empty cells far away
    wb.defined_names["MortalityRates"] = DefinedName(
        "MortalityRates", attr_text="Popsim!$X$200:$X$204"
    )
    from extractors.pops import extract
    result = extract(wb)
    # All classes should still extract; mortality_rate is None for all
    # (the 5 cells are empty by default)
    for cls in result["classes"]:
        assert cls["mortality_rate"] is None
