# Map Overlays + Filtering — Design

**Date:** 2026-05-06
**Topic:** Surface Resources, Features, and Improvements as first-class overlays on the Map page, with a roster panel and persistent filtering across tabs.
**Related work:** `2026-05-01-scorp-dashboard-design.md` (original Map page spec), `2026-05-06-demographics-page-and-status-vitals-design.md` (sibling spec, same week).

---

## 1. Goal

Today, the Map page surfaces tile data in seven thematic layers (Terrain + 6 yields) and uses two on-tile glyphs — `▣` for improvements, `◆` for features — that double as the only signal for resources. The result: 211 resource tiles (13 % of the grid) are nearly invisible; the `◆` glyph is overloaded across plain features and resource features; and there is no way to ask the map "where are the Helium-3 deposits?" without hovering tile by tile.

This design adds a typed, three-layer overlay system that:

- shows resources, features, and improvements at a glance on every tab via subtle corner-positioned marks;
- promotes any one overlay to fully-readable on-tile chips by clicking its dedicated tab;
- exposes a roster panel for hunt-by-type and hunt-by-name navigation;
- supports up to three persistent filters (one per overlay) that survive tab switches, so the user can filter "Helium-3" and then flip to the Food yield tab to see whether those tiles also have decent food.

---

## 2. Brainstorm decisions (recap)

| Decision | Choice |
|---|---|
| Per-tile resource mark style | **Letter badges** (chemical-symbol style: He, Fe, Al, P, RE, HM, O₂, W) |
| Visibility rule | **Hybrid** — subtle dot always; full letter chip on the matching overlay's own tab |
| Extends to features and improvements | **Yes** — same hybrid pattern for features; improvements use category icons since they are named per-tile |
| Improvements treatment | **Category icons** (`☀ ⛏ ⌂ ⌧ ⚐ ⚘ ⚗`) on the map + roster with full names |
| Filter persistence | **Persists across tabs** — up to three simultaneous filters (one per overlay), intersection match |
| Clear filters | **Per-chip ✕**, **Clear all** pill, and **Esc** keyboard shortcut |

---

## 3. Tab structure

The layer-tab strip grows from 7 to 10:

| # | Tab | Type | What it shows |
|---|---|---|---|
| 1 | Terrain | thematic *(unchanged)* | Biome colour |
| 2–7 | Food / Water / Energy / Materials / Ore / Housing | thematic *(unchanged)* | Yield gradient |
| 8 | **Resources** | overlay-promotion *(new)* | Full resource letter chips bloom |
| 9 | **Features** | overlay-promotion *(new)* | Full feature letter chips bloom |
| 10 | **Improvements** | overlay-promotion *(new)* | Category icons replace `▣`; right rail roster lists every improvement |

The 7 thematic tabs always show the **default subtle marks** (corner dots + the always-on `▣`). The 3 overlay tabs additionally promote *their* overlay to full chips/icons and surface a roster card in the right rail.

---

## 4. On-map mark system

Three overlays, three corner positions, never collide:

```
┌──────────┐
│ ▦      ▩ │   top-left:  feature dot (small square, type-coloured)
│          │   top-right: resource dot (small round, type-coloured)
│    ▣     │   centre:    improvement glyph (always-on, paint-order stroke)
└──────────┘
```

### 4.1 Default mode (every tab except the overlay's own)

