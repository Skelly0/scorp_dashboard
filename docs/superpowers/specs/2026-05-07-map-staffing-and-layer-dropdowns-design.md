# Map — Staffing Efficiency Layer + Yields/Upkeep/Workforce Dropdowns

**Date:** 2026-05-07
**Topic:** Add a per-tile Staffing Efficiency heatmap to the Map page, and reorganise the layer-tab strip so the multi-option metric categories (yields, upkeep, workforce) live behind popup dropdowns instead of inflating the tab row.
**Related work:** `2026-05-06-map-overlays-and-filtering-design.md` (current Map structure), `2026-05-01-scorp-dashboard-design.md` (original Map spec).

---

## 1. Goal

Today, the Map page exposes 7 thematic tabs (Terrain + 6 yield types) and 3 overlay tabs. Adding **upkeep**, **per-class workforce**, and **staffing efficiency** as additional thematic layers would push the strip to 7 + 6 + 11 + 1 + 3 = **28 tabs** — visually unusable and too noisy.

This design:

- adds Staffing Efficiency as a new per-tile heatmap (single tab);
- groups the 6 yield sub-layers, 6 upkeep sub-layers, and 11 workforce sub-layers behind 3 popup-menu tabs (Yields ▾, Upkeep ▾, Workforce ▾);
- extends the tile-inspect panel to surface all four metric categories simultaneously when a tile has data;
- soft-fails missing source sheets so the dashboard degrades gracefully if the GM hasn't named the workbook ranges yet (mirrors gotchas #6 and #14).

---

## 2. Brainstorm decisions (recap)

| Decision | Choice |
|---|---|
| Staffing source shape | **Single 40×40 grid of % values** (`Staffing Efficiency` sheet, 0–1 floats) |
| Upkeep source shape | **Six sheets** mirroring yields: `Upkeep - Food / Water / Energy / Materials / Ore / Housing` |
| Workforce source shape | **Eleven sheets**, one per pop class (`Workforce - <Class>`) |
| Dropdown UI pattern | **Popup menu on button click** — click parent tab, vertical popup of sub-options, dot marker on active |
| Tile-inspect behaviour | **Always-on sections**, hidden when empty (Yields / Upkeep / Workforce / Staffing render whenever the tile has data, on every tab) |

---

## 3. Source data — new workbook sheets

All sheets are read by name (mirroring the existing `Yield - <Resource>` pattern in `extractors/map.py`). All are 40×40 grids with `(row, col) = (y+1, x+1)`.

| Sheet | Cell value | Sign |
|---|---|---|
| `Staffing Efficiency` | float, 0.0–1.0 (rendered as 0–100 %) | non-negative |
| `Upkeep - Food` … `Upkeep - Housing` (6 total) | float, cost units | non-negative |
| `Workforce - Bureaucrats` … `Workforce - Service Workers` (11 total) | int, worker count | non-negative |

**Workforce sheet names** must match the pop-class names listed in the workbook's `ClassTable` named range — which is the source of truth used by `extractors/pops.py` to drive every per-class loop. The extractor reads class names from `ClassTable` and then attempts `Workforce - <name>` for each. There is no hardcoded `CLASS_NAMES` constant; adding or renaming a class on the live workbook (in `ClassTable`) is the only edit point.

For reference, the live workbook currently emits these 11 names (matching `CLASS_COLORS` in `src/lib/faction-colors.js`):

> Bureaucrats · Capitalists · Engineers · Scientists · Security · Proprietors · Managerial · Botanists · Industrial Workers · Extraction Workers · Service Workers

A class present in `ClassTable` but missing from `CLASS_COLORS` (e.g. a new class added by the GM but not yet known to the frontend palette) is handled gracefully — see §6 and §9.1 for the fallback.

---

## 4. Soft-fail behaviour

