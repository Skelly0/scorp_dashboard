"""Tests for the GoIs page extractor."""
from __future__ import annotations

import openpyxl

from extractors.gois import extract


def test_extract_returns_live_gois_only(wb):
    result = extract(wb)
    # Fixture has 5 live + 3 blank slots.
    assert [g["name"] for g in result["gois"]] == [
        "Administration",
        "Corporate",
        "Unions",
        "Security",
        "Research",
    ]


def test_extract_goi_record_shape(wb):
    g = extract(wb)["gois"][0]
    assert g["main_class"] == "Bureaucrats"
    assert g["derived_influence"] == 0.30
    assert g["approval"] == 0.55
    assert g["approach"] == "Reformist"
    assert isinstance(g["effective_worldview"], dict)
    assert g["mad_index"] == 0.10


def test_extract_active_benefits_parsed(wb):
    g = extract(wb)["gois"][0]
    assert g["active_benefits"]["unlocked"] == 1
    assert g["active_benefits"]["total"] == 3
    assert isinstance(g["active_benefits"]["unlocked_list"], list)


def test_extract_sub_factions_grouped_under_parent(wb):
    result = extract(wb)
    security = next(g for g in result["gois"] if g["name"] == "Security")
    sf_names = [s["name"] for s in security["sub_factions"]]
    assert sf_names == ["Officers", "Fraternalists", "Shepherds"]


def test_extract_pop_capture_matrix_shape(wb):
    matrix = extract(wb)["pop_capture_matrix"]
    assert len(matrix["classes"]) == 11
    assert len(matrix["gois"]) == 5
    assert len(matrix["values"]) == 11
    assert all(len(row) == 5 for row in matrix["values"])


def test_extract_pop_capture_matrix_uses_captured_pop_counts(wb):
    matrix = extract(wb)["pop_capture_matrix"]

    # The capture table's header order is Administration/Corporate/Unions/
    # Research/Security, while the Politics card order puts Security before
    # Research. Values should follow the displayed GoI labels, not raw columns.
    assert matrix["values"][0] == [1100, 1200, 1300, 1500, 1400]
    assert matrix["values"][-1] == [11100, 11200, 11300, 11500, 11400]


def test_extract_includes_subfaction_goal(wb):
    result = extract(wb)
    administration = next(g for g in result["gois"] if g["name"] == "Administration")
    statebuilders = next(s for s in administration["sub_factions"]
                         if s["name"] == "Statebuilders")
    assert statebuilders["goal"] == "Establish a constitution"


def test_extract_includes_subfaction_national_share(wb):
    result = extract(wb)
    security = next(g for g in result["gois"] if g["name"] == "Security")
    officers = next(s for s in security["sub_factions"]
                    if s["name"] == "Officers")
    assert officers["national_share"] == 0.05
    # All live sub-factions in the fixture should have a numeric national_share.
    all_sfs = [s for g in result["gois"] for s in g["sub_factions"]]
    assert all(isinstance(s["national_share"], float) for s in all_sfs)


def test_extract_includes_subfaction_effective_worldview(wb):
    """Per-axis effective worldview is read directly from SubFactionStances
    (Sub-Factions!N:S in the live wb; mirrored at Politics!AG:AL in the
    fixture, row-aligned with SubFactionGoals)."""
    result = extract(wb)
    security = next(g for g in result["gois"] if g["name"] == "Security")
    officers = next(s for s in security["sub_factions"]
                    if s["name"] == "Officers")
    ew = officers["effective_worldview"]
    assert isinstance(ew, dict)
    # Officers' fixture stance row, copied verbatim from the
    # SubFactionStances range — no baseline-plus-delta math involved.
    assert ew == {
        "expansion": 5.0,
        "authority": 1.65,
        "corporate": 4.0,
        "technocratic": 3.1,
        "faith": 3.5,
        "materialist": 2.5,
    }


def test_extract_handles_missing_subfaction_ranges(fixture_workbook_path):
    """When soft-optional sub-faction ranges are absent, extraction still
    works — the missing fields default to None. SubFactionStances remains
    so the radar still has data; SubFactionGoal/NationalShare drop to —."""
    wb = openpyxl.load_workbook(fixture_workbook_path, data_only=True)
    # Remove the soft-optional text/share ranges to simulate an older workbook.
    for nm in ("SubFactionGoal", "SubFactionNationalShare"):
        if nm in wb.defined_names:
            del wb.defined_names[nm]

    result = extract(wb)
    all_sfs = [s for g in result["gois"] for s in g["sub_factions"]]
    # Fixture has 15 live sub-factions across 5 GoIs.
    assert len(all_sfs) == 15, "removing names should not drop sub-factions"
    for sf in all_sfs:
        assert sf["goal"] is None
        assert sf["national_share"] is None
        # Worldview still populated — SubFactionStances is still present.
        assert isinstance(sf["effective_worldview"], dict)


def test_extract_handles_missing_subfaction_stances(fixture_workbook_path):
    """When SubFactionStances itself is absent, the radar is hidden — every
    sub-faction's effective_worldview becomes None (graceful degradation)."""
    wb = openpyxl.load_workbook(fixture_workbook_path, data_only=True)
    if "SubFactionStances" in wb.defined_names:
        del wb.defined_names["SubFactionStances"]

    result = extract(wb)
    all_sfs = [s for g in result["gois"] for s in g["sub_factions"]]
    assert len(all_sfs) == 15, "removing the stance range must not drop sub-factions"
    for sf in all_sfs:
        assert sf["effective_worldview"] is None
