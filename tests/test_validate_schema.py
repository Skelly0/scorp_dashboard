"""Tests for the schema validator."""
from __future__ import annotations

import pytest

from validate_schema import (
    BASE_REQUIRED_RANGES,
    SENATE_REQUIRED_RANGES,
    SOFT_OPTIONAL_V3_RANGES,
    SchemaValidationError,
    validate,
)


def test_validate_passes_when_all_base_ranges_present(wb):
    # The fixture wb has the base ranges by construction.
    validate(wb, senate_enabled=False)


def test_validate_fails_when_base_range_missing(wb):
    del wb.defined_names["PopsimPop"]
    with pytest.raises(SchemaValidationError, match="PopsimPop"):
        validate(wb, senate_enabled=False)


def test_validate_skips_senate_ranges_when_disabled(wb):
    # Senate-specific ranges may exist in fixture, but they're not required when disabled.
    for name in SENATE_REQUIRED_RANGES:
        if name in wb.defined_names:
            del wb.defined_names[name]
    validate(wb, senate_enabled=False)


def test_base_required_includes_var_senate_page_visible():
    assert "Var_SenatePageVisible" in BASE_REQUIRED_RANGES


def test_senate_required_ranges_is_empty_by_design():
    """SENATE_REQUIRED_RANGES is intentionally empty: coalitions data is read
    via direct cell ref Coalitions!A4:AA8, not via a named range (per
    validate_schema.py:81 comment). If this changes, update the senate
    handling in validate() and the relevant extractor docs."""
    assert SENATE_REQUIRED_RANGES == []


def test_weekly_hours_table_is_documented_soft_optional():
    assert "WeeklyHoursWorkedTable" in SOFT_OPTIONAL_V3_RANGES


def test_congress_ranges_are_documented_soft_optional():
    for name in ("CongressPartyNames", "CongressPartySeats", "CongressDelegationSeats"):
        assert name in SOFT_OPTIONAL_V3_RANGES
    # The Celestial Council range is retired — the dashboard no longer reads it.
    assert "CouncilSeatsByParty" not in SOFT_OPTIONAL_V3_RANGES


def test_validate_with_senate_enabled_passes_when_base_ranges_present(wb):
    """Senate-enabled validation requires no extra ranges today
    (SENATE_REQUIRED_RANGES is []). When that list grows, this test should
    fail loudly so the senate fixture additions are remembered."""
    validate(wb, senate_enabled=True)


NEW_HARD_REQUIRED = [
    "EffectiveGovApproval", "TotalDeathsPerTurn", "EffectiveCDR",
    "MortalityRates", "DeathsPerTurn", "ClassBirths", "PopsimUnemployed",
    "HousingCapacity",
    "FoodSecurityRatio", "FoodPerCap", "FoodVarietyIndex",
    "GoIValueCapturedPop",
    "CropsimProductionTable", "CropsimDemandTable", "CropsimAggregateTable",
]


@pytest.mark.parametrize("missing_name", NEW_HARD_REQUIRED)
def test_validator_rejects_missing_v3_range(wb, missing_name):
    """Each new hard-required range must be present; removing one fails validation."""
    del wb.defined_names[missing_name]
    with pytest.raises(SchemaValidationError) as excinfo:
        validate(wb, senate_enabled=False)
    assert missing_name in str(excinfo.value)
