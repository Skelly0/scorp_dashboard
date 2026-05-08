"""Extract data for the GoIs page.

Reads from the live workbook's slimmed Politics sheet (rows 4-11 = 8 GoI slots,
4 live + 4 reserved blanks). Per-row data is read by column offset since the
backend doesn't expose per-field named ranges. Sub-faction data is zipped from
the 4 separate `SubFaction*` named ranges on the Sub-Factions sheet.
"""
from __future__ import annotations

import logging
import re
from typing import Any

from extractors._common import coerce_number, filter_blank_rows, read_named_range

WORLDVIEW_AXES = ["expansion", "authority", "corporate", "technocratic", "faith", "materialist"]

_log = logging.getLogger(__name__)

# GoI block lives at Politics rows 4-11 (8 slots, 4 live + 4 reserved blank).
GOI_BLOCK_FIRST_ROW = 4
GOI_BLOCK_LAST_ROW = 11

# Column offsets within the Politics GoI block.
COL_NAME = 1            # A
COL_INFLUENCE = 2       # B  (GM Override)
COL_UNITY = 3           # C
COL_EFFECTIVE_STANCE = 4  # D
COL_VOTE_WEIGHT = 5     # E
COL_APPROVAL = 6        # F
COL_ACTIVE_BENEFITS = 8  # H  (text "0 / 3 benefits unlocked")
COL_WORLDVIEW_FIRST = 11  # K..P  (Expn, Auth, Corp, Tech, Faith, Mat)
COL_MAD_INDEX = 17      # Q
COL_APPROACH = 18       # R
COL_DERIVED_INFLUENCE = 19  # S


def extract(wb) -> dict[str, Any]:
    classes = filter_blank_rows(read_named_range(wb, "ClassTable"))
    capture = read_named_range(wb, "PopCaptureBase")
    benefits_table = read_named_range(wb, "GoIBenefitsTable")

    # Read the GoI block directly from Politics by column offset.
    rows = _read_politics_goi_rows(wb)

    # Determine live indices (rows where col A name resolves to a non-blank string).
    live_indices = [i for i, r in enumerate(rows) if r["name"] not in (None, "")]
    live_names = [rows[i]["name"] for i in live_indices]

    main_classes = _infer_main_classes(live_names, capture, classes)

    sub_factions_by_goi = _sub_factions_by_goi(wb)

    out_gois: list[dict[str, Any]] = []
    for src_idx in live_indices:
        r = rows[src_idx]
        out_gois.append({
            "name": r["name"],
            "main_class": main_classes.get(r["name"]),
            "derived_influence": r["derived_influence"],
            "approval": r["approval"],
            "approach": r["approach"],
            "mad_index": r["mad_index"],
            "effective_worldview": r["worldview"],
            "active_benefits": _parse_active_benefits(
                r["active_benefits_text"], r["name"], benefits_table
            ),
            "sub_factions": sub_factions_by_goi.get(r["name"], []),
        })

    return {
        "gois": out_gois,
        "pop_capture_matrix": {
            "classes": [c[0] for c in classes],
            "gois": live_names,
            "values": _capture_values(capture, len(classes), live_indices),
        },
    }


def _read_politics_goi_rows(wb):
    """Read Politics GoI block rows 4-11 by column offset."""
    if "Politics" not in wb.sheetnames:
        return []
    ws = wb["Politics"]
    out = []
    for row_num in range(GOI_BLOCK_FIRST_ROW, GOI_BLOCK_LAST_ROW + 1):
        worldview = {
            axis: coerce_number(ws.cell(row=row_num, column=COL_WORLDVIEW_FIRST + i).value)
            for i, axis in enumerate(WORLDVIEW_AXES)
        }
        out.append({
            "name": ws.cell(row=row_num, column=COL_NAME).value,
            "approval": coerce_number(ws.cell(row=row_num, column=COL_APPROVAL).value),
            "approach": ws.cell(row=row_num, column=COL_APPROACH).value,
            "mad_index": coerce_number(ws.cell(row=row_num, column=COL_MAD_INDEX).value),
            "derived_influence": coerce_number(ws.cell(row=row_num, column=COL_DERIVED_INFLUENCE).value),
            "worldview": worldview,
            "active_benefits_text": ws.cell(row=row_num, column=COL_ACTIVE_BENEFITS).value,
        })
    return out


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


