"""Extract the All-Worker Congress page data.

Three named ranges on the `All-Worker Congress` sheet share one party-column
axis (15 party slots in cols B..P mirroring the Parties sheet, plus
Non-aligned in col Q):

- CongressPartyNames:  party header row
- CongressPartySeats:  Congress seats per party (Art. 15)
- CouncilSeatsByParty: Celestial Council seats per party (Art. 16)

All three are soft-optional (see validate_schema.SOFT_OPTIONAL_V3_RANGES):
a workbook without them yields empty chamber lists and the frontend renders
an empty state. Chamber totals are derived by summing — there is no scalar
total range. Named zero-seat entries are kept (a founded party shut out of
the chamber is information); blank-name slots are dropped (convention 8).
"""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, read_named_range


def extract(wb) -> dict[str, Any]:
    names = _single_row(read_named_range(wb, "CongressPartyNames"))
    return {
        "congress": _chamber(names, _single_row(read_named_range(wb, "CongressPartySeats"))),
        "council": _chamber(names, _single_row(read_named_range(wb, "CouncilSeatsByParty"))),
    }


def _single_row(rows: list[list[Any]]) -> list[Any]:
    return rows[0] if rows else []


def _chamber(names: list[Any], seats: list[Any]) -> dict[str, Any]:
    parties: list[dict[str, Any]] = []
    total = 0.0
    for i, raw_name in enumerate(names):
        if raw_name in (None, ""):
            continue  # blank party slot reserved for future growth
        name = str(raw_name).strip()
        if not name:
            continue
        seat_count = coerce_number(seats[i]) if i < len(seats) else None
        parties.append({"name": name, "seats": seat_count})
        if seat_count is not None:
            total += seat_count
    return {"total_seats": int(total), "parties": parties}
