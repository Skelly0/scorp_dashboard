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
            "closest_goi": r[16],
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
