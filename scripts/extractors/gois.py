"""Extract data for the GoIs page."""
from __future__ import annotations

import re
from typing import Any

from extractors._common import coerce_number, filter_blank_rows, read_named_range

WORLDVIEW_AXES = ["expansion", "authority", "corporate", "technocratic", "faith", "materialist"]


def extract(wb) -> dict[str, Any]:
    names = [r[0] for r in read_named_range(wb, "GoINames")]
    derived = read_named_range(wb, "GoIDerivedInfluence")
    approval = read_named_range(wb, "GoIApproval")
    worldview = read_named_range(wb, "GoIEffectiveWorldview")
    mad = read_named_range(wb, "GoIMadIndex")
    approach = read_named_range(wb, "GoIApproach")
    benefits_raw = read_named_range(wb, "GoIActiveBenefits")
    sub_factions_block = read_named_range(wb, "SubFactionsBlock")
    benefits_table = read_named_range(wb, "GoIBenefitsTable")
    capture = read_named_range(wb, "PopCaptureBase")
    classes = filter_blank_rows(read_named_range(wb, "ClassTable"))

    # Determine which GoI rows are live (non-blank name).
    live_indices = [i for i, n in enumerate(names) if n not in (None, "")]
    live_names = [names[i] for i in live_indices]

    # Look up each live GoI's main_class via the sub-faction parent col is wrong;
    # main_class is hard-coded on the design — derive it from the spec list.
    # For accuracy at sync time, prefer to read from a dedicated named range if/when added.
    # Until then, derive from the GoI Modifiers sheet's first column on a per-GoI basis.
    main_classes = _infer_main_classes(live_names, capture, classes)

    out_gois: list[dict[str, Any]] = []
    for live_pos, src_idx in enumerate(live_indices):
        wv_row = worldview[src_idx] if src_idx < len(worldview) else [None] * 6
        out_gois.append({
            "name": names[src_idx],
            "main_class": main_classes.get(names[src_idx]),
            "derived_influence": coerce_number(derived[src_idx][0]) if src_idx < len(derived) else None,
            "approval": coerce_number(approval[src_idx][0]) if src_idx < len(approval) else None,
            "approach": approach[src_idx][0] if src_idx < len(approach) else None,
            "mad_index": coerce_number(mad[src_idx][0]) if src_idx < len(mad) else None,
            "effective_worldview": {axis: coerce_number(wv_row[i]) for i, axis in enumerate(WORLDVIEW_AXES)},
            "active_benefits": _parse_active_benefits(
                benefits_raw[src_idx][0] if src_idx < len(benefits_raw) else None,
                names[src_idx],
                benefits_table,
            ),
            "sub_factions": _sub_factions_for(names[src_idx], sub_factions_block),
        })

    return {
        "gois": out_gois,
        "pop_capture_matrix": {
            "classes": [c[0] for c in classes],
            "gois": live_names,
            "values": _capture_values(capture, len(classes), live_indices),
        },
    }


_BENEFIT_COUNT_RE = re.compile(r"(\d+)\s*/\s*(\d+)")


def _parse_active_benefits(text, goi_name, benefits_table):
    if not text:
        return {"unlocked": 0, "total": 0, "unlocked_list": []}
    m = _BENEFIT_COUNT_RE.search(str(text))
    unlocked = int(m.group(1)) if m else 0
    total = int(m.group(2)) if m else 0
    matches = [r for r in benefits_table if r and r[0] == goi_name]
    unlocked_list = [r[2] for r in matches[:unlocked]]
    return {"unlocked": unlocked, "total": total, "unlocked_list": unlocked_list}


def _sub_factions_for(goi_name, block):
    """Filter sub-factions matching a parent GoI from the SubFactionsBlock.

    TODO (deferred from Task 26): Pin the sub-faction range against the live workbook.
    Spec §3.5 notes that backend CLAUDE.md and the actual built workbook disagreed
    (CLAUDE.md said rows 32-44, workbook had 24-36 cols U-AC). When the live Sheet is
    accessible, open it, locate the sub-faction names column, and update the
    `SubFactionsBlock` named range to match. If `SubFactionsBlock` already exists in
    the live workbook, prefer it. File an issue if the range diverges from the
    fixture's `Politics!$U$24:$Y$36`.
    """
    out = []
    for r in block:
        if not r or r[0] != goi_name:
            continue
        out.append({
            "name": r[1] if len(r) > 1 else None,
            "influence": coerce_number(r[2]) if len(r) > 2 else None,
            "approval": coerce_number(r[3]) if len(r) > 3 else None,
            "minor_goals": [r[4]] if (len(r) > 4 and r[4]) else [],
        })
    return out


def _infer_main_classes(live_names, capture_matrix, classes):
    """Best-effort: pick the class with the highest base capture for each GoI."""
    if not capture_matrix or not classes:
        return {}
    out = {}
    for j, name in enumerate(live_names):
        best_i = max(range(len(capture_matrix)), key=lambda i: coerce_number(capture_matrix[i][j]) or 0)
        out[name] = classes[best_i][0] if best_i < len(classes) else None
    return out


def _capture_values(capture, n_classes, live_indices):
    rows = []
    for i in range(n_classes):
        if i >= len(capture):
            rows.append([None] * len(live_indices))
            continue
        row = [coerce_number(capture[i][j]) for j in live_indices]
        rows.append(row)
    return rows
