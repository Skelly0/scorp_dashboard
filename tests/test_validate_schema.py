"""Tests for the schema validator."""
from __future__ import annotations

import pytest

from validate_schema import (
    BASE_REQUIRED_RANGES,
    SENATE_REQUIRED_RANGES,
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


def test_validate_requires_senate_ranges_when_enabled(wb):
    # Strip senate ranges to verify enabling Senate raises when they're missing.
    for name in SENATE_REQUIRED_RANGES:
        if name in wb.defined_names:
            del wb.defined_names[name]
    with pytest.raises(SchemaValidationError):
        validate(wb, senate_enabled=True)


def test_base_required_includes_var_senate_page_visible():
    assert "Var_SenatePageVisible" in BASE_REQUIRED_RANGES


def test_senate_required_lists_coalitions_named_range():
    # Document the contract: coalitions data lives behind a named range
    # (or, if not, a sheet name string starting with "Coalitions").
    assert any("Coalition" in r for r in SENATE_REQUIRED_RANGES)


NEW_HARD_REQUIRED = [
    "EffectiveGovApproval", "TotalDeathsPerTurn", "EffectiveCDR",
    "MortalityRates", "DeathsPerTurn", "PopsimUnemployed",
    "HousingCapacity", "HousingRatio",
    "FoodSecurityRatio", "FoodPerCap", "FoodVarietyIndex",
]


@pytest.mark.parametrize("missing_name", NEW_HARD_REQUIRED)
def test_validator_rejects_missing_v3_range(wb, missing_name):
    """Each new hard-required range must be present; removing one fails validation."""
    del wb.defined_names[missing_name]
    with pytest.raises(SchemaValidationError) as excinfo:
        validate(wb, senate_enabled=False)
    assert missing_name in str(excinfo.value)
