"""Schema validator: verifies the workbook has every named range the extractors need.

Runs after the Senate flag has been read so Senate-specific ranges can be
conditionally required.
"""
from __future__ import annotations


class SchemaValidationError(Exception):
    """Raised when the workbook is missing one or more required named ranges."""


# Named ranges that every sync run requires regardless of Senate flag.
# Add to this list when a new extractor relies on a new range.
BASE_REQUIRED_RANGES: list[str] = [
    # Variable sheet
    "Var_SenatePageVisible",
    # Reference
    "ClassTable",
    # Popsim
    "PopsimPop",
    "PopsimWorldview",
    "PopsimGrossPerCap",
    "PopsimDisposablePerCap",
    "PopsimWealthPerCap",
    "PopsimSoL",
    "PopsimExpectedSoL",
    "PopsimSocialPrivileges",
    "PopsimRadicalisation",
    "PopsimAbjectPoverty",
    "PopsimOrganisation",
    "PopsimLiteracy",
    "PopsimVotesTotal",
    "PopsimVoteShare",
    "PopsimSatisfaction",
    # Wages & Welfare
    "AdditionalIncomeRange",
    # State of the Colony — headline metrics
    "Stability",
    "CrisisFactor",
    # Overton & Policy
    "OvertonExpn",
    "OvertonAuth",
    "OvertonCorp",
    "OvertonTech",
    "OvertonFaith",
    "OvertonMat",
    # Politics — GoI dashboard (only the master name list is named; per-row
    # data is read by column offset within the GoI block).
    "GoINames",
    # Sub-factions (4 separate ranges, no monolithic block)
    "SubFactionGoals",
    "SubFactionInfluences",
    "SubFactionMinorGoals",
    "SubFactionApprovals",
    # GoI Benefits + Pop Capture
    "GoIBenefitsTable",
    "PopCaptureBase",
    # Note: Treasury / Resources / Parties / Coalitions / Terrain palette
    # are read via direct cell references (no named ranges in the live workbook).
]

# Ranges only required when Senate page is enabled.
# Coalitions data is read via direct ref Coalitions!A4:AA8 (no named range exists).
SENATE_REQUIRED_RANGES: list[str] = []


def validate(wb, *, senate_enabled: bool) -> None:
    """Raise SchemaValidationError if any required named range is missing."""
    required = list(BASE_REQUIRED_RANGES)
    if senate_enabled:
        required.extend(SENATE_REQUIRED_RANGES)

    missing = [name for name in required if name not in wb.defined_names]
    if missing:
        raise SchemaValidationError(
            f"Workbook missing required named ranges: {', '.join(sorted(missing))}"
        )
