from __future__ import annotations

from extractors import congress


def test_congress_party_totals_read_seats_row_not_matrix(wb):
    result = congress.extract(wb)
    assert set(result.keys()) == {"congress", "federations"}
    # The OFFICIAL CongressPartySeats row (15/12), never the projection
    # matrix column sums (14/13) — the GM controls the row.
    assert result["congress"]["total_seats"] == 27
    by_name = {p["name"]: p["seats"] for p in result["congress"]["parties"]}
    assert by_name == {"Liberty Now": 15, "People's Voice": 12, "Non-aligned": 0}


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


def test_congress_zeroed_seats_row_is_a_valid_pre_election_state(wb):
    # The GM zeroes CongressPartySeats while elections have not been run.
    # The extractor must report the zeros faithfully, not repair them from
    # the projection matrix elsewhere on the sheet.
    for col in range(2, 18):  # B..Q
        wb["All-Worker Congress"].cell(row=45, column=col, value=0)
    result = congress.extract(wb)
    assert result["congress"]["total_seats"] == 0
    assert all(p["seats"] == 0 for p in result["congress"]["parties"])


def test_congress_delegations_read_named_range(wb):
    feds = congress.extract(wb)["federations"]
    assert feds["total_seats"] == 27
    # TOTAL row inside the range is skipped; federations in sheet order.
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


def test_congress_ignores_visible_matrix_without_named_range(wb):
    # The on-sheet DELEGATION → PARTY SEATS block is a live projection the
    # GM keeps unofficial until elections run; without the named range it
    # must NOT be read (no title-located fallback — the publish switch is
    # the range itself).
    del wb.defined_names["CongressDelegationSeats"]
    result = congress.extract(wb)
    assert result["federations"] == {"total_seats": 0, "delegations": []}
    # Party totals still come from the official row, untouched.
    assert result["congress"]["total_seats"] == 27


def test_congress_missing_ranges_yield_empty_page(wb):
    del wb.defined_names["CongressPartyNames"]
    del wb.defined_names["CongressPartySeats"]
    del wb.defined_names["CongressDelegationSeats"]
    result = congress.extract(wb)
    assert result["congress"] == {"total_seats": 0, "parties": []}
    assert result["federations"] == {"total_seats": 0, "delegations": []}
