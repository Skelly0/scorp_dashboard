"""Extract the All-Worker Congress page data.

Two views of the same chamber, both on the `All-Worker Congress` sheet and
sharing one party-column axis (15 party slots in cols B..P mirroring the
Parties sheet, plus Non-aligned in col Q):

- Party totals: `CongressPartyNames` + `CongressPartySeats`, paired by
  column index. The seats row is the OFFICIAL channel — the GM zeroes it
  while elections have not been run, so an all-zero row is a legitimate
  pre-election state, not drift. Render the zeros; do not "repair" them
  from other blocks.
- Trade Federation delegations: the `CongressDelegationSeats` named range
  ONLY (col A federation names + the same party columns as
  `CongressPartyNames`, data rows only). `TOTAL` / `Federation …` label
  rows are skipped defensively.

Deliberately NO title-located fallback for the delegation matrix: the
visible `DELEGATION → PARTY SEATS` block on this sheet holds live
projection formulas (what an election WOULD return given current party
support) that the GM intentionally keeps out of the official rows until
elections are run. This is the inverse of the gotcha-#51 situation — here
the visible table is a working draft, not a lagging truth — so adding the
named range is the GM's explicit publish switch for the federation view.

Everything is soft-optional (validate_schema.SOFT_OPTIONAL_V3_RANGES):
missing ranges yield empty party/delegation lists and the frontend renders
empty-state bands; sync never fails. Named zero-seat parties are kept at
the chamber level (a founded party shut out of the chamber is
information); blank-name slots are dropped (convention 8). Zero-seat
parties are omitted WITHIN each delegation — at that level they are noise.

The Celestial Council allocation (`CouncilSeatsByParty`) is no longer
extracted; the dashboard's second band shows the federation delegations.
"""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, read_named_range

# Delegation rows whose col-A label matches these are structure, not federations.
_NON_FEDERATION_LABELS = ("TOTAL", "FEDERATION")


def extract(wb) -> dict[str, Any]:
    names = [_clean(v) for v in _single_row(read_named_range(wb, "CongressPartyNames"))]
    delegations = _read_delegations(wb, names)
    return {
        "congress": _chamber(names, _single_row(read_named_range(wb, "CongressPartySeats"))),
        "federations": {
            "total_seats": int(sum(d["seats"] for d in delegations)),
            "delegations": delegations,
        },
    }


def _single_row(rows: list[list[Any]]) -> list[Any]:
    return rows[0] if rows else []


def _clean(value: Any) -> str | None:
    if value in (None, ""):
        return None
    name = str(value).strip()
    return name or None


def _chamber(names: list[str | None], seats: list[Any]) -> dict[str, Any]:
    parties: list[dict[str, Any]] = []
    total = 0.0
    for i, name in enumerate(names):
        if name is None:
            continue  # blank party slot reserved for future growth
        seat_count = coerce_number(seats[i]) if i < len(seats) else None
        parties.append({"name": name, "seats": seat_count})
        if seat_count is not None:
            total += seat_count
    return {"total_seats": int(total), "parties": parties}


def _read_delegations(wb, names: list[str | None]) -> list[dict[str, Any]]:
    if not any(n is not None for n in names):
        return []  # no party axis — the matrix cells cannot be labelled
    delegations: list[dict[str, Any]] = []
    for row in read_named_range(wb, "CongressDelegationSeats"):
        fed = _clean(row[0]) if row else None
        if fed is None or any(fed.upper().startswith(lbl) for lbl in _NON_FEDERATION_LABELS):
            continue
        parties: list[dict[str, Any]] = []
        total = 0.0
        for i, name in enumerate(names):
            if name is None:
                continue
            seats = coerce_number(row[i + 1]) if i + 1 < len(row) else None
            if seats is None:
                continue
            total += seats
            if seats > 0:
                parties.append({"name": name, "seats": seats})
        delegations.append({"name": fed, "seats": int(total), "parties": parties})
    return delegations
