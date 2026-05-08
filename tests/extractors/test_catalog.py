"""Tests for the ImprovementsCatalog extractor."""
from __future__ import annotations

import logging

from extractors.catalog import extract


def test_extract_returns_improvements_list(wb):
    result = extract(wb)
    assert "improvements" in result
    assert isinstance(result["improvements"], list)


def test_extract_skips_blank_name_row(wb):
    result = extract(wb)
    names = [imp["name"] for imp in result["improvements"]]
    assert "Solar Array Field" in names
    assert "Hydroponic Farm" in names
    assert "Heat Pump" in names
    assert None not in names
    assert "" not in names
    assert len(names) == 3


def test_extract_solar_field_row(wb):
    result = extract(wb)
    solar = next(i for i in result["improvements"] if i["name"] == "Solar Array Field")
    assert solar["category"] == "energy"
    assert solar["category_raw"] == "Energy"
    assert solar["costs"] == {"materials": 100, "ore": 0, "engineering": 50, "money": 200}
    assert solar["yields"]["energy"] == 200
    assert solar["yields"]["food"] == 0
    assert solar["upkeep"]["materials"] == 1
    assert solar["workforce"]["engineers"] == 2
    assert solar["splits"] == {"greens": None, "cereal": None,
                               "vat_protein": None, "algal_paste": None}
    assert solar["terrain_compat"] == "Mare Plain · Highlands"
    assert solar["ownership_options"] == "Public · Private"


def test_extract_blank_category_falls_through(wb):
    result = extract(wb)
    farm = next(i for i in result["improvements"] if i["name"] == "Hydroponic Farm")
    assert farm["category"] is None
    assert farm["category_raw"] is None
    assert farm["splits"]["greens"] == 0.6
    assert farm["splits"]["vat_protein"] == 0.4
    assert farm["yields"]["food"] == 500
    assert farm["yields"]["water"] == -50


def test_extract_unknown_category_logs_warning_and_maps_to_other(wb, caplog):
    with caplog.at_level(logging.WARNING, logger="extractors.catalog"):
        result = extract(wb)
    pump = next(i for i in result["improvements"] if i["name"] == "Heat Pump")
    assert pump["category"] == "other"
    assert pump["category_raw"] == "Power"
    assert any("Power" in r.message and "Heat Pump" in r.message
               for r in caplog.records)


def test_extract_zeros_preserved_blanks_coerced_to_zero(wb):
    """Numeric blanks coerce to 0 (per spec) — not None."""
    result = extract(wb)
    solar = next(i for i in result["improvements"] if i["name"] == "Solar Array Field")
    assert solar["yields"]["food"] == 0
    assert solar["yields"]["materials"] == 0
    assert solar["workforce"]["bureaucrats"] == 0


def test_extract_with_missing_range_returns_empty():
    """If ImprovementsCatalog isn't defined, extract returns empty list."""
    import openpyxl
    blank_wb = openpyxl.Workbook()
    result = extract(blank_wb)
    assert result == {"improvements": []}
