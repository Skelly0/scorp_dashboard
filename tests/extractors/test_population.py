"""Tests for the Population page extractor."""
from __future__ import annotations

from extractors.population import extract


def test_extract_returns_class_count_matching_live_classes(wb):
    result = extract(wb)
    # Fixture has 11 live classes + 4 reserved blanks. Blanks should be filtered.
    assert len(result["classes"]) == 11


def test_extract_class_record_shape(wb):
    result = extract(wb)
    bureaucrats = result["classes"][0]
    assert bureaucrats["name"] == "Bureaucrats"
    assert bureaucrats["tier"] == "Upper"
    assert bureaucrats["pop"] == 970
    assert bureaucrats["political_weight"] == 3.0
    assert isinstance(bureaucrats["worldview"], dict)
    assert set(bureaucrats["worldview"].keys()) == {
        "expansion", "authority", "corporate", "technocratic", "faith", "materialist",
    }


def test_extract_share_sums_to_one(wb):
    result = extract(wb)
    total = sum(c["share"] for c in result["classes"])
    assert abs(total - 1.0) < 1e-6


def test_extract_tier_totals_present(wb):
    result = extract(wb)
    assert set(result["tier_totals"].keys()) == {"Upper", "Middle", "Lower"}
    assert abs(sum(result["tier_totals"].values()) - 1.0) < 1e-6
