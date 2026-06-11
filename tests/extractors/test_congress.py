from __future__ import annotations

from openpyxl.workbook.defined_name import DefinedName

from extractors import congress


def test_congress_party_totals_derive_from_delegation_matrix(wb):
    result = congress.extract(wb)
    assert set(result.keys()) == {"congress", "federations"}
    # Matrix column sums (14/13), NOT the drifted legacy row 45 (15/12).
    assert result["congress"]["total_seats"] == 27
    by_name = {p["name"]: p["seats"] for p in result["congress"]["parties"]}
    assert by_name == {"Liberty Now": 14, "People's Voice": 13, "Non-aligned": 0}


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


def test_congress_delegations_read_titled_matrix_block(wb):
    feds = congress.extract(wb)["federations"]
    assert feds["total_seats"] == 27
    # QUOTAS helper block skipped, TOTAL row skipped, federations in sheet order.
    assert [d["name"] for d in feds["delegations"]] == [
        "Dockworkers Guild",
        "Vacuum Farmers Union",
        "Tunnel Borers Combine",
    ]
    dock = feds["delegations"][0]
    assert dock["seats"] == 12
    # Zero-seat parties omitted within a delegation (Non-aligned holds 0 here).
    assert dock["parties"] == [
        {"name": "Liberty Now", "seats": 8},
        {"name": "People's Voice", "seats": 4},
    ]


def test_congress_named_range_overrides_title_block(wb):
    wb.defined_names["CongressDelegationSeats"] = DefinedName(
        "CongressDelegationSeats",
        attr_text="'All-Worker Congress'!$A$35:$Q$36",
    )
    result = congress.extract(wb)
    feds = result["federations"]
    assert [d["name"] for d in feds["delegations"]] == [
        "Dockworkers Guild",
        "Vacuum Farmers Union",
    ]
    assert feds["total_seats"] == 20
    by_name = {p["name"]: p["seats"] for p in result["congress"]["parties"]}
    assert by_name == {"Liberty Now": 12, "People's Voice": 8, "Non-aligned": 0}


def test_congress_falls_back_to_seats_row_without_matrix(wb):
    wb["All-Worker Congress"]["A33"] = None
    result = congress.extract(wb)
    assert result["federations"] == {"total_seats": 0, "delegations": []}
    # Legacy CongressPartySeats row drives the chamber when no matrix exists.
    assert result["congress"]["total_seats"] == 27
    by_name = {p["name"]: p["seats"] for p in result["congress"]["parties"]}
    assert by_name == {"Liberty Now": 15, "People's Voice": 12, "Non-aligned": 0}


def test_congress_missing_ranges_yield_empty_page(wb):
    del wb.defined_names["CongressPartyNames"]
    del wb.defined_names["CongressPartySeats"]
    result = congress.extract(wb)
    assert result["congress"] == {"total_seats": 0, "parties": []}
    assert result["federations"] == {"total_seats": 0, "delegations": []}
