from __future__ import annotations

from extractors import congress


def test_congress_extracts_both_chambers(wb):
    result = congress.extract(wb)
    assert set(result.keys()) == {"congress", "council"}
    assert result["congress"]["total_seats"] == 27
    assert result["council"]["total_seats"] == 15


def test_congress_filters_blank_party_slots(wb):
    result = congress.extract(wb)
    names = [p["name"] for p in result["congress"]["parties"]]
    # 13 blank columns dropped; named columns kept in workbook slot order.
    assert names == ["Liberty Now", "People's Voice", "Non-aligned"]


def test_congress_keeps_named_zero_seat_parties(wb):
    result = congress.extract(wb)
    nonaligned = next(
        p for p in result["congress"]["parties"] if p["name"] == "Non-aligned"
    )
    assert nonaligned["seats"] == 0


def test_congress_council_seats_pair_by_column(wb):
    result = congress.extract(wb)
    by_name = {p["name"]: p["seats"] for p in result["council"]["parties"]}
    assert by_name == {"Liberty Now": 8, "People's Voice": 7, "Non-aligned": 0}


def test_congress_missing_ranges_yield_empty_chambers(wb):
    del wb.defined_names["CongressPartyNames"]
    del wb.defined_names["CongressPartySeats"]
    del wb.defined_names["CouncilSeatsByParty"]
    result = congress.extract(wb)
    assert result["congress"] == {"total_seats": 0, "parties": []}
    assert result["council"] == {"total_seats": 0, "parties": []}
