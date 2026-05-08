# Improvement Catalog — Design Spec

**Date:** 2026-05-07
**Scope:** Add a player-facing reference of every buildable improvement to the Map dashboard. Catalog data flows from a new `ImprovementsCatalog` named range through the standard sync pipeline into a hidden-by-default modal opened from the Map page. The catalog also becomes the authoritative source for placed-improvement category assignment, replacing the current keyword-regex heuristic with a fuzzy lookup + regex fallback.

## 1. Goals

1. Surface canonical improvement data (cost, yields, upkeep, workforce, splits, notes) without cluttering the Map page by default.
2. Replace the keyword-regex categorizer in `improvement-categories.js` with a name→catalog lookup; regex stays only as the unmapped fallback.
3. Enrich the tile inspector on the Map page with catalog data when a placed improvement matches a catalog row.
4. Degrade gracefully: if the GM hasn't named the range yet, sync still succeeds and the catalog UI is invisible.

## 2. Non-goals

- Editing or simulating builds. Reference only.
- Showing catalog data on any page other than Map.
- Per-improvement art assets / icons beyond the existing 8 category icons.
- Authoring tools for the GM. The catalog is read-only on the player side.

## 3. Source data

A single 2D named range, **`ImprovementsCatalog`**, with a header row at the top and one row per improvement below. Headers (verbatim from GM workbook):

```
Name | Category | Mat Cost | Ore Cost | Eng Cost | $ Cost
Yield: Food | Yield: Materials | Yield: Ore | Yield: Energy | Yield: Housing
Yield: Money | Yield: Helium 3 | Yield: Water | Yield: Stability
Yield: Satisfaction All | Yield: Research
Upkeep: Energy | Upkeep: Materials | Upkeep: Money | Upkeep: Ore | Upkeep: Water
Workforce: Bureaucrats | Workforce: Capitalists | Workforce: Engineers | Workforce: Scientists
Workforce: Security | Workforce: Proprietors | Workforce: Managerial | Workforce: Botanists
Workforce: Industrial Workers | Workforce: Extraction Workers | Workforce: Service Workers
Split: Greens | Split: Cereal | Split: Vat Protein | Split: Algal Paste
Terrain Compatibility (notes) | Ownership Options (notes)
```

The header row is consumed by name (not by index) so column reordering on the GM side is safe. Trailing or interleaved blank rows are skipped.

**Category convention (decided with user):** Category cells must be one of the 8 existing slugs in case-insensitive form: `Energy`, `Mining`, `Habitat`, `Civic`, `Military`, `Agriculture`, `Science`, `Other`. Anything else is logged as a warning to stdout (visible in the GitHub Action log; not Telegram — that channel is reserved for hard sync failures per convention 9) and the row is treated as `other` for slug purposes (raw string preserved in JSON). This commits the GM to a fixed enum without crashing the sync if a typo slips through.

## 4. Backend

### 4.1 New extractor — `scripts/extractors/catalog.py`

Public entrypoint:

```python
def extract(wb) -> dict:
    """Return {'improvements': [...]}. Empty list if range absent or empty."""
```

Behaviour:

- Read via `read_named_range(wb, 'ImprovementsCatalog')` — returns `[]` when missing.
- Treat row 1 as headers; subsequent rows as data. Header normalization: trim + collapse whitespace. Look up known headers via a constant `HEADER_KEYS` map. Unknown headers are silently dropped.
- Skip any row whose `Name` cell is blank (convention 8).
- All numeric cells go through `coerce_number`, then **blank → 0** (convention 7). The previous draft preserved `null` vs `0` distinction, but no consumer uses it; coerce blanks to `0` to keep frontend chip-rendering logic dead-simple.
- Category slugification (case-insensitive, whitespace-trimmed):
  1. Lowercase + trim the raw cell.
  2. If the result is already in the slug set `{energy, mining, habitat, civic, military, agri, science, other}`, use it directly.
  3. Else if the result is `agriculture`, map to `agri`.
  4. Else → `other`; emit a single-line stdout warning.
  5. Raw cell value preserved in `category_raw`.
- A blank `Category` cell → `category_raw = None`, `category = None`. Frontend categorizer treats `None` as "fall through to regex" for that row.
- Stdout warning format: `extractor catalog: unknown category 'Foobar' on 'Heat Pump'`.

### 4.2 Output schema (`public/data/catalog.json`)

