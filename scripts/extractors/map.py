"""Extract data for the Map page (40×40 tile grid, 11-layer composition)."""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, read_named_range

WIDTH = 40
HEIGHT = 40

YIELD_SHEETS = {
    "food": "Yield - Food",
    "materials": "Yield - Materials",
    "ore": "Yield - Ore",
    "energy": "Yield - Energy",
    "housing": "Yield - Housing",
    "water": "Yield - Water",
}


def extract(wb) -> dict[str, Any]:
    terrain = _read_grid(wb, "Terrain")
    features = _read_grid(wb, "Features")
    resources = _read_grid(wb, "Resources")
    slots = _read_grid(wb, "Slots")
    improvements = _read_grid(wb, "Improvements")
    yields = {key: _read_grid(wb, sheet) for key, sheet in YIELD_SHEETS.items()}

    manifest = _read_improvement_manifest(wb)

    tiles = []
    for y in range(HEIGHT):
        for x in range(WIDTH):
            terrain_v = _cell_str(terrain, x, y)
            feature_v = _cell_str(features, x, y)
            resource_v = _cell_str(resources, x, y)
            slots_v = _cell_int(slots, x, y)
            imp_id = _cell_str(improvements, x, y)
            tile_yields = {key: coerce_number(grid[y][x]) or 0 for key, grid in yields.items()}
            tiles.append({
                "x": x,
                "y": y,
                "terrain": terrain_v or None,
                "feature": feature_v or None,
                "resource": resource_v or None,
                "slots": slots_v,
                "improvement": _improvement_for(imp_id, x, y, manifest),
                "yields": tile_yields,
            })

    return {
        "width": WIDTH,
        "height": HEIGHT,
        "tiles": tiles,
        "palettes": {
            "terrain": _palette(wb, "TerrainPalette", TERRAIN_PALETTE),
            "resource": _palette(wb, "ResourcePalette", RESOURCE_PALETTE),
        },
    }


def _read_grid(wb, sheet_name):
    """Read a 40×40 grid. Uses iter_rows for ~10× speedup over per-cell .cell() calls."""
    ws = wb[sheet_name]
    grid = []
    for row in ws.iter_rows(min_row=1, max_row=HEIGHT, min_col=1, max_col=WIDTH, values_only=True):
        grid.append(list(row))
    return grid


def _cell_str(grid, x, y):
    """Return cell as string, treating None / "" / "Empty" as None.

    The live workbook fills empty Features/Resources/Improvements cells with the
    string "Empty" rather than leaving them blank, so we have to normalise that
    here — otherwise every tile renders a feature icon.
    """
    v = grid[y][x]
    if v is None or v == "" or v == "Empty":
        return None
    return str(v)


def _cell_int(grid, x, y):
    v = grid[y][x]
    return int(v) if isinstance(v, (int, float)) else None


def _read_improvement_manifest(wb):
    """Manifest in cols AO:AR starting row 5. Returns dict keyed by tile_id."""
    ws = wb["Improvements"]
    out = {}
    r = 5
    while True:
        tile = ws.cell(row=r, column=41).value
        if tile in (None, ""):
            break
        out[str(tile)] = {
            "name": ws.cell(row=r, column=42).value,
            "ownership_type": ws.cell(row=r, column=43).value,
            "owner": ws.cell(row=r, column=44).value,
        }
        r += 1
    return out


def _improvement_for(imp_id, x, y, manifest):
    """Resolve the improvement-grid value (e.g. 'HE3-1') to manifest entry, falling
    back to a coordinate-based lookup ('J10' for x=9 y=9) if no per-id key matches.
    """
    if not imp_id:
        return None
    if imp_id in manifest:
        return manifest[imp_id]
    # Coordinate fallback: spreadsheet-style address (cols A-AN, 1-indexed rows).
    col_letter = _col_letter(x + 1)
    addr = f"{col_letter}{y + 1}"
    if addr in manifest:
        return manifest[addr]
    return {"name": imp_id, "owner": None, "ownership_type": None}


def _col_letter(n):
    s = ""
    while n > 0:
        n, rem = divmod(n - 1, 26)
        s = chr(65 + rem) + s
    return s


def _palette(wb, named_range, fallback):
    """Try the named range first; fall back to the supplied dict.

    Lets the GM optionally drive palette colours from the workbook without
    requiring it. Mirrors the existing TerrainPalette pattern.
    """
    rows = read_named_range(wb, named_range)
    if rows:
        return {r[0]: r[1] for r in rows if r and r[0]}
    return dict(fallback)


# Hardcoded fallback palette. Keep in sync with terrain types added to the live workbook.
TERRAIN_PALETTE = {
    "Crater Floor": "#5a4a3a",
    "Mare Plain": "#3c3a3a",
    "Crater Rim": "#8a7560",
    "Polar Ice Plain": "#c8d8e8",
    "Regolith Plain": "#6a5d4a",
    "Lava Tube": "#2a2520",
    "Highland Plateau": "#7a6a55",
    "Empty": "#1a1a1a",
}

RESOURCE_PALETTE = {
    "Helium-3": "#ffd166",
    "Iron Deposit": "#c97064",
    "Aluminum Deposit": "#b8c5d6",
    "Phosphorus Deposit": "#d6a8e0",
    "Rare Earths": "#7ed4a8",
    "Heavy Metals": "#6a7e9c",
    "Oxygen Bound Soil": "#5fc3e8",
    "Water Ice": "#ffffff",
}
