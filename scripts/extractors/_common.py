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


def scalar_named(wb, name: str) -> float | None:
    """Read a single-cell named range as a coerced float; None when the range
    is missing, empty, or holds a formula error."""
    rows = read_named_range(wb, name)
    if not rows or not rows[0]:
        return None
    return coerce_number(rows[0][0])


def population_total(wb) -> int:
    """Sum the PopsimPop named range, coercing each cell. Returns int (rounded
    via float→int truncation), or 0 when the range is missing/empty."""
    rows = read_named_range(wb, "PopsimPop")
    total = 0.0
    for row in rows:
        v = coerce_number(row[0])
        if v is not None:
            total += v
    return int(total)


def avg_satisfaction(wb) -> float | None:
    """Population-weighted mean of PopsimSatisfaction.

    Returns None when total population is zero or both ranges are
    missing — guards against div-by-zero on early-game / depopulated
    workbooks. Skips rows where either value is None.
    """
    sats = read_named_range(wb, "PopsimSatisfaction")
    pops = read_named_range(wb, "PopsimPop")
    weighted_sum = 0.0
    total_pop = 0.0
    for i in range(min(len(sats), len(pops))):
        sat = coerce_number(sats[i][0]) if sats[i] else None
        pop = coerce_number(pops[i][0]) if pops[i] else None
        if sat is None or pop is None:
            continue
        weighted_sum += sat * pop
        total_pop += pop
    return weighted_sum / total_pop if total_pop > 0 else None


def net_delta_pct(effective_growth: float | None, cdr: float | None) -> float | None:
    """Net population change as a percentage. None when either input is missing."""
    if effective_growth is None or cdr is None:
        return None
    return (effective_growth - cdr) * 100