```json
{
  "improvements": [
    {
      "name": "Solar Array Field",
      "category": "energy",
      "category_raw": "Energy",
      "costs":   { "materials": 100, "ore": 0, "engineering": 50, "money": 200 },
      "yields":  { "food": 0, "materials": 0, "ore": 0, "energy": 200,
                   "housing": 0, "money": 0, "helium3": 0, "water": 0,
                   "stability": 0, "satisfaction_all": 0, "research": 0 },
      "upkeep":  { "energy": 0, "materials": 1, "money": 0, "ore": 0, "water": 0 },
      "workforce": { "bureaucrats": 0, "capitalists": 0, "engineers": 2, ... },
      "splits": { "greens": null, "cereal": null,
                  "vat_protein": null, "algal_paste": null },
      "terrain_compat": "Mare Plain · Highlands",
      "ownership_options": "Public · Private"
    }
  ]
}
```

**Notes on the schema:**

- `costs.materials` / `costs.engineering` for consistency with yield/upkeep keys (single chip-formatter).
- `yields.satisfaction_all` (with the `_all` qualifier) leaves headroom for future class-scoped satisfaction yields.
- All numeric cells emit `0` (not `null`) when blank — `splits` is the one exception (kept `null` so frontend can detect "no splits at all" vs "all four splits are explicitly zero").

### 4.3 Sync wiring — `scripts/sync_sheet.py`

- Add `extract_catalog` to the per-page extractor loop.
- Always write `public/data/catalog.json` (even when `improvements` is empty) using `write_json_atomic` — convention 5. **gois pattern, not senate pattern.**
- Bump `SCHEMA_VERSION` from **5 → 6** in `scripts/sync_sheet.py:37`.
- Bump `EXPECTED_SCHEMA_VERSION` from **5 → 6** in `src/lib/stores/meta.js:7` in lockstep (convention 3).
- `partial_failures` (gotcha 6): if `extract_catalog` raises mid-run, sync_sheet records `'catalog'` in `meta.partial_failures` and continues.

### 4.4 Schema validator — `scripts/validate_schema.py`

- Add `ImprovementsCatalog` to `SOFT_OPTIONAL_V3_RANGES` (documentation-only).

### 4.5 Tests

- `tests/extractors/test_catalog.py` covers: schema shape, blank-name skip, blank-category fall-through, unknown-category warning, numeric coercion, splits null-only-on-non-food, missing-range path.
- Fixture: `tests/fixtures/build_test_workbook.py` writes 4 catalog rows (one normal, one blank-category, one unknown-category, one blank-name) at named range `A1:AM5`.

## 5. Frontend — store layer

### 5.1 New store — `src/lib/stores/catalog.js`

- `$catalog`: `{ improvements, byName, placedNameLookup }` or `null`.
- `loadCatalog(syncedAt)` — fetch via existing `fetchPage('catalog', syncedAt)`; null/empty data → `catalog.set(null)` silently.
- `resolveImprovementRow(name, cat)` — exported. Memoizes per raw improvement name in `placedNameLookup` (caches both hits and misses).

**Load site (decided):** `src/App.svelte` invokes `loadCatalog($meta.synced_at)` immediately after `loadMeta()` succeeds, parallel to the global boot. **Not** in `Map.svelte:onMount` — page-local loading would race with `MapCanvas` unmounting if the user navigates away mid-fetch.

### 5.2 Categorizer migration — `src/lib/improvement-categories.js`

**Public API rewrite:**

```js
export function getCategorySlug(name, catalog) {
  if (!name) return 'other';
  const row = resolveImprovementRow(name, catalog);
  if (row?.category) return row.category;
  return regexCategorySlug(name);
}

export function categoryFor(improvement, catalog) {
  if (!improvement) return null;
  const slug = improvement.category ?? getCategorySlug(improvement.name, catalog);
  return CATEGORIES[slug] ?? CATEGORIES.other;
}

// Legacy alias kept temporarily so a stale import surfaces a clear error
export function categorySlugFor() {
  throw new Error('categorySlugFor is removed; use getCategorySlug(name, catalog).');
}
```

**Deterministic fuzzy matcher** (in `stores/catalog.js`):

- Longest-shared-prefix wins.
- Min length floor: both strings must be ≥ 4 chars; shared prefix must be ≥ 4.
- Either one string is a full prefix of the other, OR shared prefix ≥ 75% of the longer string.
- Tiebreak on equal-length: prefer exact-stem match (after stripping suffixes like `field`, `mark II`, `complex`, `station`, `outpost`).
- **Order-independent.**

**Migration touch points (5 sites + 3 imports across 3 files):**

