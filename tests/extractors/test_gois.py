"""Tests for the GoIs page extractor."""
from __future__ import annotations

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
