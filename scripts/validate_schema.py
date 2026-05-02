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
    # Politics — Overton
    "OvertonExpn",
    "OvertonAuth",
    "OvertonCorp",
    "OvertonTech",
    "OvertonFaith",
    "OvertonMat",
    # Colony — treasury + resources
    "TreasuryMoney",
    "TreasuryMoneyDelta",
    "ResourceFlows",
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
    "AdditionalIncomeBreakdown",
    "GoINames",
    "GoIDerivedInfluence",
    "GoIApproval",
    "GoIEffectiveWorldview",
    "GoIMadIndex",
    "GoIApproach",
    "GoIActiveBenefits",
    "SubFactionsBlock",
    "GoIBenefitsTable",
    "PopCaptureBase",
    "PartiesBlock",
    "TerrainPalette",
]

# Ranges only required when Senate page is enabled.
SENATE_REQUIRED_RANGES: list[str] = [
    "CoalitionsBlock",
]


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
