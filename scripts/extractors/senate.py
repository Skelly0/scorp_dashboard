"""Extract data for the Senate page (sheet-flag gated).

Live workbook has no `CoalitionsBlock` or `PartiesBlock` named ranges; the
extractor reads both sheets via direct cell references.
"""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, read_named_range


def extract(wb) -> dict[str, Any]:
    coalitions = _coalitions(wb)
    capture = _goi_capture(wb)
    seats = [{"party": p, "seats": None} for p in capture["parties"]]
    return {
        "coalitions": coalitions,
        "goi_capture_matrix": capture,
        "seats_by_party": seats,
        "placeholder_note": "Seat data coming once Council Members sheet adds Seat # and Party fields.",
    }


def _read_coalitions_block(wb):
    """Read Coalitions!A4:AA8 directly (5 slots × 27 cols)."""
    if "Coalitions" not in wb.sheetnames:
        return []
    ws = wb["Coalitions"]
    rows = []
    for r in range(4, 9):
        rows.append([ws.cell(row=r, column=c).value for c in range(1, 28)])
    return rows


def _read_parties_block(wb):
    """Read Parties!A4:AP18 directly (15 slots × 42 cols)."""
    if "Parties" not in wb.sheetnames:
        return []
    ws = wb["Parties"]
    rows = []
    for r in range(4, 19):
        rows.append([ws.cell(row=r, column=c).value for c in range(1, 43)])
    return rows


def _coalitions(wb) -> list[dict[str, Any]]:
    block = _read_coalitions_block(wb)
    parties_block = _read_parties_block(wb)
    party_names = [r[0] for r in parties_block if r and r[0] and r[1] is True]

    out = []
    for r in block:
        if not r or not r[0]:
            continue
        member_count = coerce_number(r[16])
        if not member_count:
            continue
        flags = r[1:16]  # 15 boolean flags into Parties slots 0..14
        members = []
        for slot_idx, flag in enumerate(flags):
            if flag is True and slot_idx < len(party_names):
                members.append(party_names[slot_idx])
        out.append({
            "name": r[0],
            "member_parties": members,
            "member_count": int(member_count),
            "total_establishment": coerce_number(r[17]),
            "total_vote_share": coerce_number(r[18]),
            "worldview_centroid": {
                axis: coerce_number(r[19 + i]) for i, axis in enumerate(
                    ["expansion", "authority", "corporate", "technocratic", "faith", "materialist"]
                )
            },
            "mad_index": coerce_number(r[25]),
            "approach": r[26],
        })
    return out


def _goi_capture(wb) -> dict[str, Any]:
    parties_block = _read_parties_block(wb)
    goi_names = [r[0] for r in read_named_range(wb, "GoINames") if r and r[0]]

    parties = []
    raw = []  # list of (name, vote_share, [compat per goi])
    for r in parties_block:
        if not r or not r[0] or r[1] is not True:
            continue
        name = r[0]
        vote = coerce_number(r[41]) or 0.0
        compat = [coerce_number(r[17 + j]) or 0.0 for j in range(len(goi_names))]
        parties.append(name)
        raw.append((name, vote, compat))

    if not raw or all(v == 0 for _, v, _ in raw):
        return {"parties": parties, "gois": goi_names, "values": []}

    # Per-party per-GoI raw weight = compat × vote_share. Normalise per GoI.
    raw_matrix = [[c[j] * v for j in range(len(goi_names))] for _, v, c in raw]
    col_sums = [sum(row[j] for row in raw_matrix) for j in range(len(goi_names))]
    normalised = [
        [
            (raw_matrix[i][j] / col_sums[j]) if col_sums[j] > 0 else 0.0
            for j in range(len(goi_names))
        ]
        for i in range(len(raw))
    ]
    return {"parties": parties, "gois": goi_names, "values": normalised}
