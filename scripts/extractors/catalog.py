"""Extract the ImprovementsCatalog reference table.

The named range is a 2D block: header row at the top, one row per improvement.
Headers are matched by name (not column index) so the GM can reorder columns
without breaking the player view. Unknown headers are silently dropped.

Soft-optional: missing range → returns {'improvements': []}, sync still
succeeds, frontend hides the catalog UI.
"""
from __future__ import annotations

import logging
from typing import Any

from extractors._common import coerce_number, read_named_range

_log = logging.getLogger(__name__)

# Canonical 8-slug set used by improvement-categories.js + map palette keys.
_KNOWN_SLUGS = {"energy", "mining", "habitat", "civic",
                "military", "agri", "science", "other"}

# Header → output-key mapping. Anything not listed here is silently dropped.
HEADER_KEYS: dict[str, tuple[str, str]] = {
    "Mat Cost":              ("costs", "materials"),
    "Ore Cost":              ("costs", "ore"),
    "Eng Cost":              ("costs", "engineering"),
    "$ Cost":                ("costs", "money"),
    "Yield: Food":           ("yields", "food"),
    "Yield: Materials":      ("yields", "materials"),
    "Yield: Ore":            ("yields", "ore"),
    "Yield: Energy":         ("yields", "energy"),
    "Yield: Housing":        ("yields", "housing"),
    "Yield: Money":          ("yields", "money"),
    "Yield: Helium 3":       ("yields", "helium3"),
    "Yield: Water":          ("yields", "water"),
    "Yield: Stability":      ("yields", "stability"),
    "Yield: Satisfaction All": ("yields", "satisfaction_all"),
    "Yield: Research":       ("yields", "research"),
    "Upkeep: Energy":        ("upkeep", "energy"),
    "Upkeep: Materials":     ("upkeep", "materials"),
    "Upkeep: Money":         ("upkeep", "money"),
    "Upkeep: Ore":           ("upkeep", "ore"),
    "Upkeep: Water":         ("upkeep", "water"),
    "Workforce: Bureaucrats":     ("workforce", "bureaucrats"),
    "Workforce: Capitalists":     ("workforce", "capitalists"),
    "Workforce: Engineers":       ("workforce", "engineers"),
    "Workforce: Scientists":      ("workforce", "scientists"),
    "Workforce: Security":        ("workforce", "security"),
    "Workforce: Proprietors":     ("workforce", "proprietors"),
    "Workforce: Managerial":      ("workforce", "managerial"),
    "Workforce: Botanists":       ("workforce", "botanists"),
    "Workforce: Industrial Workers":  ("workforce", "industrial_workers"),
    "Workforce: Extraction Workers":  ("workforce", "extraction_workers"),
    "Workforce: Service Workers":     ("workforce", "service_workers"),
    "Split: Greens":         ("splits", "greens"),
    "Split: Cereal":         ("splits", "cereal"),
    "Split: Vat Protein":    ("splits", "vat_protein"),
    "Split: Algal Paste":    ("splits", "algal_paste"),
}

_TOP_STRING_HEADERS: dict[str, str] = {
    "Name": "name",
    "Terrain Compatibility (notes)": "terrain_compat",
    "Ownership Options (notes)": "ownership_options",
}


def extract(wb) -> dict[str, Any]:
    rows = read_named_range(wb, "ImprovementsCatalog")
    if not rows or len(rows) < 2:
        return {"improvements": []}

    header_row = [_norm_header(h) for h in rows[0]]
    out: list[dict[str, Any]] = []

    for row in rows[1:]:
        name = _value_for_header(row, header_row, "Name")
        if name in (None, ""):
            continue

        rec = _empty_record(name)

        for header, raw in zip(header_row, row):
            if not header:
                continue
            if header in _TOP_STRING_HEADERS:
                key = _TOP_STRING_HEADERS[header]
                if key == "name":
                    continue  # already set
                rec[key] = raw if raw not in ("", None) else None
                continue
            if header == "Category":
                slug, raw_str = _slugify_category(raw, name)
                rec["category"] = slug
                rec["category_raw"] = raw_str
                continue
            mapping = HEADER_KEYS.get(header)
            if mapping is None:
                continue
            section, key = mapping
            num = coerce_number(raw)
            if section == "splits":
                rec["splits"][key] = num
            else:
                rec[section][key] = 0 if num is None else num

        out.append(rec)

    return {"improvements": out}


def _norm_header(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split())


def _value_for_header(row, header_row, header: str):
    for i, h in enumerate(header_row):
        if h == header:
            return row[i] if i < len(row) else None
    return None


def _empty_record(name: str) -> dict[str, Any]:
    return {
        "name": name,
        "category": None,
        "category_raw": None,
        "costs":   {"materials": 0, "ore": 0, "engineering": 0, "money": 0},
        "yields":  {"food": 0, "materials": 0, "ore": 0, "energy": 0,
                    "housing": 0, "money": 0, "helium3": 0, "water": 0,
                    "stability": 0, "satisfaction_all": 0, "research": 0},
        "upkeep":  {"energy": 0, "materials": 0, "money": 0, "ore": 0, "water": 0},
        "workforce": {"bureaucrats": 0, "capitalists": 0, "engineers": 0,
                      "scientists": 0, "security": 0, "proprietors": 0,
                      "managerial": 0, "botanists": 0,
                      "industrial_workers": 0, "extraction_workers": 0,
                      "service_workers": 0},
        "splits": {"greens": None, "cereal": None,
                   "vat_protein": None, "algal_paste": None},
        "terrain_compat": None,
        "ownership_options": None,
    }


def _slugify_category(raw: Any, row_name: str) -> tuple[str | None, str | None]:
    if raw is None or raw == "":
        return None, None
    raw_str = str(raw)
    cleaned = raw_str.strip().lower()
    if cleaned in _KNOWN_SLUGS:
        return cleaned, raw_str
    if cleaned == "agriculture":
        return "agri", raw_str
    _log.warning("unknown category '%s' on '%s'", raw_str, row_name)
    return "other", raw_str
