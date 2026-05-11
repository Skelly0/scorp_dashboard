"""Extract data for the Parties page."""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, filter_blank_rows, read_named_range

AXES = ["expansion", "authority", "corporate", "technocratic", "faith", "materialist"]


def extract(wb) -> dict[str, Any]:
    block = _read_parties_block(wb)
    goi_names = [r[0] for r in read_named_range(wb, "GoINames") if r and r[0]]
    classes = filter_blank_rows(read_named_range(wb, "ClassTable"))

    # Live class slot indices (relative to the 15-slot ClassTable) so we can
    # subset the 15-col class-compat block down to live classes.
    full_class_block = read_named_range(wb, "ClassTable")
    live_class_indices = [i for i, r in enumerate(full_class_block) if r and r[0] not in (None, "")]

    parties_out: list[dict[str, Any]] = []
    for r in block:
        if not r or not r[0] or r[1] is not True:
            continue  # Skip blank slots and non-founded slots.
        stance = {axis: coerce_number(r[3 + i]) for i, axis in enumerate(AXES)}
        goi_compat_full = [coerce_number(r[17 + j]) for j in range(8)]
        class_compat_full = [coerce_number(r[25 + j]) for j in range(15)]
        parties_out.append({
            "name": r[0],
            "founded": True,
            "establishment": coerce_number(r[2]),
            "stance": stance,
            "weighted_stance": {axis: coerce_number(r[9 + i]) for i, axis in enumerate(AXES)},
            "mad_index": coerce_number(r[15]),
            "goi_compat": goi_compat_full[: len(goi_names)],
            "class_compat": [class_compat_full[i] for i in live_class_indices],
            "estimated_support": coerce_number(r[40]),
            "vote_share": coerce_number(r[41]),
        })

    return {
        "parties": parties_out,
        "goi_compat_matrix": {
            "parties": [p["name"] for p in parties_out],
            "gois": goi_names,
            "values": [p["goi_compat"] for p in parties_out],
        },
        "class_compat_matrix": {
            "parties": [p["name"] for p in parties_out],
            "classes": [c[0] for c in classes],
            "values": [p["class_compat"] for p in parties_out],
        },
        "party_capture_pct_matrix": _read_party_capture_matrix(
            wb,
            "PARTY VALUE CAPTURE %",
            [p["name"] for p in parties_out],
            [c[0] for c in classes],
        ),
        "party_capture_pop_matrix": _read_party_capture_matrix(
            wb,
            "PARTY VALUE CAPTURED POP",
            [p["name"] for p in parties_out],
            [c[0] for c in classes],
        ),
    }


def _read_parties_block(wb):
    """Read Parties!A4:AP18 directly (15 slots × 42 cols).

    No named range exists in the live workbook; the layout is stable so we
    read by direct cell reference.
    """
    if "Parties" not in wb.sheetnames:
        return []
    ws = wb["Parties"]
    rows = []
    for r in range(4, 19):  # rows 4-18 inclusive
        row = [ws.cell(row=r, column=c).value for c in range(1, 43)]  # cols A-AP
        rows.append(row)
    return rows


def _read_party_capture_matrix(wb, block_title, party_names, class_names):
    """Read class x party capture blocks from Party and GoI Pop Capture.

    These blocks are sheet-keyed rather than named ranges in the live workbook.
    Locate by title so the extractor survives rows being inserted above them.
    """
    empty = {"classes": class_names, "parties": party_names, "values": []}
    if not party_names or not class_names or "Party and GoI Pop Capture" not in wb.sheetnames:
        return empty

    ws = wb["Party and GoI Pop Capture"]
    anchor = _find_cell(ws, block_title)
    if anchor is None:
        return empty

    title_row, title_col = anchor
    header_row = title_row + 2
    party_cols = {}
    for col in range(title_col + 1, ws.max_column + 1):
        header = ws.cell(row=header_row, column=col).value
        if header in party_names:
            party_cols[header] = col

    if not party_cols:
        return empty

    rows_by_class = {}
    for row in range(header_row + 1, ws.max_row + 1):
        class_name = ws.cell(row=row, column=title_col).value
        if class_name in class_names:
            rows_by_class[class_name] = [
                coerce_number(ws.cell(row=row, column=party_cols[p]).value)
                if p in party_cols else None
                for p in party_names
            ]
        if len(rows_by_class) == len(class_names):
            break

    return {
        "classes": class_names,
        "parties": party_names,
        "values": [
            rows_by_class.get(class_name, [None] * len(party_names))
            for class_name in class_names
        ],
    }


def _find_cell(ws, value):
    for row in ws.iter_rows():
        for cell in row:
            if cell.value == value:
                return cell.row, cell.column
    return None