| File | What changes |
|---|---|
| `src/routes/Map.svelte` | Import refresh; `tileMatchesFilters` and tile inspector use `getCategorySlug` / `categoryFor` with `$catalog`. |
| `src/lib/components/RosterPanel.svelte` | Import refresh; new `catalog` prop passed from `Map.svelte`. |
| `src/lib/components/MapCanvas.svelte` | Import refresh; ring-colour and cell-fill use `categoryFor(t.improvement, $catalog)`. |

### 5.3 MapCanvas redraw on catalog arrival (gotcha 14 mitigation)

`MapCanvas.svelte` adds `$: if ($catalog) { drawTerrain(...) }` so tiles re-colour when the catalog file lands after `map.json`. Without this, tiles keep regex-derived colours frozen until the next layer change.

## 6. Frontend — UI layer

### 6.1 Launch button

Quiet `.s-chip` ("⌬ Catalog") in the layer-tabs row of `Map.svelte`. Hidden when `$catalog === null` OR `$catalog.improvements.length === 0`.

### 6.2 `CatalogModal.svelte`

Lazy-mount: `{#if catalogOpen}<CatalogModal />{/if}`.

- Header: title, search input, ✕ close.
- Filter strip: category-toggle chips reusing CATEGORIES.
- Body: cards grouped under collapsible category headers.
- Cards: `ImprovementCard.svelte` with name, costs, yields (signed pos/neg), upkeep, workforce, splits (food only), notes.

### 6.3 A11y + DOM mount strategy

- Keydown handler attached via `<svelte:body on:keydown>` so Esc fires regardless of focus location.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="cat-title"`.
- `onMount` (sync): captures `document.activeElement` as trigger, sets `inert` on `#app`, focuses search after `tick()`.
- `onDestroy`: removes `inert`, restores focus to trigger.
- Tab cycling: hand-rolled trap on first/last focusable.
- Esc: closes modal AND `stopPropagation()` so it doesn't collide with `Map.svelte:handlePageKey`.
- Backdrop click: only closes when `mousedown` *and* `click` both target the backdrop (so drag-out-of-modal selecting text doesn't close).

### 6.4 Mobile (< 600px) — full-screen takeover

- `.cat-modal` becomes 100vw × 100vh.
- Card grid collapses to single column.

### 6.5 Tile inspector enrichment

Existing tile inspector aside in `Map.svelte`: when `resolveImprovementRow(t.improvement.name, $catalog)` returns a row, render a "Nameplate stats" `<ImprovementCard imp={nameplate} compact={true} />` subsection below the existing improvement details.

### 6.6 CSS — `src/styles/global.css`

New classes (additive): `.cat-backdrop`, `.cat-modal`, `.cat-header`, `.cat-search`, `.cat-close`, `.cat-cat-strip`, `.cat-body`, `.cat-group`, `.cat-grid`, `.cat-card` (+ `.cat-card-title`/`.cat-card-row`/`.cat-card-notes`), `.cat-chip` (+ `.pos`/`.neg`/`.upkeep`), `.cat-empty`. All use existing theme tokens.

## 7. CLAUDE.md updates

- Layout section adds `CatalogModal` and `ImprovementCard` to the components list.
- Convention 12 vocab list extends with the `.cat-*` classes.
- New gotcha 19 documents the catalog-as-source-of-truth pattern, the redraw trigger, and the load-site choice.

## 8. Out of scope / follow-ups

- Backend GM-facing tooling for editing catalog entries.
- Map filtering by *catalog field* (e.g., "show only buildings that produce energy").
- Class-scoped satisfaction yields (schema reserves `satisfaction_all` for future expansion).
- Compare-two-improvements view.

## 9. Acceptance criteria

1. Sync runs cleanly with the named range present and absent. In both cases `catalog.json` exists with at minimum `{ "improvements": [] }`.
2. Schema mismatch banner triggers if either `SCHEMA_VERSION` constant drifts.
3. Map page shows the `⌬ Catalog` chip only when `$catalog` is non-null and non-empty.
4. Modal opens / closes via button click, backdrop click, Esc, and ✕ button. Focus returns to the launch chip on close. Modal portals via `<svelte:body on:keydown>`; `inert` applied to `#app` while open.
5. Tile inspector shows the "Nameplate stats" subsection when a placed improvement matches a catalog row by fuzzy name. No regression for tiles without a match.
6. Tiles re-colour correctly after catalog arrival, even if the user does nothing.
7. Playwright a11y suite passes.
8. Backend extractor test covers: blank rows, blank category, unknown category emits stdout warning, numeric coercion (formula error → `0`, blank → `0`, explicit `0` → `0`).
9. Fuzzy matcher is deterministic — order of catalog entries doesn't change the result.
10. Per-name memoization works — `placedNameLookup` caches both hits and misses.
