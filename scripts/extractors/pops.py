"""Extract data for the Pops Detailed (per-class drilldown) page."""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, filter_blank_rows, read_named_range

# Column order of PopsimSatisfactionFullTable (no headers in the named range
# itself — these are the implicit column meanings). Order is contractual: the
# frontend renders them in this order, and the workbook column layout MUST
# match. New sources go on the right.
SATISFACTION_SOURCES = (
    "food",
    "housing",
    "employment",
    "ownership",
    "services",
    "faith",
    "entertainment",
    "tax",
    "wages",
    "safety",
    "situations",
)

CONSUMPTION_BLOCKS = {
    "water": "WATER DEMAND BY CLASS",
    "energy": "ENERGY DEMAND BY CLASS",
    "materials": "MATERIALS DEMAND BY CLASS",
}


def extract(wb) -> dict[str, Any]:
    classes = filter_blank_rows(read_named_range(wb, "ClassTable"))
    pops = read_named_range(wb, "PopsimPop")

    sol = read_named_range(wb, "PopsimSoL")
    expected_sol = read_named_range(wb, "PopsimExpectedSoL")
    sp = read_named_range(wb, "PopsimSocialPrivileges")
    gross = read_named_range(wb, "PopsimGrossPerCap")
    disposable = read_named_range(wb, "PopsimDisposablePerCap")
    wealth_pc = read_named_range(wb, "PopsimWealthPerCap")
    radical = read_named_range(wb, "PopsimRadicalisation")
    poverty = read_named_range(wb, "PopsimAbjectPoverty")
    org = read_named_range(wb, "PopsimOrganisation")
    lit = read_named_range(wb, "PopsimLiteracy")
    votes_total = read_named_range(wb, "PopsimVotesTotal")
    vote_share = read_named_range(wb, "PopsimVoteShare")
    sat = read_named_range(wb, "PopsimSatisfaction")
    sat_full = read_named_range(wb, "PopsimSatisfactionFullTable")
    mortality_rates = read_named_range(wb, "MortalityRates")
    deaths_per_turn = read_named_range(wb, "DeathsPerTurn")
    births_per_turn = read_named_range(wb, "ClassBirths")
    mobility_in = read_named_range(wb, "PopsimMobilityIn")
    mobility_out = read_named_range(wb, "PopsimMobilityOut")
    unemployed_count = read_named_range(wb, "PopsimUnemployed")
    add_income = _read_additional_income_breakdown(wb)
    consumption = _read_consumption_by_class(wb, len(classes))

    # WealthIncomePerClass: A:J × 15 rows. Column offsets within each row:
    #   3=D income tax/cap, 4=E wealth tax/cap, 5=F effective rate, 9=J total post-tax.
    wealth_income = read_named_range(wb, "WealthIncomePerClass")

    # WorkforceSupplyDemand: A:E × 14 rows. Indexed by class name (col 0)
    # because the row order isn't guaranteed to match ClassTable.
    workforce_by_class = _index_workforce(read_named_range(wb, "WorkforceSupplyDemand"))
    weekly_hours_by_class = _index_weekly_hours(read_named_range(wb, "WeeklyHoursWorkedTable"))

    out: list[dict[str, Any]] = []
    for i, row in enumerate(classes):
        name = row[0]
        pop = coerce_number(pops[i][0]) if i < len(pops) else None
        if pop is None:
            continue
        g = coerce_number(gross[i][0]) if i < len(gross) else None
        d = coerce_number(disposable[i][0]) if i < len(disposable) else None
        wi_row = wealth_income[i] if i < len(wealth_income) else []
        workforce = {
            **workforce_by_class.get(name, _empty_workforce()),
            "weekly_hours_worked": weekly_hours_by_class.get(name),
        }
        out.append({
            "name": name,
            "pop": int(pop),
            "standard_of_living": coerce_number(sol[i][0]) if i < len(sol) else None,
            "expected_sol": coerce_number(expected_sol[i][0]) if i < len(expected_sol) else None,
            "social_privileges": coerce_number(sp[i][0]) if i < len(sp) else None,
            "income": {
                "gross_per_cap": g,
                "total_gross": (pop * g) if (pop is not None and g is not None) else None,
                "income_tax_per_cap": _at(wi_row, 3),
                "wealth_tax_per_cap": _at(wi_row, 4),
                "effective_tax_rate": _at(wi_row, 5),
                "disposable_per_cap": d,
                "total_disposable": _at(wi_row, 9),
            },
            "wealth": {
                "per_cap": coerce_number(wealth_pc[i][0]) if i < len(wealth_pc) else None,
                "total": (coerce_number(wealth_pc[i][0]) * pop) if (i < len(wealth_pc) and wealth_pc[i][0] is not None) else None,
            },
            "additional_income": _additional_income_row(add_income, i),
            "consumption": consumption[i] if i < len(consumption) else _empty_consumption(),
            "status": {
                "radicalisation": coerce_number(radical[i][0]) if i < len(radical) else None,
                "abject_poverty": coerce_number(poverty[i][0]) if i < len(poverty) else None,
                "organisation": coerce_number(org[i][0]) if i < len(org) else None,
                "literacy": coerce_number(lit[i][0]) if i < len(lit) else None,
                "votes_total": coerce_number(votes_total[i][0]) if i < len(votes_total) else None,
                "vote_share": coerce_number(vote_share[i][0]) if i < len(vote_share) else None,
            },
            "workforce": workforce,
            "satisfaction": coerce_number(sat[i][0]) if i < len(sat) else None,
            "satisfaction_breakdown": _satisfaction_breakdown_row(sat_full, i),
            "mortality_rate": coerce_number(mortality_rates[i][0]) if i < len(mortality_rates) else None,
            "deaths_per_turn": coerce_number(deaths_per_turn[i][0]) if i < len(deaths_per_turn) else None,
            "births_per_turn": coerce_number(births_per_turn[i][0]) if i < len(births_per_turn) else None,
            "mobility_in": coerce_number(mobility_in[i][0]) if i < len(mobility_in) else None,
            "mobility_out": coerce_number(mobility_out[i][0]) if i < len(mobility_out) else None,
            "unemployed_count": coerce_number(unemployed_count[i][0]) if i < len(unemployed_count) else None,
        })

    return {"classes": out}


