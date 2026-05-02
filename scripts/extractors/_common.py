"""Shared helpers for sheet extractors."""
from __future__ import annotations

from typing import Any

FORMULA_ERROR_SENTINELS = {
    "#REF!",
    "#NAME?",
    "#VALUE!",
    "#DIV/0!",
    "#N/A",
    "#NULL!",
    "#NUM!",
}


def read_named_range(wb, name: str) -> list[list[Any]]:
    """Resolve a named range to a list-of-lists of cell values.

    Returns [] when the name does not exist (caller decides whether that's fatal).
    """
    if name not in wb.defined_names:
        return []
    dn = wb.defined_names[name]
    rows: list[list[Any]] = []
    for sheet_name, ref in dn.destinations:
        ws = wb[sheet_name]
        target = ws[ref]
        # Single-cell ranges return a Cell; multi-cell return a tuple of tuples of Cells.
        if hasattr(target, "value"):
            rows.append([target.value])
            continue
        for row in target:
            # A single-row, multi-column slice returns a tuple of Cells (not nested).
            if hasattr(row, "value"):
                rows.append([row.value])
            else:
                rows.append([cell.value for cell in row])
    return rows


def filter_blank_rows(rows: list[list[Any]]) -> list[list[Any]]:
    """Drop rows whose first column is empty/None — convention for blank slots."""
    return [r for r in rows if r and r[0] not in (None, "")]


def coerce_number(value: Any) -> float | None:
    """Cast to float; None for blanks and formula-error sentinels."""
    if value is None or value == "":
        return None
    if isinstance(value, str) and value in FORMULA_ERROR_SENTINELS:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
