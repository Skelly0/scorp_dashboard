"""Tests for the Senate page extractor."""
from __future__ import annotations

import openpyxl
import pytest

from extractors.senate import extract


@pytest.fixture
def wb_senate_on(fixture_workbook_path):
    wb = openpyxl.load_workbook(fixture_workbook_path, data_only=True)
    wb["Variable"]["B1"].value = True
    return wb


def test_extract_returns_coalitions(wb_senate_on):
    result = extract(wb_senate_on)
    assert len(result["coalitions"]) == 2
    assert result["coalitions"][0]["name"] == "Big Tent"


def test_extract_coalition_member_parties_resolved(wb_senate_on):
    result = extract(wb_senate_on)
    big_tent = result["coalitions"][0]
    # Both slot-0 (Liberty Now) and slot-1 (People's Voice) flags TRUE.
    assert "Liberty Now" in big_tent["member_parties"]
    assert "People's Voice" in big_tent["member_parties"]


def test_extract_filters_empty_coalition_slots(wb_senate_on):
    """Slots 3-5 of Coalitions are blank; should be filtered."""
    result = extract(wb_senate_on)
    assert all(c["member_count"] > 0 for c in result["coalitions"])


def test_extract_goi_capture_matrix_present(wb_senate_on):
    result = extract(wb_senate_on)
    matrix = result["goi_capture_matrix"]
    assert len(matrix["parties"]) == 2
    assert len(matrix["gois"]) == 4
    # Sum of capture across parties per GoI should equal 1.0 (normalised).
    for j in range(4):
        col_sum = sum(matrix["values"][i][j] for i in range(len(matrix["parties"])))
        assert abs(col_sum - 1.0) < 1e-6


def test_extract_seats_are_placeholder_nulls(wb_senate_on):
    result = extract(wb_senate_on)
    seats = result["seats_by_party"]
    assert all(s["seats"] is None for s in seats)


def test_extract_returns_empty_capture_when_no_vote_share(wb_senate_on):
    """Empty-state guard: zero out vote share, expect empty matrix not div-by-zero."""
    wb_senate_on["Parties"]["AP4"].value = 0
    wb_senate_on["Parties"]["AP5"].value = 0
    result = extract(wb_senate_on)
    assert result["goi_capture_matrix"]["values"] == []