- **Resource dot** — 5–6 px round, top-right corner, fill = `palettes.resource[type]`, 1 px dark border for contrast against light biomes.
- **Feature dot** — 5–6 px square, top-left corner, fill = `palettes.feature[type]`, 1 px dark border.
- **Improvement glyph** — `▣` centred, white fill with stroke-behind-fill outline (matches today's `.map-glyph--improvement` style).

### 4.2 Promoted-chip mode (only on the matching overlay tab)

| Tab | Default elements | Promoted element |
|---|---|---|
| Resources | feature dot · `▣` | Top-right corner becomes a 9–10 px coloured letter pill (`He`, `Fe`, `Al`, `P`, `RE`, `HM`, `O₂`, `W`) |
| Features | resource dot · `▣` | Top-left corner becomes a 9–10 px coloured letter pill (`BI`, `MV`, `SP`, `BF`, `CS`, `MS`, `MA`, `HR`, `CP`) |
| Improvements | resource dot · feature dot | `▣` is replaced with a category icon (`☀ ⛏ ⌂ ⌧ ⚐ ⚘ ⚗`); icon is tinted by `improvement.owner` when present (faction colours from `src/lib/faction-colors.js`), white otherwise |

### 4.3 Letter codes

**Resources (8):**
| Type | Code |
|---|---|
| Helium-3 | `He` |
| Iron Deposit | `Fe` |
| Aluminum Deposit | `Al` |
| Phosphorus Deposit | `P` |
| Rare Earths | `RE` |
| Heavy Metals | `HM` |
| Oxygen Bound Soil | `O₂` |
| Water Ice | `W` |

**Features (9):**
| Type | Code |
|---|---|
| Buried Ice | `BI` |
| Mineral Vein | `MV` |
| Smooth Plain | `SP` |
| Boulder Field | `BF` |
| Cave System | `CS` |
| Recent Meteorite Strikes | `MS` |
| Magnetic Anomaly | `MA` |
| Hollow Rocks | `HR` |
| Crashed Probe | `CP` |

**Improvement categories (7):**
| Category | Icon | Example names |
|---|---|---|
| Energy | `☀` | Solar Array Field |
| Mining | `⛏` | Ice Mining Station, Aluminium Extractor, Rare Earths Extraction |
| Habitat | `⌂` | Pressure Dome, Buried Habitat, Surface Hab Module |
| Civic | `⌧` | Command Center, School, Financial District |
| Military | `⚐` | Outpost |
| Agri | `⚘` | Hydroponic Bay, Vat Culture Lab |
| Science | `⚗` | Research Lab |

### 4.4 Theming

All resolved colours are pre-resolved from CSS custom properties before being handed to canvas (canvas 2D `fillStyle` does not honour `var(…)` — see CLAUDE.md gotcha #14). Three theme variants render correctly because `MapCanvas.svelte` already does this for `--bg` / `--crit`; the new code follows the same pattern.

### 4.5 Rendering

The corner dots and chips render in the existing **SVG overlay** (not the canvas) — they are <40 elements, layout simply, and SVG gives free crisp scaling and accessibility. The dim/ring filter treatment (Section 6.2) renders on the canvas pass.

---

## 5. Roster panel (right rail)

On the 3 new overlay tabs, a **roster card** stacks **above** the existing tile inspector card. Both cards reuse `.s-card` / `.s-card-header` / `.s-card-pad` Mission-Brutalist primitives. On thematic tabs the rail is unchanged.

### 5.1 Resources roster

8 type rows. Each row:

```
[He]  Helium-3              27
[Fe]  Iron Deposit          30
…
```

- Sorted by tile count descending; ties alphabetical.
- The leading swatch is the same letter chip the canvas uses (visual link).
- Click row → toggles the `resource` filter (Section 6).

### 5.2 Features roster

Same shape as Resources, 9 rows.

### 5.3 Improvements roster

Grouped by category. Each leaf row is one tile:

```
☀ Energy
   ▣ Solar Array Field           (27, 0)
   ▣ Solar Array Field           (28, 0)
⛏ Mining
   ▣ Ice Mining Station          (29, 0)
   …
```

- Click a leaf → focuses + pins that tile (re-uses the existing `pin` event from `MapCanvas`).
- Click a category header → toggles the `improvement` filter for that category.
- Categories with zero rows are hidden.

### 5.4 Empty state

If a roster has no rows (e.g. no improvements yet), render `—` placeholder and a one-line muted hint.

---

## 6. Hunt-by-type filtering

Up to **three persistent filters** simultaneously, one per overlay:

```js
filters = {
  resource:    null | 'Helium-3',
  feature:     null | 'Mineral Vein',
  improvement: null | 'mining'   // category slug
}
```

A tile is **matched** iff every active (non-null) filter matches that tile's value (intersection). Empty match set is allowed and rendered as `0 matches` in the active-filters strip.

### 6.1 Active-filters strip

Renders below the layer-tab strip when ≥1 filter is active:

```
[He · Helium-3 ✕]   [MV · Mineral Vein ✕]   ·   2 matches   ·   Clear all
```

- Each chip is dismissible (✕ clears that single filter).
- **Clear all** pill (rightmost) clears every filter.
- Strip disappears when all filters are cleared.

### 6.2 Canvas treatment

When ≥1 filter is active:

1. Canvas paints tiles as normal (terrain or yield gradient).
2. After tile pass, paint a viewport-sized rect at `rgba(bg, 0.7)` over **non-matching** tiles. (Implementation: paint dim everywhere, then re-paint matched tiles on top.)
3. SVG overlay paints a 2 px ring around each matched tile. Ring colour follows a deterministic priority when multiple filters are active: **resource → feature → improvement**. (E.g. with both a resource and a feature filter active, the ring uses the resource type colour.)

Promoted chips on matching tiles render at full opacity; corner dots on non-matching tiles render under the dim layer.

### 6.3 Keyboard

- **Esc** — escalation:
  1. If ≥1 filter active → clear all filters.
  2. Else if a tile is pinned → unpin.
  3. Else → blur canvas.
- **Arrow keys** — unchanged: walk the focus cursor across all tiles, even faded ones.
- **Enter / Space** — unchanged: pin the focused tile.

### 6.4 Persistence scope

Filters are component-local state on `Map.svelte` — they reset when the user navigates away from the Map page. They do **not** persist across page reloads or sync events. (Users can re-filter in seconds; cross-session persistence is not worth the URL-state plumbing for this MVP.)

---

## 7. Inspector card changes

The inspector keeps its existing shape and `.kv` styling. Three small additions:

1. **Resource row gets the type swatch.** When `t.resource` is set: `Resource · [He] Helium-3` with the same chip used on the canvas.
2. **Feature row gets the type swatch.** `Feature · [MV] Mineral Vein`.
3. **Improvement section gets the category icon + a "filter by ☀ Energy" link.** Clicking sets `filters.improvement = 'energy'` and switches to the Improvements tab.

No structural change to the card. The new elements are styled inline within the existing `.kv` definition list.

---

## 8. Data + backend

### 8.1 `map.json` schema additions

Three new entries under `palettes`:

```json
{
  "palettes": {
    "terrain":               { "Mare Plain": "#3c3a3a", … },
    "resource":              { "Helium-3": "#ffd166", "Iron Deposit": "#c97064", … },
    "feature":               { "Mineral Vein": "#c4a484", "Buried Ice": "#b3d9ff", … },
    "improvement_category":  { "energy": "#ffb000", "mining": "#a06840", … }
  }
}
```

Per the existing terrain-palette pattern in `extractors/map.py` (`_palette()` helper), each new palette tries an optional named range first (`ResourcePalette`, `FeaturePalette`, `ImprovementCategoryPalette`) and falls back to a hard-coded constant the dashboard owns. This keeps the design ship-able today while leaving a documented path for the GM to drive colours from the workbook later.

No new required named ranges. Mirrors convention #14 (soft-optional ranges).

### 8.2 Improvement category resolution

A new `src/lib/improvement-categories.js` exports a `categoryFor(name)` keyword-rule mapper:

```js
// Fallback used when the backend doesn't supply improvement.category.
export function categoryFor(name) {
  const n = (name || '').toLowerCase();
  if (/solar|reactor/.test(n))                 return 'energy';
  if (/extract|mining|station/.test(n))        return 'mining';
  if (/dome|habitat|hab module/.test(n))       return 'habitat';
  if (/center|school|district|civic/.test(n))  return 'civic';
  if (/outpost|barracks|garrison/.test(n))     return 'military';
  if (/hydroponic|vat|farm|agri/.test(n))      return 'agri';
  if (/lab|research/.test(n))                  return 'science';
  return 'other';
}
```

If the workbook later adds a `Category` column to the Improvements manifest and the extractor populates `improvement.category`, that value overrides the keyword rule — frontend prefers `improvement.category ?? categoryFor(improvement.name)`.

The spec adds an `'other'` bucket so unrecognised names still group somewhere; the icon for `other` is `⌬` (no semantics, just "marker").

### 8.3 Schema version bump

Per convention #3, bump in lockstep:

- `scripts/sync_sheet.py` — `SCHEMA_VERSION` (current → next)
- `src/lib/stores/meta.js` — `EXPECTED_SCHEMA_VERSION`

This is the canonical signal that the Map page contract has changed. Frontend without the new fields would still render (palette fallbacks handle missing keys gracefully), but bumping the version is correct for any consumer reading the JSON directly.

### 8.4 Faction colour reuse

`improvement.owner` tinting on the Improvements tab uses `src/lib/faction-colors.js`. When `owner` is null (the current default), the icon renders white. When populated, it picks the faction colour token. No new palette needed for owners — they already have one.

---

## 9. Files touched

**New:**
- `src/lib/components/RosterPanel.svelte` — single component, accepts `kind: 'resource' | 'feature' | 'improvement'` and `mapData`.
- `src/lib/improvement-categories.js` — keyword rule + icon mapping.
- `src/lib/map-palettes.js` — small helper exposing palette lookups (defaults + override by `mapData.palettes`).

**Modified:**
- `scripts/extractors/map.py` — emit three new palette keys; honour optional named ranges.
- `scripts/sync_sheet.py` — `SCHEMA_VERSION` bump.
- `src/lib/stores/meta.js` — `EXPECTED_SCHEMA_VERSION` bump.
- `src/lib/components/MapCanvas.svelte` — corner dot rendering, chip rendering, filter dim/ring, accept `filters` + `tab` props, dispatch hover/pin (unchanged).
- `src/routes/Map.svelte` — extend `LAYERS` to 10 entries; add `filters` state, active-filters strip, mount RosterPanel on overlay tabs.
- `src/styles/global.css` — `.roster`, `.roster-row`, `.filter-strip`, `.filter-chip`, `.imp-cat-icon`, `.feat-chip`, `.res-chip` classes; theme tokens for resource / feature swatches.

**Tests:**
- `tests/test_extractor_map.py` — assert new palette keys present; resource/feature palette fallbacks work when named range absent.
- `tests-e2e/a11y.spec.js` — extend Map suite: visit each new overlay tab, run axe; verify roster keyboard nav (`Tab` to focus first row, `Enter` toggles filter, `Esc` clears).
- `tests-e2e/map-overlays.spec.js` *(new)* — happy-path coverage for the keyword-category mapping (place a known improvement on a fixture grid, assert the rendered icon class), filter persistence across tab switches, and clear-all behaviour. (No frontend unit-test framework exists in the repo today; covering the keyword rule via Playwright keeps the test surface coherent rather than introducing vitest just for one helper.)

---

## 10. Out of scope

Explicitly **not** doing in this design (potential follow-ups):

- Cross-session filter persistence (URL state, localStorage).
- Multi-select within an overlay (e.g. filter `He` AND `Fe` simultaneously). Single-value-per-overlay keeps the model simple; can be revisited.
- Search box on the rosters. Eight rows on Resources / nine on Features / seventeen leaves on Improvements is small enough to scan without search.
- Drag-pan or zoom on the canvas. Current full-grid view fits the use case.
- Tooltip on dot hover. Hover already updates the inspector card; doubling up is noise.
- Map.json rewrite to an indexed-by-type structure. Current per-tile storage is fine at 1600 tiles; type aggregation happens in the roster derived store.

---

## 11. Open questions

None blocking. Two things worth flagging for the GM:

1. **Resource type names** are stored verbatim in `map.json` ("Aluminum Deposit", "Iron Deposit" — note the inconsistent suffix). The letter-code mapping is defensive (`startsWith` / keyword matching), but the GM may want to canonicalise these in the workbook for cleaner palettes.
2. **Owner data** (`improvement.owner`) is currently null across all 17 improvements in the live data. The faction-tinting code path will be exercised only when the GM starts populating that field. Until then, the Improvements tab paints icons in white — still legible, just monochrome.

---

## 12. Acceptance

The design is correct when, on a freshly-synced workbook:

- The Map page renders 10 tabs.
- Every thematic tab shows the corner-dot system without obscuring the yield gradient (visual diff against the current Map screenshot).
- Each overlay tab promotes its chips/icons; the matching roster appears in the right rail.
- A user can click `He` in the Resources roster, switch to the Food tab, and see Helium-3 tiles ringed with non-matching tiles dimmed.
- Adding a second filter (e.g. `MV`) restricts to the intersection.
- `✕` on a filter chip clears just that filter; "Clear all" clears all; Esc clears all.
- Inspector card shows the new swatches when a tile carries a resource/feature; clicking the category icon in the improvement section sets the improvement filter and switches tabs.
- Playwright + axe a11y job passes on each new tab.
- The schema validator in `sync_sheet.py` reports no missing required ranges (all new palette ranges are soft-optional).
