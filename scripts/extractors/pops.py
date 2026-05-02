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
    add_income = read_named_range(wb, "AdditionalIncomeBreakdown")

    # Read tax/cap & effective-rate via direct cell access — these aren't named ranges
    # but live at known offsets in the Wealth & Income block (rows 61-75).
    income_tax = [coerce_number(wb["Popsim"].cell(row=61 + i, column=4).value) for i in range(15)]
    wealth_tax = [coerce_number(wb["Popsim"].cell(row=61 + i, column=5).value) for i in range(15)]
    effective_rate = [coerce_number(wb["Popsim"].cell(row=61 + i, column=6).value) for i in range(15)]
    total_post_tax = [coerce_number(wb["Popsim"].cell(row=61 + i, column=10).value) for i in range(15)]

    out: list[dict[str, Any]] = []
    for i, row in enumerate(classes):
        name = row[0]
        pop = coerce_number(pops[i][0]) if i < len(pops) else None
        if pop is None:
            continue
        g = coerce_number(gross[i][0]) if i < len(gross) else None
        d = coerce_number(disposable[i][0]) if i < len(disposable) else None
        out.append({
            "name": name,
            "pop": int(pop),
            "standard_of_living": coerce_number(sol[i][0]) if i < len(sol) else None,
            "expected_sol": coerce_number(expected_sol[i][0]) if i < len(expected_sol) else None,
            "social_privileges": coerce_number(sp[i][0]) if i < len(sp) else None,
            "income": {
                "gross_per_cap": g,
                "total_gross": (pop * g) if (pop is not None and g is not None) else None,
                "income_tax_per_cap": income_tax[i],
                "wealth_tax_per_cap": wealth_tax[i],
                "effective_tax_rate": effective_rate[i],
                "disposable_per_cap": d,
                "total_disposable": total_post_tax[i],
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
            "satisfaction": coerce_number(sat[i][0]) if i < len(sat) else None,
        })

    return {"classes": out}


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
