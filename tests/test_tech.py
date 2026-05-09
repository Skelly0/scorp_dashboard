"""Tests for the Tech & Institutions extractor."""
from __future__ import annotations

import openpyxl
import pytest

from extractors import tech as ex_tech


def test_extract_returns_techs_and_branches(wb):
    out = ex_tech.extract(wb)
    assert "techs" in out
    assert "branches" in out
    assert isinstance(out["techs"], list)
    assert isinstance(out["branches"], list)


def test_extract_skips_blank_name_rows(wb):
    out = ex_tech.extract(wb)
    names = [t["name"] for t in out["techs"]]
    assert None not in names
    assert "" not in names
    # Fixture has 4 named techs in R4-R7; R8 is blank-name and must be skipped.
    assert len(out["techs"]) == 4


def test_extract_parses_top_level_fields(wb):
    out = ex_tech.extract(wb)
    by_name = {t["name"]: t for t in out["techs"]}
    h = by_name["Hydroponic Optimization"]
    assert h["branch"] == "Agriculture"
    assert h["tier"] == 1
    assert h["cost_rp"] == 100
    assert h["prereqs"] == []
    assert h["researched"] is False
    assert h["available"] is True
    assert h["description"].startswith("Refined nutrient cycles")


def test_extract_collects_prereqs(wb):
    out = ex_tech.extract(wb)
    by_name = {t["name"]: t for t in out["techs"]}
    assert by_name["Aeroponic Refinement"]["prereqs"] == ["Hydroponic Optimization"]
    assert by_name["Synthetic Biomes"]["prereqs"] == [
        "Aeroponic Refinement", "Materials Science",
    ]


def test_extract_coalesces_effects_dropping_blank_targets(wb):
    out = ex_tech.extract(wb)
    by_name = {t["name"]: t for t in out["techs"]}

    # Hydroponic Optimization: 2 effects.
    h_effects = by_name["Hydroponic Optimization"]["effects"]
    assert len(h_effects) == 2
    assert h_effects[0] == {
        "target": "Hydroponic Bay", "type": "yield",
        "type_raw": "Yield", "mag": 0.20,
    }
    assert h_effects[1] == {
        "target": "Hydroponic Bay", "type": "workforce",
        "type_raw": "Workforce", "mag": -0.10,
    }

    # Aeroponic Refinement: 1 effect.
    assert len(by_name["Aeroponic Refinement"]["effects"]) == 1

    # Standardized Tooling: 3 effects.
    assert len(by_name["Standardized Tooling"]["effects"]) == 3


def test_extract_researched_bool_coercion(wb):
    out = ex_tech.extract(wb)
    by_name = {t["name"]: t for t in out["techs"]}
    assert by_name["Standardized Tooling"]["researched"] is True
    assert by_name["Hydroponic Optimization"]["researched"] is False


def test_extract_branches_canonical_order(wb):
    out = ex_tech.extract(wb)
    # Fixture has Agriculture and Industry techs only; canonical order
    # places Agriculture before Industry.
    assert out["branches"] == ["Agriculture", "Industry"]


def test_extract_returns_empty_when_range_missing(wb):
    del wb.defined_names["TechTable"]
    out = ex_tech.extract(wb)
    assert out == {"techs": [], "branches": []}


def test_extract_logs_unknown_effect_type(wb, caplog):
    # Mutate the fixture: change Hydroponic Optimization's effect 1 type to 'Stability'.
    ws = wb["Tech & Institutions"]
    ws.cell(row=4, column=10, value="Stability")  # Effect 1 — Type column

    import logging
    with caplog.at_level(logging.WARNING, logger="extractors.tech"):
        out = ex_tech.extract(wb)

    by_name = {t["name"]: t for t in out["techs"]}
    eff = by_name["Hydroponic Optimization"]["effects"][0]
    assert eff["type"] == "stability"
    assert eff["type_raw"] == "Stability"
    assert any("unknown effect type 'Stability'" in r.getMessage() for r in caplog.records)


def test_extract_canonicalises_unknown_branch_at_end(wb):
    # Mutate the fixture: change one tech's branch to a novel value.
    ws = wb["Tech & Institutions"]
    ws.cell(row=7, column=2, value="Logistics")  # Synthetic Biomes → Logistics
    out = ex_tech.extract(wb)
    # Canonical branches first, unknown branches appended in encounter order.
    assert out["branches"] == ["Agriculture", "Industry", "Logistics"]