def _at(row, idx):
    if idx >= len(row):
        return None
    return coerce_number(row[idx])


def _satisfaction_breakdown_row(table, i):
    """Return a 1:1 source→value dict for class index `i`. Missing rows or
    short rows yield None per source — frontend renders `—`."""
    row = table[i] if i < len(table) else []
    return {key: _at(row, idx) for idx, key in enumerate(SATISFACTION_SOURCES)}


def _empty_workforce():
    return {
        "supply": None,
        "demand": None,
        "fill_ratio": None,
        "unemployment": None,
        "weekly_hours_worked": None,
    }


def _index_workforce(rows) -> dict[str, dict[str, float | None]]:
    out: dict[str, dict[str, float | None]] = {}
    for r in rows:
        if not r or not r[0]:
            continue
        name = r[0]
        out[name] = {
            "supply": coerce_number(r[1]) if len(r) > 1 else None,
            "demand": coerce_number(r[2]) if len(r) > 2 else None,
            "fill_ratio": coerce_number(r[3]) if len(r) > 3 else None,
            "unemployment": coerce_number(r[4]) if len(r) > 4 else None,
        }
    return out


def _index_weekly_hours(rows) -> dict[str, float | None]:
    """Index the GoI Modifiers hours table by class name.

    The named range intentionally covers only class + baseline/current hours,
    not the union-capture columns that sit to the right in the workbook.
    """
    if not rows:
        return {}
    header = [str(v).strip().lower() if v is not None else "" for v in rows[0]]
    class_idx = _header_idx(header, "class", 0)
    current_idx = _header_idx(header, "current hours/wk", 2)

    out: dict[str, float | None] = {}
    for r in rows[1:]:
        if len(r) <= class_idx or not r[class_idx]:
            continue
        name = str(r[class_idx]).strip()
        out[name] = coerce_number(r[current_idx]) if len(r) > current_idx else None
    return out


def _header_idx(header: list[str], label: str, fallback: int) -> int:
    try:
        return header.index(label)
    except ValueError:
        return fallback


def _additional_income_row(rows, i):
    if i >= len(rows):
        return {"welfare": None, "dividends": None, "subsidies": None, "other": None, "total": None}
    r = rows[i]
    return {
        "welfare": coerce_number(r[1]) if len(r) > 1 else None,
        "dividends": coerce_number(r[2]) if len(r) > 2 else None,
        "subsidies": coerce_number(r[3]) if len(r) > 3 else None,
        "other": coerce_number(r[4]) if len(r) > 4 else None,
        "total": coerce_number(r[5]) if len(r) > 5 else None,
    }


def _read_additional_income_breakdown(wb):
    """Read Wages & Welfare!A23:F37 directly (no named range exists for the
    full 6-col breakdown; the live workbook only names the 2-col mirror).
    Returns rows in the same shape `_additional_income_row` expects:
    [class_name, welfare, dividends, subsidies, other, total]."""
    if "Wages & Welfare" not in wb.sheetnames:
        return []
    ws = wb["Wages & Welfare"]
    rows = []
    for r in range(23, 38):  # 15 class slots
        rows.append([ws.cell(row=r, column=c).value for c in range(1, 7)])
    return rows


def _empty_consumption():
    return {
        key: {"per_cap": None, "total_per_turn": None}
        for key in CONSUMPTION_BLOCKS
    }


def _read_consumption_by_class(wb, class_count: int):
    """Read Consumption sheet blocks by class row order.

    The live Consumption tab's class-name formulas can drift to #REF!, while
    the per-cap and total demand cells remain valid and row-aligned with
    ClassTable. Use ClassTable order from the caller instead of matching on
    the broken class-name cells.
    """
    rows = [_empty_consumption() for _ in range(class_count)]
    if "Consumption" not in wb.sheetnames:
        return rows

    ws = wb["Consumption"]
    title_rows: dict[str, int] = {}
    for sheet_row in range(1, min(ws.max_row, 200) + 1):
        value = ws.cell(row=sheet_row, column=1).value
        if value is None:
            continue
        title = str(value).strip().upper()
        for key, expected in CONSUMPTION_BLOCKS.items():
            if title == expected:
                title_rows[key] = sheet_row

    for key in CONSUMPTION_BLOCKS:
        title_row = title_rows.get(key)
        if title_row is None:
            continue
        data_start = title_row + 2
        for i in range(class_count):
            sheet_row = data_start + i
            rows[i][key] = {
                "per_cap": coerce_number(ws.cell(row=sheet_row, column=3).value),
                "total_per_turn": coerce_number(ws.cell(row=sheet_row, column=4).value),
            }
    return rows