Existing yield sheets stay **mandatory** (they're documented contracts and 6 known names). All 18 new sheets are **optional**:

- A new helper `_read_grid_optional(wb, sheet_name)` returns `None` if the sheet is absent.
- `extract()` threads `None` through to per-tile keys: `tile.upkeep["food"] = None`, `tile.workforce["Engineers"] = None`, `tile.staffing = None`.
- If **every** sheet for a category is missing, the extractor outputs `tile.upkeep = None` (instead of a dict full of `None`s). The frontend uses this to hide the entire dropdown for that category.
- A whole-category miss is also surfaced via a new `available_categories` field on the map payload (see §5) so the frontend doesn't need to scan every tile.
- Missing-sheet warnings are appended to `meta.partial_failures` (existing channel) so we have telemetry without crashing.

This matches CLAUDE.md gotchas #6 (`partial_failures`) and #14 (palette tier-loading).

---

## 5. Schema additions to `map.json`

```jsonc
{
  "schema_version": 5,           // bumped from 4
  "width": 40,
  "height": 40,
  "tiles": [
    {
      "x": 12, "y": 7,
      "terrain": "Mare Plain",
      "feature": "Buried Ice",
      "resource": "Water Ice",
      "slots": 3,
      "improvement": { "name": "...", "owner": "...", "ownership_type": "..." },
      "yields":    { "food": 0, "water": 4.5, "energy": -0.5, ... },   // existing
      "upkeep":    { "food": 1.0, "water": 0, "energy": 2.5, ... } | null,   // new
      "workforce": { "Engineers": 12, "Industrial Workers": 8, ... } | null, // new
      "staffing":  0.76 | null    // new — float in [0, 1]
    },
    ...
  ],
  "palettes": { ... },
  "available_categories": {       // new — top-level hint for the UI
    "upkeep":    true,             // false when all 6 upkeep sheets are missing
    "workforce": true,             // false when all workforce sheets are missing
    "staffing":  true              // false when the Staffing Efficiency sheet is missing
  },
  // yields is omitted — mandatory, always present, the UI always renders it.
  "missing_sheets": []             // new — see §11.2; rich detail of which optional sheets were missing this sync
}
```

`workforce` only contains entries for classes whose sheet exists AND whose tile value is ≥ 1. Classes with zero workers on a tile are omitted to keep the inspect panel terse. (If the GM emits the sheet but a tile is empty, the value is dropped at extract time.)

---

## 6. Layer encoding (frontend)

A layer becomes a composite string `"<category>:<key>"`, with two single-segment exceptions:

| Encoded | Category | Key |
|---|---|---|
| `terrain` | (special) | — |
| `yield:food`, `yield:water`, `yield:energy`, `yield:materials`, `yield:ore`, `yield:housing` | `yield` | resource |
| `upkeep:food` … `upkeep:housing` | `upkeep` | resource |
| `workforce:Engineers`, `workforce:Industrial Workers`, … (11) | `workforce` | class name |
| `staffing` | (special) | — |
| `resources`, `features`, `improvements` | (overlay) | — |

`Map.svelte` stores the active layer as this string. `MapCanvas` parses it once into `{ category, key }` and looks up `tile.yields[key]` / `tile.upkeep[key]` / `tile.workforce[key]` / `tile.staffing`.

### 6.1 Unknown classes

If the GM adds a `Workforce - <NewClass>` sheet for a class not yet in `CLASS_COLORS` (frontend palette), the dashboard handles it gracefully:

- The Workforce dropdown lists the new class (sourced from `ClassTable`, not from `CLASS_COLORS`) — so it's selectable.
- The heatmap falls back to the resolved `--accent` (amber) for the gradient — see §8.1.
- The inspect panel renders the row with `var(--accent)` for the swatch — works because it's a CSS context, not a canvas one.

To get a proper class colour, someone adds the new class to `CLASS_COLORS` in `src/lib/faction-colors.js`. Until then, the data is visible but un-themed. (No throw, no banner — graceful fallback only.)

---

## 7. Tab strip — popup dropdowns

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [Terrain] [Yields · Water ▾] [Upkeep · Food ▾] [Workforce · Engineers ▾] [Staffing] │   │
│                                                                            [Resources]  │
│                                                                            [Features]   │
│                                                                            [Improvemts] │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

(Tabs flow horizontally; the `│` is a thin vertical divider between metric tabs and overlay tabs. Wrapping is the same as today.)

### 7.1 Tab kinds

| Kind | Tabs | Behaviour |
|---|---|---|
| Single | Terrain, Staffing, Resources, Features, Improvements | Click selects |
| Popup | Yields ▾, Upkeep ▾, Workforce ▾ | Click toggles a popup menu |

### 7.2 Popup-menu component (`<LayerMenu>`)

A new component at `src/lib/components/LayerMenu.svelte`. Owns:

- the trigger button (with active-state styling matching `.layer-tabs button[aria-pressed=true]`);
- the floating popup (absolutely positioned, opens below the trigger, dismissed by outside click / Escape / tab change / sub-option click);
- a label that updates with the active sub-option (e.g. `Yields · Water` becomes `Yields · Energy`);
- a remembered `lastUsedSub` so re-entering the dropdown after a detour still highlights what the user picked previously.

**Props:**
```js
export let label;          // 'Yields' | 'Upkeep' | 'Workforce'
export let category;       // 'yield' | 'upkeep' | 'workforce'
export let options;        // [{ key: 'food', label: 'Food' }, ...]
export let activeKey;      // string | null — the active sub-option, or null if not the active tab
export let defaultKey;     // string — fallback when activeKey is null
// dispatch('select', { layerId: 'yield:food' })
```

**Default sub-option** (used when first selecting the dropdown's parent or when `lastUsedSub` is unset): `food` for Yields and Upkeep, `Engineers` for Workforce. Engineers chosen because it's the most common operational class on Map-relevant tiles.

**Re-clicking the parent button when its dropdown is already the active tab:** opens the popup (so the user can switch sub-option). When the dropdown is **not** the active tab, the first click selects its `lastUsedSub` (no popup) — so most quick-toggles between Yields and Upkeep are 1 click, not 2. The popup is only needed to switch sub-option.

**Keyboard:** Tab/Shift-Tab focuses the trigger; Enter/Space opens the popup; ↑/↓ moves focus inside the popup; Enter/Space selects; Esc closes.

**Esc precedence with the page-level handler.** `Map.svelte:handlePageKey` already binds Esc to (a) clear filters, then (b) un-pin the tile. The popup-level Esc must take precedence over both — when a popup is open, Esc closes only the popup and `stopPropagation()`s. The page-level handler then runs unchanged for cases (a)/(b) on subsequent Esc presses. Order: Esc1 closes popup → Esc2 clears filters → Esc3 un-pins.

### 7.3 Hidden categories

If `map.available_categories[c] === false`, the corresponding popup tab is **not rendered**. (E.g. when the GM hasn't added the Staffing sheet yet, the Staffing tab simply doesn't exist; the user sees only the categories the workbook supports.)

### 7.4 Active-tab → URL-style label format

The button label is `{Label} · {Sub}` when its dropdown is the active tab, and just `{Label}` otherwise. Examples:

- Active layer `yield:water` → `Yields · Water` (active button), `Upkeep` (inactive), `Workforce` (inactive).
- Active layer `upkeep:food` → `Yields` (inactive — but still remembers `Water`), `Upkeep · Food` (active), `Workforce` (inactive).
- Active layer `terrain` → all three popup tabs render plain `Yields` / `Upkeep` / `Workforce`.

This keeps the active sub-option visible at a glance without making inactive tabs noisy.

---

## 8. Heatmap colour scales (`MapCanvas`)

`computeLayerMax` and `tileColor` generalise to take a `(category, key)` pair and pick the right scale. Today's logic only handles "yield" — we extend it to four cases.

**Critical: per gotcha #14, canvas `fillStyle` does NOT resolve `var(--…)` — even nested inside `color-mix()`.** Every token must be pre-resolved to a concrete hex/rgb string before being handed to `fillStyle`. The existing `drawTerrain` already pre-resolves `--bg` and `--crit` into a local `theme` object; we extend that pattern to cover all new tokens.

### 8.1 Pre-resolved theme tokens

`drawTerrain` builds a `theme` object once per render via `getComputedStyle(canvas)`:

```js
const styles = getComputedStyle(canvas);
const theme = {
  bg:           styles.getPropertyValue('--bg').trim()           || '#0a0a0a',
  crit:         styles.getPropertyValue('--crit').trim()         || '#ff4d4d',
  good:         styles.getPropertyValue('--good').trim()         || '#38d39f',
  amber:        styles.getPropertyValue('--accent').trim()       || '#ffb000', // staffing midpoint
  // class colours are concrete hex in CLASS_COLORS — no var() indirection
};
```

Class colours come from `CLASS_COLORS` in `src/lib/faction-colors.js` (concrete hex), accessed via the existing `classColor(name)` helper. Unknown classes return the literal string `var(--accent)`, which is invalid in canvas — so `tileColor` for `workforce` calls `classColor(key)` and substitutes `theme.amber` (the resolved `--accent`) when the result starts with `var(`.

### 8.2 Per-category scale

| Category | Scale | Implementation |
|---|---|---|
| `yield` (existing) | green for positive, red for negative | unchanged |
| `upkeep` (new) | single red gradient `0 → max` | `color-mix(in srgb, ${theme.crit} ${pct}%, ${theme.bg})` — both tokens pre-resolved |
| `workforce` (new) | single class-accent gradient `0 → max` | `const swatch = resolveClassColor(key, theme); color-mix(in srgb, ${swatch} ${pct}%, ${theme.bg})` — `swatch` is the concrete hex, never `var(--accent)` |
| `staffing` (new) | red → amber → green diverging at 50 % | piecewise: `t<0.5` → mix `theme.crit` & `theme.amber` by `t*2`; `t>=0.5` → mix `theme.amber` & `theme.good` by `(t-0.5)*2`. All three are pre-resolved hex. |

`computeLayerMax` returns `{ pos, neg }` for `yield` (today) and `{ max }` for the three new categories (single-sided). The two shapes are kept separate to avoid leaking signed semantics into the new categories.

`Math.max(0.15, t)` floor (today's "non-zero is always visible") carries over for `upkeep` and `workforce`. Staffing skips the floor — 0% must read as fully red, not 15%-mixed.

### 8.3 Theme-flip redraw

Today's `drawTerrain` is reactive only on `mapData`, `layer`, `layerMax`, and `filters`. A theme change does not currently trigger a redraw — colours bake until the next data/layer change (gotcha #14, "stale colours after theme flip"). With three new gradient surfaces (upkeep, workforce, staffing) the staleness becomes much more visible.

**Decision:** add theme as a redraw trigger. `Map.svelte` (or `MapCanvas`) reads `document.documentElement.dataset.theme` reactively (the existing `theme` store from `src/lib/theme.js` is the cleanest source) and threads it as a `redrawKey` prop on `MapCanvas`. `drawTerrain` adds `redrawKey` to its `$:` dependency list. No semantic effect when the theme doesn't change; instant redraw when it does.

### 8.2 Legend strip

The legend below the canvas (`{layer} yield —`) becomes category-aware:

| Active layer | Legend |
|---|---|
| `terrain` | (no legend, as today) |
| `yield:water` | `Water yield — 0 to +4.5` (green swatch) `· 0 to −0.5` (red swatch) |
| `upkeep:food` | `Food upkeep — 0 to 3.0` (red swatch) |
| `workforce:Engineers` | `Engineers — 0 to 24` (Engineers-blue swatch) |
| `staffing` | `Staffing — 0% to 100%` (red→amber→green gradient bar) |
| `resources` / `features` / `improvements` | (no legend, as today) |

---

## 9. Tile-inspect panel — always-on metric sections

The inspect card already shows: tile coords + facts (Terrain, Feature, Resource, Slots) and an Improvement section when present. We add four new sections below Improvement, each gated only by data presence:

```
┌─ Tile · (12, 07) ──────────────────┐
│ Terrain    Mare Plain              │
│ Feature    [BI] Buried Ice         │
│ Resource   [W]  Water Ice          │
│ Slots      3                       │
│ ┌─ ▣ Improvement ────────────────┐ │
│ │ Name      Polar Water Extractor│ │
│ │ Owner     Lunar Aquifer Co.    │ │
│ │ Type      Private              │ │
│ └────────────────────────────────┘ │
│                                    │
│ Yields                             │
│ Water     +4.5  (green)            │
│ Energy    −0.5  (red)              │
│                                    │
│ Upkeep                             │
│ Food      1.0   (red)              │
│ Energy    2.5   (red)              │
│                                    │
│ Workforce                          │
│ ■ Engineers          12            │
│ ■ Industrial Workers  8            │
│ ■ Service Workers     3            │
│                                    │
│ Staffing Efficiency                │
│ ▰▰▰▰▰▰▰▰░░░  76%                  │
└────────────────────────────────────┘
```

### 9.1 Section render rules

- **Yields:** unchanged from today. Always rendered when `tile.yields` has any non-zero entry. Each row uses existing green/red colouring for sign.
- **Upkeep:** rendered when `tile.upkeep` is non-null AND has any non-zero entry. Rows use red colouring (cost is inherently negative-flavoured even though the value is positive).
- **Workforce:** rendered when `tile.workforce` is non-null AND has any non-zero entry. Rows show a class swatch (`classColor`), the class name, and the count. Rows are **sorted by count descending** so the dominant class appears first.
- **Staffing Efficiency:** rendered when `tile.staffing != null`. Shows a horizontal bar with a red→amber→green gradient fill at the staffing percentage, plus the % label. Bar uses the existing `.bar` / `.bar-row` CSS pattern with a custom gradient fill instead of solid `var(--good)`/`var(--crit)`.

### 9.2 Empty-tile copy

If a tile has none of yields/upkeep/workforce/staffing data (e.g. an empty crater floor), no metric sections render — the inspect card stops at facts + improvement (current behaviour for tiles with no improvement either). No "no metric data" placeholder; absence is its own message.

### 9.3 No layer-specific filtering

Per the brainstorm decision, switching tabs does NOT change which metric sections appear. The inspect panel is the canonical source for everything about a tile; the heatmap is the spatial lens. The user explicitly opted for "looks good — go with this" (always-on sections) over the active-only and overlay-hide alternatives.

---

## 10. CSS additions to `global.css`

New classes (mirroring the `s-`-prefixed family):

| Class | Purpose |
|---|---|
| `.layer-menu` | Trigger button (extends `.layer-tabs button`) |
| `.layer-menu-popup` | Floating popup container |
| `.layer-menu-item` | Single sub-option row |
| `.layer-menu-item.active` | Active sub-option (radio-dot indicator) |
| `.staff-meter` | Outer track for the staffing bar |
| `.staff-meter-fill` | Inner gradient fill |

Plus three new theme-token reads (no new tokens — we reuse `--bg`, `--bg-2`, `--accent`, `--accent-soft`, `--good`, `--crit`).

The popup uses `position: absolute; z-index: 5;` against an `overflow: visible` parent so it floats over the canvas. Existing `.layer-tabs` is wrapped in a `position: relative` container if it isn't already.

---

## 11. Backend touch points

| File | Change |
|---|---|
| `scripts/sync_sheet.py` | Bump `SCHEMA_VERSION 4 → 5`. |
| `scripts/extractors/map.py` | Add `_read_grid_optional`; wire up the 18 new sheets; populate `tile.upkeep`, `tile.workforce`, `tile.staffing`; emit `available_categories`; append misses to `meta.partial_failures`. |
| `scripts/extractors/_common.py` | (No change — `_read_grid_optional` is map-specific, but if a second extractor wants the same pattern later, promote it.) |
| `scripts/validate_schema.py` | No new hard-required ranges. The schema version bump is enough; the new sheets are sheet-keyed reads, not named-range reads. |
| `tests/fixtures/build_test_workbook.py` | Add the 18 new sheets with a few non-zero cells. |

### 11.1 Workforce sheet read shape

Each `Workforce - <Class>` sheet is a 40×40 grid of integer worker counts. The extractor:

1. Reads the `ClassTable` named range to get the canonical class list (same source `pops.py` uses — there is no shared `CLASS_NAMES` constant).
2. For each class name, attempts to read `Workforce - <name>` via `_read_grid_optional`. Missing → silent skip; that class simply won't appear in any tile's `workforce` dict.
3. Builds the per-tile dict by iterating the read sheets and dropping zero entries. So most tiles end up with a small dict of just the classes actually present.

If `ClassTable` itself is unreadable (which would be a pre-existing bug — pops.py also depends on it), the workforce category is treated as wholly missing (`tile.workforce = None` for every tile, `available_categories.workforce = false`).

### 11.2 missing_sheets reporting

Soft-fail misses are recorded on the map.json output itself, under a new top-level `missing_sheets` array:

```jsonc
"missing_sheets": [
  { "kind": "missing_sheet", "sheet": "Staffing Efficiency" },
  { "kind": "missing_sheet", "sheet": "Upkeep - Ore" },
  { "kind": "missing_sheet", "sheet": "Workforce - Engineers" }
]
```

**Why a per-page field rather than `meta.partial_failures`:** the existing sync-level `partial_failures` channel in `sync_sheet.py` is `list[str]` of *page names* (e.g. `["pops", "senate"]`) and signals "this whole page failed to extract" — a different semantic from "an optional sub-sheet was missing but the page rendered fine." Reusing that channel would either require changing its contract (riskier) or emitting `"map"` for any missing optional sheet (over-noisy). Putting the rich detail on map.json keeps both contracts intact and gives future work a clean place to render it.

The frontend doesn't currently consume `missing_sheets`; the data path is there for future telemetry / banners.

### 11.3 Staffing scaling

The `Staffing Efficiency` sheet is read raw (0.0–1.0 floats per cell) and stored as `tile.staffing` without scaling. Display formatting (× 100 → %) happens in the frontend.

---

## 12. Frontend touch points

| File | Change |
|---|---|
| `src/lib/stores/meta.js` | Bump `EXPECTED_SCHEMA_VERSION 4 → 5`. |
| `src/routes/Map.svelte` | Replace flat `LAYERS` array with grouped tab definition; integrate `<LayerMenu>` × 3; thread the new `tile.upkeep` / `workforce` / `staffing` keys into the inspect-panel template; gate dropdown rendering on `available_categories`. |
| `src/lib/components/MapCanvas.svelte` | Generalise `tileColor` and `computeLayerMax` to four categories; add red→amber→green gradient helper; pre-resolve new theme tokens; update legend block to be category-aware. |
| `src/lib/components/LayerMenu.svelte` | **New** — popup-menu component (see §7.2). |
| `src/styles/global.css` | Add `.layer-menu*`, `.staff-meter*` classes; theme-tokenise across all three themes (light / dark / schematic). |

---

## 13. Tests

### 13.1 Backend (pytest)

- `tests/test_map_extractor.py` (new or extended):
  - All 18 new sheets present + populated → `tile.upkeep`, `tile.workforce`, `tile.staffing` populated as expected; `available_categories` all `true`.
  - Staffing sheet missing → `tile.staffing == None`, `available_categories.staffing == False`, no exception.
  - All 6 upkeep sheets missing → `tile.upkeep == None`, `available_categories.upkeep == False`.
  - Mixed: 4 of 6 upkeep sheets present → `tile.upkeep` is a dict with 4 keys (none for missing categories), `available_categories.upkeep == True`.
  - Workforce sheet for an unknown class is silently ignored (defensive — schema will catch it eventually but extractor shouldn't crash).

- `tests/test_schema_validator.py`: no new required ranges, but ensure the schema version assertion still passes for the bumped version.

### 13.2 Frontend (Vitest)

- `LayerMenu.svelte` — open / close behaviour, Esc dismissal, last-used-sub memory, label format.

### 13.3 E2E (Playwright)

- `tests-e2e/map.spec.js` (extend):
  - Click `Yields ▾` button → popup visible with 6 items → click `Water` → popup closes, tab label updates to `Yields · Water`, canvas repaints (legend reads "Water yield").
  - Pin a tile that has staffing data → inspect panel shows the staffing meter; staffing percentage matches the data.
  - Hide-when-empty: pin an empty tile → no metric sections in the inspect panel.
- a11y: the new tab+popup combination should not regress the axe score (focus order, ARIA roles).

---

## 14. Schema-version bump

- `scripts/sync_sheet.py` — `SCHEMA_VERSION = 5`.
- `src/lib/stores/meta.js` — `EXPECTED_SCHEMA_VERSION = 5`.

These must land in the same commit per gotcha #3, with all backend + frontend changes. A mismatch surfaces the maintenance banner.

---

## 15. Rollout

The new sheets are all soft-fail. Rollout sequence:

1. Land schema bump + extractor + frontend, with all 18 new sheets *optional*. If the live workbook lacks them, the dashboard still renders — Yields/Upkeep/Workforce/Staffing dropdowns simply hide themselves, and the inspect panel skips those sections.
2. GM adds `Staffing Efficiency` to the workbook → next sync exposes Staffing tab + section.
3. GM adds the 6 `Upkeep - *` sheets → Upkeep dropdown appears.
4. GM adds the 11 `Workforce - *` sheets → Workforce dropdown appears.

No coordinated cutover required.

---

## 16. Out of scope

- **Computed "Net" layer** (yield − upkeep). Easy to add later as a virtual sub-option under Yields, but YAGNI for now.
- **History snapshots** of staffing/upkeep/workforce. Not in `history/year-NNN.json`.
- **Stacked bar visualisation** of workforce composition on the inspect panel. KV-list with sorted-descending rows for v1.
- **Keyboard shortcut for cycling sub-layers** (e.g. `[` / `]` to step through Yields). Could revisit later.
- **Filter chips for staffing / workforce thresholds** (e.g. "show only tiles with staffing < 50%"). Out of scope for v1; the existing filter strip is resource/feature/improvement only.
- **GoI-coloured workforce gradient** (using `goiColor` instead of `classColor`). Class-keyed for v1; if the class breakdown ever surfaces a faction gradient need, revisit.

---

## 17. Open questions

None blocking — design is fully specified above. Sheet-naming convention for workforce sheets is the one assumption (mirrored from yields/upkeep); GM can rename sheets and we'll follow.

---

## 18. References

- Existing Map spec: `docs/superpowers/specs/2026-05-01-scorp-dashboard-design.md` §5
- Map overlays + filtering: `docs/superpowers/specs/2026-05-06-map-overlays-and-filtering-design.md`
- `extractors/map.py` — current grid-reading pattern
- `src/lib/components/MapCanvas.svelte` — current heatmap + legend
- `src/lib/faction-colors.js` — class colour palette
- CLAUDE.md gotchas #6 (`partial_failures`), #14 (palette tier-loading + canvas token resolution), #15 (filter ring colour priority)
