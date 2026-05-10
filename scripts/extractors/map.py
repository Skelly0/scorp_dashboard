"""Extract data for the Map page (40×40 tile grid, layered composition)."""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, read_named_range, read_grid_optional

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

UPKEEP_SHEET_CANDIDATES = {
    "energy": ("Upkeep Energy", "Upkeep - Energy"),
    "materials": ("Upkeep Materials", "Upkeep - Materials"),
    "money": ("Upkeep Money", "Upkeep - Money"),
    "ore": ("Upkeep Ore", "Upkeep - Ore"),
    "water": ("Upkeep Water", "Upkeep - Water"),
    "helium3": ("Upkeep Helium-3", "Upkeep Helium 3", "Upkeep - Helium-3", "Upkeep - Helium 3"),
    # Legacy optional sheets from the first map-metrics pass. Keep reading them
    # when present, but don't report them as missing on the live workbook.
    "food": ("Upkeep - Food",),
    "housing": ("Upkeep - Housing",),
}
LEGACY_UPKEEP_KEYS = {"food", "housing"}


def extract(wb) -> dict[str, Any]:
    terrain = _read_grid(wb, "Terrain")
    features = _read_grid(wb, "Features")
    resources = _read_grid(wb, "Resources")
    slots = _read_grid(wb, "Slots")
    improvements = _read_grid(wb, "Improvements")
    control = _read_grid(wb, "Control")
    yields = {key: _read_grid(wb, sheet) for key, sheet in YIELD_SHEETS.items()}

    missing_sheets: list[dict[str, str]] = []

    def _track(sheet_name: str, grid):
        if grid is None:
            missing_sheets.append({"kind": "missing_sheet", "sheet": sheet_name})
        return grid

    def _read_optional_grid(sheet_names: tuple[str, ...], *, report_missing: bool = True):
        for sheet_name in sheet_names:
            grid = read_grid_optional(wb, sheet_name, WIDTH, HEIGHT)
            if grid is not None:
                return grid
        if report_missing:
            missing_sheets.append({"kind": "missing_sheet", "sheet": sheet_names[0]})
        return None

    staffing_grid = _track("Staffing Efficiency", read_grid_optional(wb, "Staffing Efficiency", WIDTH, HEIGHT))
    upkeep_grids = {
        key: _read_optional_grid(sheets, report_missing=key not in LEGACY_UPKEEP_KEYS)
        for key, sheets in UPKEEP_SHEET_CANDIDATES.items()
    }
    upkeep_present = {key: g for key, g in upkeep_grids.items() if g is not None}

    # Workforce: read class names from ClassTable (same source pops.py uses) and
    # try to read a Workforce <name> sheet for each. Missing → silent skip on
    # tile data, but recorded in missing_sheets so the frontend can surface it.
    classtable = read_named_range(wb, "ClassTable")
    class_names = [str(row[0]) for row in classtable if row and row[0] not in (None, "", "Name")]
    workforce_grids = {}
    for name in class_names:
        sheet_names = (f"Workforce {name}", f"Workforce - {name}")
        grid = _read_optional_grid(sheet_names)
        if grid is not None:
            workforce_grids[name] = grid

    manifest = _read_improvement_manifest(wb)

    tiles = []
    for y in range(HEIGHT):
        for x in range(WIDTH):
            terrain_v = _cell_str(terrain, x, y)
            feature_v = _cell_str(features, x, y)
            resource_v = _cell_str(resources, x, y)
            slots_v = _cell_int(slots, x, y)
            imp_id = _cell_str(improvements, x, y)
            control_v = _cell_str(control, x, y)
            tile_yields = {key: coerce_number(grid[y][x]) or 0 for key, grid in yields.items()}
            tile_staffing = coerce_number(staffing_grid[y][x]) if staffing_grid is not None else None
            tile_upkeep = (
                {key: coerce_number(g[y][x]) for key, g in upkeep_present.items()}
                if upkeep_present
                else None
            )
            if workforce_grids:
                tile_workforce: dict[str, int] | None = {}
                for name, grid in workforce_grids.items():
                    v = coerce_number(grid[y][x])
                    if v is not None and v >= 1:
                        tile_workforce[name] = int(v)
                if not tile_workforce:
                    tile_workforce = None
            else:
                tile_workforce = None
            tiles.append({
                "x": x,
                "y": y,
                "terrain": terrain_v or None,
                "feature": feature_v or None,
                "resource": resource_v or None,
                "slots": slots_v,
                "improvement": _improvement_for(imp_id, x, y, manifest),
                "control": control_v or None,
                "yields": tile_yields,
                "staffing": tile_staffing,
                "upkeep": tile_upkeep,
                "workforce": tile_workforce,
            })

    return {
        "width": WIDTH,
        "height": HEIGHT,
        "tiles": tiles,
        "palettes": {
            "terrain": _palette(wb, "TerrainPalette", TERRAIN_PALETTE),
            "resource": _palette(wb, "ResourcePalette", RESOURCE_PALETTE),
            "feature": _palette(wb, "FeaturePalette", FEATURE_PALETTE),
            "improvement_category": _palette(wb, "ImprovementCategoryPalette", IMPROVEMENT_CATEGORY_PALETTE),
            "control": _palette(wb, "ControlPalette", CONTROL_PALETTE),
        },
        "available_categories": {
            "staffing":  staffing_grid is not None,
            "upkeep":    bool(upkeep_present),
            "workforce": bool(workforce_grids),
        },
        "missing_sheets": missing_sheets,
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


# Hardcoded fallback palettes. Keep in sync with the terrain / resource / feature
# types and the improvement-category slug taxonomy used by the live workbook.
# Each can be overridden by the matching named range (TerrainPalette /
# ResourcePalette / FeaturePalette / ImprovementCategoryPalette).
TERRAIN_PALETTE = {
    "Crater Floor": "#5a4a3a",
    "Mare Plain": "#3c3a3a",
    "Crater Rim": "#8a7560",
    "Polar Ice Plain": "#c8d8e8",
    "Regolith Plain": "#6a5d4a",
    "Lava Tube": "#2a2520",
    "Highland Plateau": "#7a6a55",
    "Highland": "#8a7050",
    "Mountain": "#5c5a5e",
    "Ancient Site": "#4a6a6a",
    "Geothermal Vent": "#b85a3a",
    "Shattered Terrain": "#7a5550",
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

FEATURE_PALETTE = {
    "Buried Ice": "#b3d9ff",
    "Mineral Vein": "#c4a484",
    "Smooth Plain": "#8a9da6",
    "Boulder Field": "#6e6058",
    "Cave System": "#2d3a4a",
    "Recent Meteorite Strikes": "#d97a5b",
    "Magnetic Anomaly": "#a89cff",
    "Hollow Rocks": "#a89567",
    "Crashed Probe": "#ff8c42",
}

IMPROVEMENT_CATEGORY_PALETTE = {
    "energy": "#ffb000",
    "mining": "#a06840",
    "habitat": "#7ed4a8",
    "civic": "#5ec3ff",
    "military": "#ff5544",
    "agri": "#38d39f",
    "science": "#a89cff",
    "other": "#888888",
}

CONTROL_PALETTE = {
    "Administration": "#5ec3ff",
    "Corporations": "#ffd84d",
    "Founders": "#ffb000",
    "Capitalists": "#ffd84d",
    "Security": "#ff5544",
    "Unionists": "#38d39f",
    "Faithful": "#c44dff",
    "Technocracy": "#5ec3ff",
    "Bureaucrats": "#ffb000",
    "Engineers": "#5ec3ff",
    "Scientists": "#a89cff",
    "Proprietors": "#9c8a2e",
    "Managerial": "#c44dff",
    "Botanists": "#7fc97f",
    "Industrial Workers": "#38d39f",
    "Extraction Workers": "#ff8c42",
    "Service Workers": "#a89567",
}
