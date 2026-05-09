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
    "WealthIncomePerClass",
    "WorkforceSupplyDemand",
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
    # v3 — Status colony vitals
    "EffectiveGovApproval",
    "TotalDeathsPerTurn",
    "EffectiveCDR",
    # v3 — Per-class mortality (consumed by pops.py + demographics.py)
    "MortalityRates",
    "DeathsPerTurn",
    "ClassBirths",
    "PopsimUnemployed",
    # v3 — Housing (ratio is derived from pop/capacity in the extractor;
    # HousingRatio named range is no longer read)
    "HousingCapacity",
    # v3 — Food security
    "FoodSecurityRatio",
    "FoodPerCap",
    "FoodVarietyIndex",
]

# Ranges only required when Senate page is enabled.
# Coalitions data is read via direct ref Coalitions!A4:AA8 (no named range exists).
SENATE_REQUIRED_RANGES: list[str] = []

# Soft-optional v3 ranges. Validator does NOT require these — extractors
# read them via _scalar_named (which returns None for missing names) so
# the dashboard degrades gracefully if the GM removes a tuning knob.
SOFT_OPTIONAL_V3_RANGES: list[str] = [
    "Var_BaseGrowthRate",
    "Var_GrowthSatElasticity",
    "Var_BaseDeathRate",
    "HousingGrowthMult",
    "Var_HousingOvercrowdingExp",
    # Authoritative whole-colony births tally per turn. Demographics' Predicted
    # Growth tile reads (TotalBirths − TotalDeathsPerTurn); when missing the
    # tile renders "—" rather than falling back to a derived rate estimate.
    "TotalBirths",
    # Per-class mobility (Popsim cols F & G in the live workbook). Soft-optional so
    # the dashboard degrades to "—" cells if the GM hasn't named the ranges yet.
    "PopsimMobilityIn",
    "PopsimMobilityOut",
    # v5 — Sub-faction enrichment (read by extractors/gois.py via read_named_range,
    # which returns [] when missing — so the dashboard degrades gracefully).
    # `SubFactionStances` is the per-sub-faction 6-axis effective stance
    # (Expn/Auth/Corp/Tech/Faith/Mat) on Sub-Factions cols N:S. Soft-optional
    # so the radar simply hides when the GM hasn't filled the range yet.
    # `SubFactionDetail` was used briefly for the per-axis worldview mirror;
    # that mirror was retired and stances now read directly from this range.
    "SubFactionGoal",
    "SubFactionNationalShare",
    "SubFactionStances",
    # v6 — Improvement catalog (read by extractors/catalog.py via read_named_range;
    # missing → returns empty improvements list, frontend hides the catalog UI).
    "ImprovementsCatalog",
    # v8 — Tech research tree (read by extractors/tech.py via read_named_range;
    # missing → returns empty techs+branches lists, frontend renders an empty
    # state band on the /tech page).
    "TechTable",
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
