"""Tests for the GoIs page extractor."""
from __future__ import annotations

import openpyxl

from extractors.gois import extract


def test_extract_returns_live_gois_only(wb):
    result = extract(wb)
    # Fixture has 4 live + 4 blank slots.
    assert len(result["gois"]) == 4
    assert result["gois"][0]["name"] == "Founders"


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
    founders = next(g for g in result["gois"] if g["name"] == "Founders")
    sf_names = [s["name"] for s in founders["sub_factions"]]
    assert "Constitutional Loyalists" in sf_names
    assert len(founders["sub_factions"]) == 3


def test_extract_pop_capture_matrix_shape(wb):
    matrix = extract(wb)["pop_capture_matrix"]
    assert len(matrix["classes"]) == 11
    assert len(matrix["gois"]) == 4
    assert len(matrix["values"]) == 11
    assert all(len(row) == 4 for row in matrix["values"])


def test_extract_includes_subfaction_goal(wb):
    result = extract(wb)
    founders = next(g for g in result["gois"] if g["name"] == "Founders")
    loyalists = next(s for s in founders["sub_factions"]
                     if s["name"] == "Constitutional Loyalists")
    assert loyalists["goal"] == "Defend the founding charter against revisionism."


def test_extract_includes_subfaction_national_share(wb):
    result = extract(wb)
    founders = next(g for g in result["gois"] if g["name"] == "Founders")
    loyalists = next(s for s in founders["sub_factions"]
                     if s["name"] == "Constitutional Loyalists")
    assert loyalists["national_share"] == 0.20
    # All live sub-factions in the fixture should have a numeric national_share.
    all_sfs = [s for g in result["gois"] for s in g["sub_factions"]]
    assert all(isinstance(s["national_share"], float) for s in all_sfs)


def test_extract_includes_subfaction_effective_worldview(wb):
    """The per-axis effective worldview is computed from PopsimWorldview
    baseline + the sub-faction's goal axis/delta from SubFactionGoals."""
    result = extract(wb)
    founders = next(g for g in result["gois"] if g["name"] == "Founders")
    hardliners = next(s for s in founders["sub_factions"]
                      if s["name"] == "Hardliner Founders")
    ew = hardliners["effective_worldview"]
    assert isinstance(ew, dict)
    # Hardliner Founders: parent=Founders → main_class=Bureaucrats →
    # PopsimWorldview row 0 = [5.0, 4.7, 4.4, 4.1, 3.8, 3.5] (per fixture
    # formula 4.0 + (i % 3) * 0.5 - axis * 0.3 at i=41).
    # Goal axis=authority, delta=1.5 → authority bumps to 6.2 (within 1-7
    # clamp); other axes unchanged.
    assert ew == {
        "expansion": 5.0,
        "authority": 6.2,
        "corporate": 4.4,
        "technocratic": 4.1,
        "faith": 3.8,
        "materialist": 3.5,
    }


def test_extract_handles_missing_subfaction_ranges(fixture_workbook_path):
    """When SubFactionGoal/NationalShare are absent, extraction still works —
    text+share fields default to None. The per-axis worldview is computed
    locally from PopsimWorldview + Sub-Factions cols C/D, so it survives the
    removal of those soft-optional ranges."""
    wb = openpyxl.load_workbook(fixture_workbook_path, data_only=True)
    # Remove the soft-optional ranges to simulate an older workbook.
    for nm in ("SubFactionGoal", "SubFactionNationalShare"):
        if nm in wb.defined_names:
            del wb.defined_names[nm]

    result = extract(wb)
    all_sfs = [s for g in result["gois"] for s in g["sub_factions"]]
    # Fixture has 5 live sub-factions across Founders + Capitalists.
    assert len(all_sfs) == 5, "removing names should not drop sub-factions"
    for sf in all_sfs:
        assert sf["goal"] is None
        assert sf["national_share"] is None
        # Worldview still populated — the new computation only depends on
        # PopsimWorldview + SubFactionGoals (both still present).
        assert isinstance(sf["effective_worldview"], dict)