def _subfaction_worldviews_by_pair(wb):
    """Read SubFactionDetail and return {(goi, sf_name): {axis: value}} map.

    SubFactionDetail layout (16 cols on the Sub-Faction Detail sheet):
      0: GoI, 1: Sub-faction, 2: Influence, 3: Goal Axis, 4: Goal Δ,
      5-10: Expansion/Authority/Corporate/Technocratic/Faith/Materialist
            (effective stance — base + Δ if axis matches),
      11: Approval (mirror — ignored; SubFactionApprovals is authoritative),
      12-14: Minor Goals (mirror — ignored),
      15: National Share (mirror — ignored).

    Defensive zip: keyed by (GoI, sub-faction) name pair, NOT row index.
    Backend invariant promises row alignment with SubFactionGoals, but a single
    inserted row would silently corrupt every downstream worldview, so we never
    rely on positional correspondence across two separate sheets.
    """
    rows = read_named_range(wb, "SubFactionDetail")
    if not rows:
        return {}
    out: dict[tuple[str, str], dict[str, float | None]] = {}
    for r in rows:
        if not r or len(r) < 11:
            continue
        goi_name, sf_name = r[0], r[1]
        if not goi_name or not sf_name:
            continue
        out[(goi_name, sf_name)] = {
            axis: coerce_number(r[5 + i])
            for i, axis in enumerate(WORLDVIEW_AXES)
        }
    return out


def _sub_factions_by_goi(wb):
    """Zip the SubFaction* named ranges into per-GoI lists.

    Sub-Factions sheet layout (live wb):
      A: GoI, B: SF name, C: Goal Axis, D: Goal Δ, E: Goal text,
      F: Influence, G-I: Minor Goals, J: Approval, L: National Share.

    SubFactionDetail (separate sheet) is keyed by (GoI, SF name) pair so silent
    row drift between the two sheets cannot misalign worldviews.
    """
    goals = read_named_range(wb, "SubFactionGoals")
    influences = read_named_range(wb, "SubFactionInfluences")
    minor_goals = read_named_range(wb, "SubFactionMinorGoals")
    approvals = read_named_range(wb, "SubFactionApprovals")
    goals_text = read_named_range(wb, "SubFactionGoal")
    national_shares = read_named_range(wb, "SubFactionNationalShare")
    detail_map = _subfaction_worldviews_by_pair(wb)

    by_goi: dict[str, list[dict[str, Any]]] = {}
    for i, gr in enumerate(goals):
        if not gr or not gr[0]:
            continue
        goi_name = gr[0]
        sf_name = gr[1] if len(gr) > 1 else None
        infl = (
            coerce_number(influences[i][0])
            if i < len(influences) and influences[i]
            else None
        )
        appr = (
            coerce_number(approvals[i][0])
            if i < len(approvals) and approvals[i]
            else None
        )
        mgs = []
        if i < len(minor_goals) and minor_goals[i]:
            mgs = [g for g in minor_goals[i] if g not in (None, "")]
        goal_text = (
            goals_text[i][0]
            if i < len(goals_text) and goals_text[i]
            else None
        )
        if goal_text == "":
            goal_text = None
        nat_share = (
            coerce_number(national_shares[i][0])
            if i < len(national_shares) and national_shares[i]
            else None
        )
        worldview = detail_map.get((goi_name, sf_name))
        if worldview is None and detail_map:
            # The Detail sheet has data, but no row matches this (goi, sf) pair.
            _log.warning(
                "SubFactionDetail has no matching row for (%s, %s); "
                "effective_worldview will be null for this sub-faction",
                goi_name, sf_name,
            )

        by_goi.setdefault(goi_name, []).append({
            "name": sf_name,
            "influence": infl,
            "approval": appr,
            "minor_goals": mgs,
            "goal": goal_text,
            "national_share": nat_share,
            "effective_worldview": worldview,
        })
    return by_goi


def _infer_main_classes(live_names, capture_matrix, classes):
    """Best-effort: pick the class with the highest base capture for each GoI."""
    if not capture_matrix or not classes:
        return {}
    out = {}
    for j, name in enumerate(live_names):
        if j >= len(capture_matrix[0] if capture_matrix else []):
            out[name] = None
            continue
        best_i = max(range(len(capture_matrix)), key=lambda i: coerce_number(capture_matrix[i][j]) or 0)
        out[name] = classes[best_i][0] if best_i < len(classes) else None
    return out


def _capture_values(capture, n_classes, live_indices):
    rows = []
    for i in range(n_classes):
        if i >= len(capture):
            rows.append([None] * len(live_indices))
            continue
        row = [
            coerce_number(capture[i][j]) if j < len(capture[i]) else None
            for j in live_indices
        ]
        rows.append(row)
    return rows
