"""Tests for the Parties page extractor."""
from __future__ import annotations

from extractors.parties import extract


def test_extract_returns_only_founded_parties(wb):
    result = extract(wb)
    # Fixture: 2 seeded, 13 blank.
    assert len(result["parties"]) == 2
    assert result["parties"][0]["name"] == "Liberty Now"


def test_extract_party_record_shape(wb):
    p = extract(wb)["parties"][0]
    assert p["founded"] is True
    assert p["establishment"] == 0.55
    assert isinstance(p["stance"], dict)
    assert set(p["stance"].keys()) == {"expansion", "authority", "corporate", "technocratic", "faith", "materialist"}
    assert p["closest_goi"] == "Founders"
    assert p["estimated_support"] == 0.30
    assert p["vote_share"] == 0.28


def test_extract_compat_matrices_shape(wb):
    result = extract(wb)
    goi_compat = result["goi_compat_matrix"]
    assert len(goi_compat["parties"]) == 2
    assert len(goi_compat["gois"]) == 4
    assert len(goi_compat["values"]) == 2
    assert len(goi_compat["values"][0]) == 4

    class_compat = result["class_compat_matrix"]
    assert len(class_compat["parties"]) == 2
    assert len(class_compat["classes"]) == 11  # blanks filtered
    assert len(class_compat["values"]) == 2
    assert len(class_compat["values"][0]) == 11


def test_extract_empty_state_when_no_parties_founded(wb):
    # Wipe out the founded flag in both seeded rows.
    wb["Parties"]["B4"].value = False
    wb["Parties"]["B5"].value = False
    result = extract(wb)
    assert result["parties"] == []
    assert result["goi_compat_matrix"]["parties"] == []
