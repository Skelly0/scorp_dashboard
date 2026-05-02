"""Tests for the Map page extractor."""
from __future__ import annotations

from extractors.map import extract


def test_extract_dimensions(wb):
    result = extract(wb)
    assert result["width"] == 40
    assert result["height"] == 40
    assert len(result["tiles"]) == 1600


def test_extract_tile_record_shape(wb):
    result = extract(wb)
    # Tile (0, 0) — top-left corner
    t = result["tiles"][0]
    assert t["x"] == 0
    assert t["y"] == 0
    assert t["terrain"] in {"Crater Floor", "Mare Plain"}
    assert t["feature"] is None
    assert t["resource"] is None
    assert t["slots"] == 2
    assert t["improvement"] is None
    assert "yields" in t
    assert set(t["yields"].keys()) == {"food", "materials", "ore", "energy", "housing", "water"}


def test_extract_seeded_he3_tile(wb):
    """Tile at (9, 9) — 0-indexed coords for sheet row 10, col 10."""
    result = extract(wb)
    tile = next(t for t in result["tiles"] if t["x"] == 9 and t["y"] == 9)
    assert tile["resource"] == "He-3"
    assert tile["improvement"] is not None
    assert tile["improvement"]["name"] == "Helium-3 Mine"
    assert tile["improvement"]["owner"] == "Lunar Extractives"
    assert tile["improvement"]["ownership_type"] == "Corporate"
    assert tile["yields"]["energy"] == -1


def test_extract_includes_palette(wb):
    result = extract(wb)
    assert "palettes" in result
    assert "terrain" in result["palettes"]
    assert result["palettes"]["terrain"]["Crater Floor"] == "#5a4a3a"
