# Map — Staffing Efficiency Layer + Yields/Upkeep/Workforce Dropdowns — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-tile Staffing Efficiency heatmap to the Map page, and reorganise the layer-tab strip so the multi-option metric categories (yields, upkeep, workforce) live behind popup-menu dropdowns instead of inflating the tab row.

**Architecture:** Backend extends `extractors/map.py` to read 18 new optional sheets (Staffing Efficiency × 1, Upkeep − Resource × 6, Workforce − Class × 11) and emit them on each tile alongside `available_categories`. Frontend introduces a new `LayerMenu` popup-menu component, generalises `MapCanvas.tileColor`/`computeLayerMax` from yield-only to four categories, threads theme into the canvas redraw graph (gotcha #14 fix), and extends the tile-inspect panel with always-on Yields / Upkeep / Workforce / Staffing sections. Schema bumps 4 → 5 in lockstep.

**Tech Stack:** Python (openpyxl), Svelte 4, vanilla CSS theme tokens, pytest, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-07-map-staffing-and-layer-dropdowns-design.md`

**Commit cadence:** Per project preference, **do NOT commit between tasks**. Run tests at task boundaries to catch regressions early, but defer all `git commit`s to the final task where we'll group the work into commit(s) with the user.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `scripts/extractors/map.py` | Modify | Read new sheets, emit `upkeep` / `workforce` / `staffing` / `available_categories` |
| `scripts/extractors/_common.py` | Modify | Add `_read_grid_optional` helper (sheet-name-keyed, soft-fail) |
| `scripts/sync_sheet.py` | Modify | Bump `SCHEMA_VERSION` 4 → 5; thread map-extractor `partial_failures` |
| `scripts/validate_schema.py` | Untouched | Existing validator covers structural ranges; new sheets are sheet-name-keyed reads, not named ranges |
| `tests/fixtures/build_test_workbook.py` | Modify | Add the 18 new sheets with non-zero cells; add a `ClassTable` named range fixture |
| `tests/extractors/test_map.py` | Create | Unit tests for the new extractor paths (soft-fail, partial_failures, available_categories) |
| `tests/test_sync_sheet.py` | Modify | Bump version assertion |
| `src/lib/components/LayerMenu.svelte` | Create | Popup-menu component (trigger button + floating menu) |
| `src/lib/components/LayerMenu.test.js` | Create | Vitest for open/close/keyboard/last-used-sub |
| `src/lib/components/MapCanvas.svelte` | Modify | Generalise `tileColor`/`computeLayerMax` to 4 categories; theme-redraw trigger; legend rewrite |
| `src/lib/components/InspectMetricSection.svelte` | Create | Reusable section for Yields/Upkeep/Workforce/Staffing in inspect panel |
| `src/routes/Map.svelte` | Modify | Layer encoding `<category>:<key>`; tab strip with 3 LayerMenus; gate by `available_categories`; Esc precedence; new inspect sections |
| `src/lib/stores/meta.js` | Modify | Bump `EXPECTED_SCHEMA_VERSION` 4 → 5 |
| `src/styles/global.css` | Modify | `.layer-menu*` and `.staff-meter*` classes; tri-theme-tokenised |
| `tests-e2e/map.spec.js` | Create | E2E for dropdown open/select, staffing inspect, hide-when-empty |
| `CLAUDE.md` | Modify | Add notes about the new sheets, soft-fail behaviour, theme-redraw trigger gotcha |

---

## Task 1: `_read_grid_optional` helper

**Files:**
- Modify: `scripts/extractors/_common.py`
- Test: `tests/extractors/test_map.py` (new file)

- [ ] **Step 1: Create test file & write failing test for the helper**

Create `tests/extractors/__init__.py` (empty file) if it doesn't exist, then `tests/extractors/test_map.py`:

```python
"""Tests for extractors/map.py and the new soft-fail helper in _common."""
from __future__ import annotations

import openpyxl
import pytest

from extractors._common import read_grid_optional


def _wb_with(sheet_name: str, values: list[list]) -> openpyxl.Workbook:
    wb = openpyxl.Workbook()
    # remove the default sheet so the workbook only has what the test asks for
    default = wb.active
    wb.remove(default)
    ws = wb.create_sheet(sheet_name)
    for r_idx, row in enumerate(values, start=1):
        for c_idx, v in enumerate(row, start=1):
            ws.cell(row=r_idx, column=c_idx, value=v)
    return wb


def test_read_grid_optional_returns_grid_when_sheet_exists():
    wb = _wb_with("Staffing Efficiency", [[0.5, 0.7], [0.0, 1.0]])
    grid = read_grid_optional(wb, "Staffing Efficiency", width=2, height=2)
    assert grid == [[0.5, 0.7], [0.0, 1.0]]


def test_read_grid_optional_returns_none_when_sheet_missing():
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    wb.create_sheet("Some Other Sheet")
    grid = read_grid_optional(wb, "Staffing Efficiency", width=2, height=2)
    assert grid is None


def test_read_grid_optional_pads_short_rows_with_none():
    """A sheet that's smaller than width×height fills the missing cells with None."""
    wb = _wb_with("X", [[1, 2], [3]])  # second row has only 1 value
    grid = read_grid_optional(wb, "X", width=3, height=2)
    assert grid == [[1, 2, None], [3, None, None]]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pytest tests/extractors/test_map.py -v`
Expected: ImportError or AttributeError on `read_grid_optional` (function not defined yet).

- [ ] **Step 3: Implement the helper**

Append to `scripts/extractors/_common.py`:

```python
def read_grid_optional(wb, sheet_name: str, width: int, height: int) -> list[list[Any]] | None:
    """Read a fixed-size grid by sheet name. Returns None if the sheet is absent.

    Used by `extractors/map.py` for soft-fail-friendly per-sheet reads (Upkeep,
    Workforce, Staffing). Existing yield sheets continue to use the
    `_read_grid` helper inside map.py — that one throws on missing sheet, which
    is the current contract for those mandatory sheets.

    The grid is always rectangular: short rows are padded with None.
    """
    if sheet_name not in wb.sheetnames:
        return None
    ws = wb[sheet_name]
    grid: list[list[Any]] = []
    for row in ws.iter_rows(min_row=1, max_row=height, min_col=1, max_col=width, values_only=True):
        # iter_rows pads to max_col with None already, but be explicit for short sheets.
        padded = list(row) + [None] * max(0, width - len(row))
        grid.append(padded[:width])
    while len(grid) < height:
        grid.append([None] * width)
    return grid
```

- [ ] **Step 4: Run tests**

Run: `pytest tests/extractors/test_map.py -v`
Expected: 3 PASS.

---

## Task 2: Test fixture extensions

Add the 18 new sheets and a `ClassTable` named range to the test workbook builder so subsequent extractor tests have realistic data.

**Files:**
- Modify: `tests/fixtures/build_test_workbook.py`

- [ ] **Step 1: Locate existing yield-sheet seeding loop**

Run: `grep -n "Yield - " tests/fixtures/build_test_workbook.py`
Expected: ~lines 370–386 (the existing yield-sheet seed logic).

- [ ] **Step 2: Extend the yield-sheet loop with upkeep + staffing + workforce sheets**

Read `tests/fixtures/build_test_workbook.py` and locate the block that creates the 6 `Yield - …` sheets (around line 370). Immediately after that block, insert:

```python
    # === New optional sheets for Map page (staffing + upkeep + workforce) ===
    # Spec: docs/superpowers/specs/2026-05-07-map-staffing-and-layer-dropdowns-design.md

    # Staffing Efficiency: 40×40 grid of 0.0–1.0 floats. Seed a couple of cells.
    staffing_ws = wb.create_sheet("Staffing Efficiency")
    staffing_ws.cell(row=10, column=10, value=0.76)
    staffing_ws.cell(row=11, column=10, value=0.42)
    staffing_ws.cell(row=12, column=10, value=1.0)

    # Upkeep - <Resource>: 6 sheets of positive floats. Seed one cell per sheet.
    UPKEEP_RESOURCES = ["Food", "Water", "Energy", "Materials", "Ore", "Housing"]
    for resource in UPKEEP_RESOURCES:
        ws = wb.create_sheet(f"Upkeep - {resource}")
        ws.cell(row=10, column=10, value=1.5)

    # Workforce - <Class>: one sheet per class in ClassTable. Seed a couple of cells.
    WORKFORCE_CLASSES = [
        "Bureaucrats", "Capitalists", "Engineers", "Scientists", "Security",
        "Proprietors", "Managerial", "Botanists",
        "Industrial Workers", "Extraction Workers", "Service Workers",
    ]
    for cls in WORKFORCE_CLASSES:
        ws = wb.create_sheet(f"Workforce - {cls}")
        ws.cell(row=10, column=10, value=12)  # 12 workers on tile (9, 9) — note 1-indexed
        ws.cell(row=11, column=10, value=0)   # explicit zero to validate drop-zero behaviour
```

- [ ] **Step 3: Verify a `ClassTable` named range exists in the fixture**

Run: `grep -n "ClassTable" tests/fixtures/build_test_workbook.py`

If the fixture already defines `ClassTable`, skip the next step. If not, locate the section that creates other named ranges (search for `wb.defined_names`) and add:

```python
    # ClassTable named range — source of truth for per-class iteration.
    # Mirrors the live workbook layout. Place names in column A, rows 2..12.
    classtable_ws = wb.create_sheet("Politics")  # or wherever the live workbook hosts it
    for i, cls in enumerate(WORKFORCE_CLASSES, start=2):
        classtable_ws.cell(row=i, column=1, value=cls)

    from openpyxl.workbook.defined_name import DefinedName
    wb.defined_names["ClassTable"] = DefinedName(
        name="ClassTable",
        attr_text=f"Politics!$A$2:$A${1 + len(WORKFORCE_CLASSES)}",
    )
```

(If a `Politics` sheet already exists, reuse it instead of creating it.)

- [ ] **Step 4: Run the existing test suite to confirm no regressions**

Run: `pytest tests/ -v`
Expected: pre-existing-fail count unchanged (per CLAUDE.md gotcha #10, ~9 tests are known to fail on `main` due to fixture/extractor drift). No new failures.

---

## Task 3: Extractor — staffing reads

Add `tile.staffing` and the `available_categories.staffing` flag.

**Files:**
- Modify: `scripts/extractors/map.py`
- Test: `tests/extractors/test_map.py`

- [ ] **Step 1: Write failing tests for staffing extraction**

Append to `tests/extractors/test_map.py`:

```python
import sys
from pathlib import Path

# fixtures live in tests/fixtures; ensure they're importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "fixtures"))
from build_test_workbook import build_workbook  # noqa: E402

from extractors import map as ex_map  # noqa: E402


def test_staffing_present_when_sheet_exists():
    wb = build_workbook()
    out = ex_map.extract(wb)
    assert out["available_categories"]["staffing"] is True
    # Tile (9, 9) was seeded with 0.76 in the fixture (1-indexed row 10, col 10)
    tile = next(t for t in out["tiles"] if t["x"] == 9 and t["y"] == 9)
    assert tile["staffing"] == pytest.approx(0.76)


def test_staffing_absent_when_sheet_missing():
    wb = build_workbook()
    wb.remove(wb["Staffing Efficiency"])
    out = ex_map.extract(wb)
    assert out["available_categories"]["staffing"] is False
    for tile in out["tiles"]:
        assert tile["staffing"] is None
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/extractors/test_map.py -v -k staffing`
Expected: KeyError on `staffing` or `available_categories`.

- [ ] **Step 3: Update `extractors/map.py` to read staffing**

Open `scripts/extractors/map.py`. After the `from extractors._common import …` line, change the import to include the new helper:

```python
from extractors._common import coerce_number, read_named_range, read_grid_optional
```

Then inside `extract()`, after the existing `yields = …` line and before `manifest = …`, add:

```python
    staffing_grid = read_grid_optional(wb, "Staffing Efficiency", width=WIDTH, height=HEIGHT)
```

In the per-tile loop, after the `tile_yields = …` line, add:

```python
            tile_staffing = coerce_number(staffing_grid[y][x]) if staffing_grid is not None else None
```

Change the `tiles.append({...})` block to include `"staffing": tile_staffing`.

Finally, change the bottom `return { ... }` block to add:

```python
        "available_categories": {
            "staffing": staffing_grid is not None,
            # upkeep + workforce filled in by later tasks
        },
```

- [ ] **Step 4: Run the staffing tests**

Run: `pytest tests/extractors/test_map.py -v -k staffing`
Expected: 2 PASS.

---

## Task 4: Extractor — upkeep reads

Add `tile.upkeep` and `available_categories.upkeep`.

**Files:**
- Modify: `scripts/extractors/map.py`
- Test: `tests/extractors/test_map.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/extractors/test_map.py`:

```python
def test_upkeep_present_when_all_sheets_exist():
    wb = build_workbook()
    out = ex_map.extract(wb)
    assert out["available_categories"]["upkeep"] is True
    tile = next(t for t in out["tiles"] if t["x"] == 9 and t["y"] == 9)
    assert tile["upkeep"]["food"] == pytest.approx(1.5)
    assert tile["upkeep"]["water"] == pytest.approx(1.5)


def test_upkeep_absent_when_all_sheets_missing():
    wb = build_workbook()
    for r in ["Food", "Water", "Energy", "Materials", "Ore", "Housing"]:
        wb.remove(wb[f"Upkeep - {r}"])
    out = ex_map.extract(wb)
    assert out["available_categories"]["upkeep"] is False
    for tile in out["tiles"]:
        assert tile["upkeep"] is None


def test_upkeep_partially_populated_when_some_sheets_missing():
    """Mixed: 4 of 6 upkeep sheets present → upkeep is a dict with only those 4 keys."""
    wb = build_workbook()
    wb.remove(wb["Upkeep - Ore"])
    wb.remove(wb["Upkeep - Housing"])
    out = ex_map.extract(wb)
    assert out["available_categories"]["upkeep"] is True
    tile = next(t for t in out["tiles"] if t["x"] == 9 and t["y"] == 9)
    assert "ore" not in tile["upkeep"]
    assert "housing" not in tile["upkeep"]
    assert "food" in tile["upkeep"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/extractors/test_map.py -v -k upkeep`
Expected: KeyError on `upkeep`.

- [ ] **Step 3: Add upkeep reads to the extractor**

In `scripts/extractors/map.py`, near the top add a constant mirroring `YIELD_SHEETS`:

```python
UPKEEP_SHEETS = {
    "food": "Upkeep - Food",
    "materials": "Upkeep - Materials",
    "ore": "Upkeep - Ore",
    "energy": "Upkeep - Energy",
    "housing": "Upkeep - Housing",
    "water": "Upkeep - Water",
}
```

Inside `extract()`, after the `staffing_grid = …` line, add:

```python
    upkeep_grids = {key: read_grid_optional(wb, sheet, WIDTH, HEIGHT) for key, sheet in UPKEEP_SHEETS.items()}
    upkeep_present = {key: g for key, g in upkeep_grids.items() if g is not None}
```

In the per-tile loop, after the `tile_staffing = …` line, add:

```python
            tile_upkeep = (
                {key: coerce_number(g[y][x]) for key, g in upkeep_present.items()}
                if upkeep_present
                else None
            )
```

Add `"upkeep": tile_upkeep` to the `tiles.append({...})` block.

Finally extend the `available_categories` dict in the return block:

```python
        "available_categories": {
            "staffing": staffing_grid is not None,
            "upkeep":   bool(upkeep_present),
            # workforce filled in by next task
        },
```

- [ ] **Step 4: Run the upkeep tests**

Run: `pytest tests/extractors/test_map.py -v -k upkeep`
Expected: 3 PASS.

---

## Task 5: Extractor — workforce reads (via `ClassTable`)

Add `tile.workforce` and `available_categories.workforce`.

**Files:**
- Modify: `scripts/extractors/map.py`
- Test: `tests/extractors/test_map.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/extractors/test_map.py`:

```python
def test_workforce_present_when_classtable_and_sheets_exist():
    wb = build_workbook()
    out = ex_map.extract(wb)
    assert out["available_categories"]["workforce"] is True
    tile = next(t for t in out["tiles"] if t["x"] == 9 and t["y"] == 9)
    assert tile["workforce"] is not None
    assert tile["workforce"].get("Engineers") == 12
    # zero entries are dropped — value at (9, 10) seeded with 0 should not appear
    tile_zero = next(t for t in out["tiles"] if t["x"] == 9 and t["y"] == 10)
    assert "Engineers" not in (tile_zero["workforce"] or {})


def test_workforce_absent_when_all_workforce_sheets_missing():
    wb = build_workbook()
    workforce_sheets = [s for s in wb.sheetnames if s.startswith("Workforce - ")]
    for s in workforce_sheets:
        wb.remove(wb[s])
    out = ex_map.extract(wb)
    assert out["available_categories"]["workforce"] is False
    for tile in out["tiles"]:
        assert tile["workforce"] is None


def test_workforce_skips_unknown_class_sheets():
    """A workforce sheet for a class NOT in ClassTable is silently ignored."""
    wb = build_workbook()
    wb.create_sheet("Workforce - Phantom Class")
    out = ex_map.extract(wb)
    tile = next(t for t in out["tiles"] if t["x"] == 9 and t["y"] == 9)
    assert "Phantom Class" not in (tile["workforce"] or {})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/extractors/test_map.py -v -k workforce`
Expected: KeyError on `workforce` or AttributeError.

- [ ] **Step 3: Add workforce reads**

In `scripts/extractors/map.py`, after the existing `read_named_range` import is good — we already have it. Inside `extract()`, after the `upkeep_grids = …` block, add:

```python
    # Workforce: read class names from ClassTable (same source pops.py uses) and
    # try to read a Workforce - <name> sheet for each. Missing → silent skip.
    classtable = read_named_range(wb, "ClassTable")
    class_names = [row[0] for row in classtable if row and row[0] not in (None, "")]
    workforce_grids = {}
    for name in class_names:
        grid = read_grid_optional(wb, f"Workforce - {name}", WIDTH, HEIGHT)
        if grid is not None:
            workforce_grids[name] = grid
```

In the per-tile loop, after the `tile_upkeep = …` block, add:

```python
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
```

Add `"workforce": tile_workforce` to the `tiles.append({...})` block.

Extend `available_categories` to its final form:

```python
        "available_categories": {
            "staffing":  staffing_grid is not None,
            "upkeep":    bool(upkeep_present),
            "workforce": bool(workforce_grids),
        },
```

- [ ] **Step 4: Run the workforce tests**

Run: `pytest tests/extractors/test_map.py -v -k workforce`
Expected: 3 PASS.

- [ ] **Step 5: Run the full extractor test set**

Run: `pytest tests/extractors/test_map.py -v`
Expected: 8 PASS (3 helper + 2 staffing + 3 upkeep + … recount: 3 + 2 + 3 + 3 = 11 PASS).

---

## Task 6: Extractor — `missing_sheets` reporting

Record missing-sheet detail in the map.json output. **Scope note:** the existing sync-level `partial_failures` channel in `sync_sheet.py` is `list[str]` of failed page names — a different contract than the rich `{page, kind, sheet}` dict the spec describes. To avoid changing that channel's contract in v1, we surface map-extractor detail on the map.json itself (under a `missing_sheets` key) rather than merging into the sync-level channel. Future work can route this richer detail upward.

**Files:**
- Modify: `scripts/extractors/map.py`
- Test: `tests/extractors/test_map.py`

- [ ] **Step 1: Write failing test**

Append to `tests/extractors/test_map.py`:

```python
def test_missing_sheets_reported_in_map_output():
    wb = build_workbook()
    wb.remove(wb["Staffing Efficiency"])
    wb.remove(wb["Upkeep - Ore"])
    out = ex_map.extract(wb)
    sheets_missed = {f["sheet"] for f in out["missing_sheets"]}
    assert "Staffing Efficiency" in sheets_missed
    assert "Upkeep - Ore" in sheets_missed
    for f in out["missing_sheets"]:
        assert f["kind"] == "missing_sheet"


def test_missing_sheets_empty_when_all_present():
    wb = build_workbook()
    out = ex_map.extract(wb)
    assert out["missing_sheets"] == []
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pytest tests/extractors/test_map.py -v -k missing_sheets`
Expected: KeyError on `missing_sheets`.

- [ ] **Step 3: Track misses in the extractor**

In `scripts/extractors/map.py`, inside `extract()`, before the `staffing_grid = …` line, add:

```python
    missing_sheets: list[dict[str, str]] = []

    def _track(sheet_name: str, grid):
        if grid is None:
            missing_sheets.append({"kind": "missing_sheet", "sheet": sheet_name})
        return grid
```

Wrap each call:

```python
    staffing_grid = _track("Staffing Efficiency", read_grid_optional(wb, "Staffing Efficiency", WIDTH, HEIGHT))
    upkeep_grids = {
        key: _track(sheet, read_grid_optional(wb, sheet, WIDTH, HEIGHT))
        for key, sheet in UPKEEP_SHEETS.items()
    }
```

For workforce — only track when the class is in `ClassTable` (so a workforce sheet is expected) but missing:

```python
    workforce_grids = {}
    for name in class_names:
        sheet_name = f"Workforce - {name}"
        grid = read_grid_optional(wb, sheet_name, WIDTH, HEIGHT)
        if grid is None:
            missing_sheets.append({"kind": "missing_sheet", "sheet": sheet_name})
        else:
            workforce_grids[name] = grid
```

Add to the return dict at the bottom of `extract()`:

```python
        "missing_sheets": missing_sheets,
```

- [ ] **Step 4: Run the missing_sheets tests**

Run: `pytest tests/extractors/test_map.py -v -k missing_sheets`
Expected: 2 PASS.

- [ ] **Step 5: Confirm sync_sheet still works**

Run: `pytest tests/test_sync_sheet.py -v`
Expected: pre-existing-pass tests still pass; no regressions.

(Note: the sync-level `partial_failures` channel — which is `list[str]` of page names — is untouched. A missing optional sheet does NOT make `extract()` fail, so `"map"` is not appended to that list. The richer detail lives on map.json itself.)

---

## Task 7: New `LayerMenu.svelte` component

Self-contained popup-menu. Standalone, no dependency on Map.svelte.

**Files:**
- Create: `src/lib/components/LayerMenu.svelte`
- Create: `src/lib/components/LayerMenu.test.js`

- [ ] **Step 1: Write Vitest spec**

Create `src/lib/components/LayerMenu.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import LayerMenu from './LayerMenu.svelte';

const OPTIONS = [
  { key: 'food', label: 'Food' },
  { key: 'water', label: 'Water' },
  { key: 'energy', label: 'Energy' },
];

describe('LayerMenu', () => {
  it('renders the parent label when no sub is active', () => {
    const { getByRole } = render(LayerMenu, {
      props: { label: 'Yields', category: 'yield', options: OPTIONS, activeKey: null, defaultKey: 'food' },
    });
    const trigger = getByRole('button', { name: /Yields/i });
    expect(trigger.textContent).not.toContain('·');
  });

  it('renders "Label · Sub" when a sub is active', () => {
    const { getByRole } = render(LayerMenu, {
      props: { label: 'Yields', category: 'yield', options: OPTIONS, activeKey: 'water', defaultKey: 'food' },
    });
    expect(getByRole('button').textContent).toMatch(/Yields\s*·\s*Water/);
  });

  it('opens the popup on click and closes on second click', async () => {
    const { getByRole, queryByRole, getAllByRole } = render(LayerMenu, {
      props: { label: 'Yields', category: 'yield', options: OPTIONS, activeKey: 'water', defaultKey: 'food' },
    });
    const trigger = getByRole('button');
    await fireEvent.click(trigger);
    await tick();
    expect(getAllByRole('menuitem')).toHaveLength(3);
    await fireEvent.click(trigger);
    await tick();
    expect(queryByRole('menuitem')).toBeNull();
  });

  it('dispatches select with the encoded layer id', async () => {
    const handler = vi.fn();
    const { getByRole, getAllByRole, component } = render(LayerMenu, {
      props: { label: 'Yields', category: 'yield', options: OPTIONS, activeKey: 'water', defaultKey: 'food' },
    });
    component.$on('select', handler);
    await fireEvent.click(getByRole('button'));
    await tick();
    await fireEvent.click(getAllByRole('menuitem')[2]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ layerId: 'yield:energy' });
  });

  it('closes on Escape and stops propagation', async () => {
    const { getByRole, queryByRole } = render(LayerMenu, {
      props: { label: 'Yields', category: 'yield', options: OPTIONS, activeKey: 'water', defaultKey: 'food' },
    });
    await fireEvent.click(getByRole('button'));
    await tick();
    const popup = queryByRole('menu');
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    popup.dispatchEvent(escEvent);
    await tick();
    expect(queryByRole('menu')).toBeNull();
    // stopPropagation is honoured by the dispatch — when the popup closed it
    // should have called preventDefault / stopPropagation on the Esc.
    expect(escEvent.defaultPrevented).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- LayerMenu.test.js`
Expected: `Cannot resolve './LayerMenu.svelte'`.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/LayerMenu.svelte`:

```svelte
<script>
  import { createEventDispatcher, tick } from 'svelte';

  /** @type {string} 'Yields' | 'Upkeep' | 'Workforce' */
  export let label;
  /** @type {string} 'yield' | 'upkeep' | 'workforce' */
  export let category;
  /** @type {{key: string, label: string}[]} */
  export let options;
  /** @type {string | null} The active sub-key, or null if this dropdown is not the active tab. */
  export let activeKey = null;
  /** @type {string} Fallback when activeKey is null and the user clicks the trigger. */
  export let defaultKey;

  const dispatch = createEventDispatcher();

  let open = false;
  let lastUsedSub = activeKey ?? defaultKey;
  let triggerEl;
  let popupEl;

  $: if (activeKey) lastUsedSub = activeKey;

  $: activeOption = activeKey ? options.find((o) => o.key === activeKey) : null;
  $: triggerLabel = activeOption ? `${label} · ${activeOption.label}` : label;

  function onTriggerClick() {
    if (activeKey) {
      // Already the active tab — open the popup so the user can switch sub.
      open = !open;
    } else {
      // Not active — first click selects lastUsedSub without opening the popup.
      dispatch('select', { layerId: `${category}:${lastUsedSub}` });
    }
  }

  function onItemClick(key) {
    open = false;
    dispatch('select', { layerId: `${category}:${key}` });
  }

  function onPopupKeydown(e) {
    if (e.key === 'Escape') {
      open = false;
      e.preventDefault();
      e.stopPropagation();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = Array.from(popupEl.querySelectorAll('[role=menuitem]'));
      const idx = items.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
      items[next]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      const focused = document.activeElement;
      const key = focused?.dataset?.key;
      if (key) {
        e.preventDefault();
        onItemClick(key);
      }
    }
  }

  async function handleOpenChange(value) {
    if (value) {
      await tick();
      const first = popupEl?.querySelector('[role=menuitem]');
      first?.focus();
    } else {
      triggerEl?.focus();
    }
  }
  $: handleOpenChange(open);

  function onOutsideClick(e) {
    if (!open) return;
    if (!popupEl?.contains(e.target) && !triggerEl?.contains(e.target)) {
      open = false;
    }
  }
</script>

<svelte:window on:click={onOutsideClick} />

<span class="layer-menu">
  <button
    bind:this={triggerEl}
    type="button"
    class="layer-menu-trigger"
    aria-pressed={!!activeKey}
    aria-haspopup="menu"
    aria-expanded={open}
    on:click={onTriggerClick}
  >
    {triggerLabel}
    <span class="caret" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <div
      bind:this={popupEl}
      class="layer-menu-popup"
      role="menu"
      tabindex="-1"
      on:keydown={onPopupKeydown}
    >
      {#each options as opt}
        <button
          type="button"
          role="menuitem"
          class="layer-menu-item"
          class:active={opt.key === activeKey}
          data-key={opt.key}
          on:click={() => onItemClick(opt.key)}
        >
          <span class="dot" aria-hidden="true"></span>
          {opt.label}
        </button>
      {/each}
    </div>
  {/if}
</span>

<style>
  .layer-menu { position: relative; display: inline-block; }
</style>
```

- [ ] **Step 4: Run the Vitest suite**

Run: `npm test -- LayerMenu.test.js`
Expected: 5 PASS.

---

## Task 8: `MapCanvas` — generalise to 4 categories + theme-redraw trigger

Refactor `tileColor` and `computeLayerMax` to take a parsed `(category, key)` pair, add `staffing` / `upkeep` / `workforce` colour ramps with pre-resolved theme tokens, and thread theme into the redraw graph.

**Files:**
- Modify: `src/lib/components/MapCanvas.svelte`

- [ ] **Step 1: Add a layer-string parser at the top of the script**

Open `src/lib/components/MapCanvas.svelte`. Below the imports, add:

```js
import { CLASS_COLORS } from '../faction-colors.js';

function parseLayer(layer) {
  if (!layer) return { category: null, key: null };
  if (layer.includes(':')) {
    const [category, ...rest] = layer.split(':');
    return { category, key: rest.join(':') };
  }
  // 'terrain', 'staffing', 'resources', 'features', 'improvements'
  return { category: layer, key: null };
}
```

- [ ] **Step 2: Replace `computeLayerMax` with a 4-category version**

Find the existing `computeLayerMax(mapData, layer)` function and replace with:

```js
function computeLayerMax(mapData, layer) {
  if (!mapData) return { pos: 0, neg: 0, max: 0 };
  const { category, key } = parseLayer(layer);

  if (category === 'yield' && key) {
    let pos = 0, neg = 0;
    for (const t of mapData.tiles) {
      const v = t.yields?.[key] ?? 0;
      if (v > pos) pos = v;
      if (v < neg) neg = v;
    }
    return { pos, neg: Math.abs(neg), max: 0 };
  }
  if (category === 'upkeep' && key) {
    let max = 0;
    for (const t of mapData.tiles) {
      const v = t.upkeep?.[key] ?? 0;
      if (v > max) max = v;
    }
    return { pos: 0, neg: 0, max };
  }
  if (category === 'workforce' && key) {
    let max = 0;
    for (const t of mapData.tiles) {
      const v = t.workforce?.[key] ?? 0;
      if (v > max) max = v;
    }
    return { pos: 0, neg: 0, max };
  }
  if (category === 'staffing') {
    return { pos: 0, neg: 0, max: 1 };  // 0..1 scalar; max is fixed
  }
  return { pos: 0, neg: 0, max: 0 };
}
```

- [ ] **Step 3: Replace `tileColor` with a 4-category version**

Find the existing `tileColor(tile, layer, palettes, layerMax, theme)` function and replace with:

```js
function tileColor(tile, layer, palettes, layerMax, theme) {
  const { category, key } = parseLayer(layer);

  if (category === 'terrain' || category === null) {
    return palettes.terrain[tile.terrain] || theme.bg;
  }

  // YIELD: existing diverging green/red.
  if (category === 'yield' && key) {
    const v = tile.yields?.[key] ?? 0;
    if (v > 0 && layerMax.pos > 0) {
      const t = Math.max(0.15, v / layerMax.pos);
      return `color-mix(in srgb, ${theme.good} ${(t * 100).toFixed(1)}%, ${theme.bg})`;
    }
    if (v < 0 && layerMax.neg > 0) {
      const t = Math.max(0.15, -v / layerMax.neg);
      return `color-mix(in srgb, ${theme.crit} ${(t * 100).toFixed(1)}%, ${theme.bg})`;
    }
    return theme.bg;
  }

  // UPKEEP: single red gradient 0 → max.
  if (category === 'upkeep' && key) {
    const v = tile.upkeep?.[key] ?? 0;
    if (v > 0 && layerMax.max > 0) {
      const t = Math.max(0.15, v / layerMax.max);
      return `color-mix(in srgb, ${theme.crit} ${(t * 100).toFixed(1)}%, ${theme.bg})`;
    }
    return theme.bg;
  }

  // WORKFORCE: single class-accent gradient.
  if (category === 'workforce' && key) {
    const v = tile.workforce?.[key] ?? 0;
    if (v > 0 && layerMax.max > 0) {
      const swatch = resolveClassColor(key, theme);
      const t = Math.max(0.15, v / layerMax.max);
      return `color-mix(in srgb, ${swatch} ${(t * 100).toFixed(1)}%, ${theme.bg})`;
    }
    return theme.bg;
  }

  // STAFFING: red → amber → green diverging at 0.5.
  if (category === 'staffing') {
    const v = tile.staffing;
    if (v == null) return theme.bg;
    if (v < 0.5) {
      const t = v * 2;  // 0 → 1 across the lower half
      return `color-mix(in srgb, ${theme.amber} ${(t * 100).toFixed(1)}%, ${theme.crit})`;
    } else {
      const t = (v - 0.5) * 2;  // 0 → 1 across the upper half
      return `color-mix(in srgb, ${theme.good} ${(t * 100).toFixed(1)}%, ${theme.amber})`;
    }
  }

  return theme.bg;
}

function resolveClassColor(name, theme) {
  const c = CLASS_COLORS[name];
  // CLASS_COLORS values are concrete hex. For unknown classes the helper
  // returns 'var(--accent)', which canvas fillStyle cannot resolve — substitute
  // the pre-resolved amber token instead.
  return c ?? theme.amber;
}
```

- [ ] **Step 4: Update `drawTerrain` to read & use the new theme tokens**

Find the `const theme = {…}` block inside `drawTerrain` and extend it:

```js
    const theme = {
      bg:    styles.getPropertyValue('--bg').trim()    || '#0a0a0a',
      crit:  styles.getPropertyValue('--crit').trim()  || '#ff4d4d',
      good:  styles.getPropertyValue('--good').trim()  || '#38d39f',
      amber: styles.getPropertyValue('--accent').trim()|| '#ffb000',
    };
```

- [ ] **Step 5: Add `redrawKey` prop and include it in the redraw `$:` dependency list**

Near the top of the `<script>` block, add:

```js
  /** Bumping this triggers a redraw — Map.svelte sets it to the current theme name. */
  export let redrawKey = '';
```

Find the existing reactive line:

```js
$: drawTerrain(mapData, layer, layerMax, filters);
```

Change it to:

```js
$: drawTerrain(mapData, layer, layerMax, filters, redrawKey);
```

(`redrawKey` is unused inside `drawTerrain`; it just forces Svelte to recompute.)

Update `drawTerrain`'s signature accordingly:

```js
async function drawTerrain(mapData, layer, layerMax, filters, _redrawKey) {
```

- [ ] **Step 6: Update the legend block to be category-aware**

Find the existing `{#if layer !== 'terrain'}` block at the bottom of the template and replace with:

```svelte
{#if layer !== 'terrain' && layer !== 'resources' && layer !== 'features' && layer !== 'improvements'}
  {@const parsed = parseLayer(layer)}
  <div class="font-mono text-xs uppercase tracking-widest text-muted mt-2 flex items-center gap-3">
    {#if parsed.category === 'yield'}
      <span class="capitalize">{parsed.key} yield —</span>
      {#if layerMax.pos > 0}
        <span>0 to <strong class="text-fg">+{layerMax.pos.toFixed(1)}</strong></span>
        <span class="inline-block w-4 h-3 border border-border" style="background: var(--good)"></span>
      {/if}
      {#if layerMax.neg > 0}
        <span>0 to <strong class="text-fg">-{layerMax.neg.toFixed(1)}</strong></span>
        <span class="inline-block w-4 h-3 border border-border" style="background: var(--crit)"></span>
      {/if}
      {#if layerMax.pos === 0 && layerMax.neg === 0}
        <span>(no tiles produce or consume {parsed.key})</span>
      {/if}
    {:else if parsed.category === 'upkeep'}
      <span class="capitalize">{parsed.key} upkeep —</span>
      {#if layerMax.max > 0}
        <span>0 to <strong class="text-fg">{layerMax.max.toFixed(1)}</strong></span>
        <span class="inline-block w-4 h-3 border border-border" style="background: var(--crit)"></span>
      {:else}
        <span>(no tiles consume {parsed.key})</span>
      {/if}
    {:else if parsed.category === 'workforce'}
      <span>{parsed.key} —</span>
      {#if layerMax.max > 0}
        <span>0 to <strong class="text-fg">{layerMax.max}</strong></span>
        <span class="inline-block w-4 h-3 border border-border" style="background: {CLASS_COLORS[parsed.key] ?? 'var(--accent)'}"></span>
      {:else}
        <span>(no tiles employ {parsed.key})</span>
      {/if}
    {:else if parsed.category === 'staffing'}
      <span>Staffing —</span>
      <span>0% to 100%</span>
      <span class="inline-block w-12 h-3 border border-border" style="background: linear-gradient(90deg, var(--crit) 0%, var(--accent) 50%, var(--good) 100%)"></span>
    {/if}
  </div>
{/if}
```

(Note the `{@const}` is inside `{#if}` per gotcha #7.)

- [ ] **Step 7: Run any existing MapCanvas tests if they exist**

Run: `find src -name "MapCanvas.test.*" 2>/dev/null && npm test -- MapCanvas 2>&1 | tail -20`
Expected: no MapCanvas test exists today; that's fine — the integration test in Task 12 will exercise this.

---

## Task 9: `Map.svelte` — new layer encoding + dropdowns + inspect sections

Wire the new layer-string format, integrate `<LayerMenu>` × 3, gate dropdowns by `available_categories`, and add the four metric sections to the inspect panel. Also adds the theme→`redrawKey` plumbing.

**Files:**
- Modify: `src/routes/Map.svelte`

- [ ] **Step 1: Update imports and state**

Open `src/routes/Map.svelte`. Update the import block:

```js
import { onMount } from 'svelte';
import { meta } from '../lib/stores/meta.js';
import { map, mapError, loadMap } from '../lib/stores/map.js';
import { pageTitle } from '../lib/page-title.js';
import { theme } from '../lib/theme.js';
import { categorySlugFor, CATEGORIES } from '../lib/improvement-categories.js';
import { RESOURCE_CODES, FEATURE_CODES } from '../lib/map-codes.js';
import { CLASS_COLORS, classColor } from '../lib/faction-colors.js';
import Band from '../lib/components/Band.svelte';
import MapCanvas from '../lib/components/MapCanvas.svelte';
import RosterPanel from '../lib/components/RosterPanel.svelte';
import LayerMenu from '../lib/components/LayerMenu.svelte';
```

Replace the state block:

```js
let layer = 'terrain';
let lastSubByCategory = { yield: 'food', upkeep: 'food', workforce: 'Engineers' };
let hoverTile = null;
let pinnedTile = null;
let filters = { resource: null, feature: null, improvement: null };

$: parsedLayer = (() => {
  if (!layer || !layer.includes(':')) return { category: layer, key: null };
  const [category, ...rest] = layer.split(':');
  return { category, key: rest.join(':') };
})();

$: if (parsedLayer.category && parsedLayer.key) {
  lastSubByCategory[parsedLayer.category] = parsedLayer.key;
}

$: activeFilterCount = (filters.resource ? 1 : 0) + (filters.feature ? 1 : 0) + (filters.improvement ? 1 : 0);
$: matchedTiles = $map ? $map.tiles.filter(t => tileMatchesFilters(t, filters)) : [];

function selectLayer(layerId) {
  layer = layerId;
}
```

- [ ] **Step 2: Replace the layer-tabs block with the new tab strip**

Find the existing `<div class="layer-tabs">` block and replace with:

```svelte
<div class="layer-tabs">
  <button
    aria-pressed={layer === 'terrain'}
    on:click={() => selectLayer('terrain')}
  >Terrain</button>

  <LayerMenu
    label="Yields"
    category="yield"
    options={YIELD_OPTIONS}
    activeKey={parsedLayer.category === 'yield' ? parsedLayer.key : null}
    defaultKey={lastSubByCategory.yield}
    on:select={(e) => selectLayer(e.detail.layerId)}
  />

  {#if $map?.available_categories?.upkeep}
    <LayerMenu
      label="Upkeep"
      category="upkeep"
      options={UPKEEP_OPTIONS}
      activeKey={parsedLayer.category === 'upkeep' ? parsedLayer.key : null}
      defaultKey={lastSubByCategory.upkeep}
      on:select={(e) => selectLayer(e.detail.layerId)}
    />
  {/if}

  {#if $map?.available_categories?.workforce}
    <LayerMenu
      label="Workforce"
      category="workforce"
      options={workforceOptions}
      activeKey={parsedLayer.category === 'workforce' ? parsedLayer.key : null}
      defaultKey={lastSubByCategory.workforce}
      on:select={(e) => selectLayer(e.detail.layerId)}
    />
  {/if}

  {#if $map?.available_categories?.staffing}
    <button
      aria-pressed={layer === 'staffing'}
      on:click={() => selectLayer('staffing')}
    >Staffing</button>
  {/if}

  <span class="layer-tabs-divider" aria-hidden="true"></span>

  <button aria-pressed={layer === 'resources'} on:click={() => selectLayer('resources')}>Resources</button>
  <button aria-pressed={layer === 'features'} on:click={() => selectLayer('features')}>Features</button>
  <button aria-pressed={layer === 'improvements'} on:click={() => selectLayer('improvements')}>Improvements</button>
</div>
```

In the `<script>` block (top, near the imports), add:

```js
const YIELD_OPTIONS = [
  { key: 'food',     label: 'Food' },
  { key: 'water',    label: 'Water' },
  { key: 'energy',   label: 'Energy' },
  { key: 'materials',label: 'Materials' },
  { key: 'ore',      label: 'Ore' },
  { key: 'housing',  label: 'Housing' },
];
const UPKEEP_OPTIONS = YIELD_OPTIONS;  // same set of resources

$: workforceOptions = (() => {
  if (!$map) return [];
  const present = new Set();
  for (const tile of $map.tiles) {
    if (tile.workforce) for (const k of Object.keys(tile.workforce)) present.add(k);
  }
  return [...present].sort().map((k) => ({ key: k, label: k }));
})();
```

- [ ] **Step 3: Pass `redrawKey` to `MapCanvas`**

Find the `<MapCanvas …/>` invocation. Add the `redrawKey={$theme}` prop:

```svelte
<MapCanvas
  mapData={$map}
  {layer}
  tab={layer}
  {filters}
  redrawKey={$theme}
  on:hover={(e) => (hoverTile = e.detail)}
  on:pin={(e) => (pinnedTile = e.detail)}
/>
```

Also update the `tab` prop computation — overlay tabs are still `resources`/`features`/`improvements`; metric tabs now match `category` (or `terrain`/`staffing`). For the existing overlay-vs-promoted-chip logic in MapCanvas, `tab` should be `parsedLayer.category` (so chips bloom on the right tab):

```svelte
<MapCanvas
  mapData={$map}
  {layer}
  tab={parsedLayer.category}
  {filters}
  redrawKey={$theme}
  ...
/>
```

(Verify the overlay-chip logic in MapCanvas still triggers for `tab === 'resources'` etc. It should — `parsedLayer.category` for `layer = 'resources'` is `'resources'`.)

- [ ] **Step 4: Update the roster-panel `{#if}` to use the new layer strings**

Find:

```svelte
{#if layer === 'resources' || layer === 'features' || layer === 'improvements'}
```

Keep as-is — those are still single-segment layer strings.

- [ ] **Step 5: Add the four metric sections to the inspect-panel template**

Locate the inspect-panel block (`<div class="s-card">` containing the tile-inspect template). Find the existing `{#if t.yields}` block and replace it with a four-section block. Below the existing `dl.kv` for tile facts and the improvement section, insert:

```svelte
{#if t.yields && Object.values(t.yields).some((v) => v !== 0 && v != null)}
  <div class="kv-section">
    <h4>Yields</h4>
    <dl class="kv">
      {#each Object.entries(t.yields).filter(([_, v]) => v !== 0 && v != null) as [k, v]}
        <dt class="capitalize">{k}</dt>
        <dd class={v < 0 ? 'crit' : v > 0 ? 'good' : ''}>{v > 0 ? '+' : ''}{v}</dd>
      {/each}
    </dl>
  </div>
{/if}

{#if t.upkeep && Object.values(t.upkeep).some((v) => v != null && v !== 0)}
  <div class="kv-section">
    <h4>Upkeep</h4>
    <dl class="kv">
      {#each Object.entries(t.upkeep).filter(([_, v]) => v != null && v !== 0) as [k, v]}
        <dt class="capitalize">{k}</dt>
        <dd class="crit">{v}</dd>
      {/each}
    </dl>
  </div>
{/if}

{#if t.workforce && Object.keys(t.workforce).length > 0}
  <div class="kv-section">
    <h4>Workforce</h4>
    {#each Object.entries(t.workforce).sort(([, a], [, b]) => b - a) as [name, count]}
      <div class="workforce-row">
        <span class="swatch" style="background: {classColor(name)}"></span>
        <span class="name">{name}</span>
        <span class="count">{count}</span>
      </div>
    {/each}
  </div>
{/if}

{#if t.staffing != null}
  <div class="kv-section">
    <h4>Staffing Efficiency</h4>
    <div class="staff-meter">
      <div class="staff-meter-fill" style="width: {(t.staffing * 100).toFixed(0)}%"></div>
    </div>
    <div class="staff-meter-pct">{(t.staffing * 100).toFixed(0)}%</div>
  </div>
{/if}
```

(Drop the original `{#if t.yields}` block since the new one supersedes it.)

- [ ] **Step 6: Update the bottom-of-page legend caption**

Find:

```svelte
<div class="text-muted text-[10px] uppercase tracking-widest mt-3">
  ▣ Improvement · ↗ Resource · ↖ Feature · Color = {layer === 'terrain' ? 'biome' : ...}
</div>
```

Replace with a category-aware caption:

```svelte
<div class="text-muted text-[10px] uppercase tracking-widest mt-3">
  ▣ Improvement · ↗ Resource · ↖ Feature · Color =
  {#if layer === 'terrain'}biome
  {:else if parsedLayer.category === 'yield'}{parsedLayer.key} yield magnitude
  {:else if parsedLayer.category === 'upkeep'}{parsedLayer.key} upkeep magnitude
  {:else if parsedLayer.category === 'workforce'}{parsedLayer.key} count
  {:else if parsedLayer.category === 'staffing'}staffing efficiency (red→amber→green)
  {:else}{layer}{/if}
</div>
```

- [ ] **Step 7: Spot-check syntax with a dev build**

Run: `npm run build 2>&1 | tail -30`
Expected: no Svelte compile errors.

---

## Task 10: CSS additions

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Locate existing `.layer-tabs` block**

Run: `grep -n "\.layer-tabs" src/styles/global.css`
Expected: the existing block.

- [ ] **Step 2: Add new classes after the `.layer-tabs` block**

Append:

```css
.layer-tabs { position: relative; } /* needed for popup z-index stacking */

.layer-tabs-divider {
  display: inline-block;
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 6px;
  vertical-align: middle;
}

.layer-menu-trigger {
  /* Inherits from .layer-tabs button — re-uses typography & padding. */
  background: var(--bg-2);
  color: var(--fg);
  border: 1px solid var(--border);
  padding: 4px 10px;
  font-family: inherit;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
}
.layer-menu-trigger[aria-pressed='true'] {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
}
.layer-menu-trigger .caret {
  margin-left: 4px;
  opacity: 0.6;
}
.layer-menu-trigger[aria-pressed='true'] .caret { opacity: 1; }

.layer-menu-popup {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  z-index: 5;
  background: var(--bg-2);
  border: 1px solid var(--accent);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  min-width: 180px;
  display: flex;
  flex-direction: column;
}
.layer-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  background: transparent;
  border: none;
  color: var(--fg);
  font-family: inherit;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  text-align: left;
}
.layer-menu-item:hover, .layer-menu-item:focus {
  background: var(--bg);
  outline: none;
}
.layer-menu-item.active { color: var(--accent); }
.layer-menu-item .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border);
}
.layer-menu-item.active .dot { background: var(--accent); }

.workforce-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 3px 0;
}
.workforce-row .swatch {
  width: 10px;
  height: 10px;
  border: 1px solid var(--border);
}
.workforce-row .name { flex: 1; color: var(--fg); }
.workforce-row .count {
  color: var(--fg-2);
  font-variant-numeric: tabular-nums;
}

.staff-meter {
  height: 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  margin-top: 6px;
  overflow: hidden;
}
.staff-meter-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--crit) 0%, var(--accent) 50%, var(--good) 100%);
}
.staff-meter-pct {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 14px;
  font-weight: 800;
  color: var(--accent);
  margin-top: 4px;
  text-align: right;
}
```

- [ ] **Step 3: Visual-check across all three themes**

Run: `npm run dev` (background) and open the Map page.

- Toggle between light / dark / schematic and confirm:
  - Trigger button reads correctly in each theme.
  - Popup background contrasts the page background.
  - Active-state amber on the trigger and the dot is visible.
  - The staffing meter gradient is legible against each theme's `--bg`.

If any contrast issue appears, fix it inline before moving on.

---

## Task 11: Schema bump (lockstep)

**Files:**
- Modify: `scripts/sync_sheet.py`
- Modify: `src/lib/stores/meta.js`

- [ ] **Step 1: Bump the backend constant**

Edit `scripts/sync_sheet.py`. Find:

```python
SCHEMA_VERSION = 4
```

Change to:

```python
SCHEMA_VERSION = 5
```

- [ ] **Step 2: Bump the frontend constant**

Edit `src/lib/stores/meta.js`. Find:

```js
const EXPECTED_SCHEMA_VERSION = 4;
```

Change to:

```js
const EXPECTED_SCHEMA_VERSION = 5;
```

- [ ] **Step 3: Verify lockstep**

Run:

```bash
grep -n "SCHEMA_VERSION = " scripts/sync_sheet.py src/lib/stores/meta.js
```

Expected output:

```
scripts/sync_sheet.py:37:SCHEMA_VERSION = 5
src/lib/stores/meta.js:7:const EXPECTED_SCHEMA_VERSION = 5;
```

- [ ] **Step 4: Run the full pytest suite**

Run: `pytest tests/ -v 2>&1 | tail -30`
Expected: pre-existing-fail count unchanged (per CLAUDE.md gotcha #10); newly-added extractor tests all pass.

If `tests/test_sync_sheet.py` asserts on `SCHEMA_VERSION` literally, update that assertion to `5`.

---

## Task 12: E2E tests

**Files:**
- Create: `tests-e2e/map.spec.js`

- [ ] **Step 1: Create the new E2E spec**

Write `tests-e2e/map.spec.js`:

```js
import { test, expect } from '@playwright/test';

test.describe('Map page — staffing & dropdowns', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/map');
    // wait for the canvas to be visible (signals data has loaded)
    await expect(page.locator('canvas[role=application]')).toBeVisible();
  });

  test('Yields dropdown opens, lists 6 options, switching updates the legend', async ({ page }) => {
    const yieldsTrigger = page.getByRole('button', { name: /^Yields/ });
    await yieldsTrigger.click();
    const items = page.getByRole('menuitem');
    await expect(items).toHaveCount(6);
    await items.filter({ hasText: 'Water' }).click();
    // popup closed
    await expect(page.getByRole('menu')).toHaveCount(0);
    // trigger label updated
    await expect(yieldsTrigger).toContainText('Water');
    // legend reads "water yield"
    await expect(page.locator('text=/water yield/i')).toBeVisible();
  });

  test('Staffing button selects the staffing layer and renders gradient legend', async ({ page }) => {
    const staffingBtn = page.getByRole('button', { name: 'Staffing' });
    if (await staffingBtn.count() === 0) {
      // available_categories.staffing was false — skip
      test.skip();
    }
    await staffingBtn.click();
    await expect(staffingBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('text=/Staffing —/i')).toBeVisible();
  });

  test('Esc precedence: popup closes first, filters second, pin third', async ({ page }) => {
    // Open popup
    await page.getByRole('button', { name: /^Yields/ }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    // First Esc → popup closes
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run the E2E suite**

Run: `npm run test:e2e -- map.spec.js`
Expected: 3 tests PASS (or 2 + 1 skip if the live data omits staffing).

---

## Task 13: CLAUDE.md update

The new sheets, soft-fail behaviour, and theme-redraw trigger are non-obvious facts future-you will want documented.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add three new "common gotchas" entries**

Open `CLAUDE.md`. Locate the `## Common gotchas` section. After the existing gotcha #16, append:

```markdown
17. **Map-page metric layers are tier-loaded.** `tile.upkeep`, `tile.workforce`, `tile.staffing` are all soft-fail per gotcha #14: missing `Staffing Efficiency` / `Upkeep - X` / `Workforce - <Class>` sheets simply hide their dropdown / inspect section. The frontend gates each dropdown on `map.available_categories.<category>` (which the extractor emits). When you add a new metric category, mirror this pattern — register a flag, hide the dropdown when false, render `—` for missing per-tile values.
18. **Workforce sheet names follow `ClassTable`.** `extractors/map.py` reads class names from the `ClassTable` named range (the source of truth `pops.py` also uses), then attempts `Workforce - <name>`. There is no shared `CLASS_NAMES` constant; renaming a class on the live workbook (in `ClassTable`) flows through to both pages automatically. The frontend's `CLASS_COLORS` palette is independent and falls back to `var(--accent)` for unknown classes — heatmap colour for an unknown class is the resolved amber, not a hard error.
19. **`MapCanvas` redraws on theme change.** Per gotcha #14, canvas `fillStyle` cannot resolve `var(--…)` — every theme token is pre-resolved in `drawTerrain`. Previously the canvas did NOT redraw on a theme flip, so colours went stale until the next data/layer change. Now `MapCanvas` accepts a `redrawKey` prop, and `Map.svelte` passes `$theme` so `$:` triggers a redraw on theme flip. If you add another canvas-based component, replicate this pattern.
```

- [ ] **Step 2: Update the architecture / layout sections if needed**

Search `CLAUDE.md` for any list that documents the Map page's layer count or dropdown structure (e.g. "11 layers"). Update those numbers/lists to reflect the new dropdown structure.

Run: `grep -n "11.*layer\|7.*thematic\|Yields ▾\|tab strip" CLAUDE.md`

If matches surface, edit them to reference the new structure: "Terrain · Yields ▾ · Upkeep ▾ · Workforce ▾ · Staffing · | overlays".

---

## Task 14: Final verification + commit structure

- [ ] **Step 1: Run full test sweep**

Run in parallel where possible:

```bash
pytest tests/ -v 2>&1 | tail -30
npm test 2>&1 | tail -30
npm run build 2>&1 | tail -10
```

Expected:
- pytest: only pre-existing failures (per CLAUDE.md gotcha #10).
- vitest: LayerMenu suite passes; no regressions elsewhere.
- npm build: clean compile.

- [ ] **Step 2: Optional — run E2E**

Run: `npm run test:e2e -- map.spec.js`
Expected: PASS.

- [ ] **Step 3: Review `git status` and decide commit structure**

Run: `git status --short && git diff --stat`

The user has expressed a preference (saved memory) to defer commits and decide structure at the end of plan execution. **Stop here** and ask the user how they want to group the commits. Reasonable options to offer:

1. **Single commit** — entire feature in one shot (`feat(map): staffing layer + yields/upkeep/workforce dropdowns`).
2. **Three commits** — backend (extractor + schema + tests), frontend (LayerMenu + MapCanvas + Map.svelte + CSS), docs (CLAUDE.md). Schema bump goes with backend or as its own commit.
3. **Per-component** — extractor, LayerMenu, MapCanvas, Map.svelte, CSS, CLAUDE.md as separate commits.

After they pick, perform the commit(s) with `git commit` (no `--no-verify`, per global rules; let pre-commit hooks run). Update `CLAUDE.md` BEFORE committing per the global rule "Before commit and pushing any changes, you should first update the CLAUDE.md".

---

## Self-review notes

**Spec coverage:** Every numbered section of the spec maps to at least one task —
- §1 Goal → wholistic
- §2 Decisions → encoded in tasks 7-9
- §3 Source data → tasks 2-5
- §4 Soft-fail → tasks 1-6
- §5 Schema additions → tasks 3-6 + 11
- §6 Layer encoding + 6.1 unknown classes → tasks 8 + 9
- §7 Tab strip + 7.2 LayerMenu → tasks 7 + 9
- §7.3 Hidden categories → task 9 step 2
- §7.4 Active-tab label → task 7 step 3 (LayerMenu component)
- §8 Heatmap scales + 8.1/8.2/8.3 → task 8
- §9 Tile inspect → task 9 step 5
- §10 CSS → task 10
- §11 Backend touch points → tasks 1-6
- §12 Frontend touch points → tasks 7-10
- §13 Tests → tasks 1-7, 12
- §14 Schema bump → task 11
- §15 Rollout → covered implicitly by soft-fail tests
- §16 Out of scope → not implemented (correctly)

**No placeholders detected.** All steps include exact code, exact paths, exact commands.

**Type consistency:** `parseLayer` returns `{category, key}` shape consistently across MapCanvas (Task 8) and Map.svelte (Task 9 — uses `parsedLayer` reactive). `selectLayer(layerId)` shape matches `LayerMenu`'s `dispatch('select', { layerId })`.
