"""Extract data for the Pops Detailed (per-class drilldown) page."""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, filter_blank_rows, read_named_range


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
    add_income = _read_additional_income_breakdown(wb)

    # WealthIncomePerClass: A:J × 15 rows. Column offsets within each row:
    #   3=D income tax/cap, 4=E wealth tax/cap, 5=F effective rate, 9=J total post-tax.
    wealth_income = read_named_range(wb, "WealthIncomePerClass")

    # WorkforceSupplyDemand: A:E × 14 rows. Indexed by class name (col 0)
    # because the row order isn't guaranteed to match ClassTable.
    workforce_by_class = _index_workforce(read_named_range(wb, "WorkforceSupplyDemand"))

    out: list[dict[str, Any]] = []
    for i, row in enumerate(classes):
        name = row[0]
        pop = coerce_number(pops[i][0]) if i < len(pops) else None
        if pop is None:
            continue
        g = coerce_number(gross[i][0]) if i < len(gross) else None
        d = coerce_number(disposable[i][0]) if i < len(disposable) else None
        wi_row = wealth_income[i] if i < len(wealth_income) else []
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
            "status": {
                "radicalisation": coerce_number(radical[i][0]) if i < len(radical) else None,
                "abject_poverty": coerce_number(poverty[i][0]) if i < len(poverty) else None,
                "organisation": coerce_number(org[i][0]) if i < len(org) else None,
                "literacy": coerce_number(lit[i][0]) if i < len(lit) else None,
                "votes_total": coerce_number(votes_total[i][0]) if i < len(votes_total) else None,
                "vote_share": coerce_number(vote_share[i][0]) if i < len(vote_share) else None,
            },
            "workforce": workforce_by_class.get(name, _empty_workforce()),
            "satisfaction": coerce_number(sat[i][0]) if i < len(sat) else None,
        })

    return {"classes": out}


def _at(row, idx):
    if idx >= len(row):
        return None
    return coerce_number(row[idx])


def _empty_workforce():
    return {"supply": None, "demand": None, "fill_ratio": None, "unemployment": None}


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
