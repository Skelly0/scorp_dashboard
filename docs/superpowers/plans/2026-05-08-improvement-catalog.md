# Improvement Catalog Implementation Plan

**Goal:** Add a hidden-by-default Improvement Catalog modal to the Map page, sourced from a new `ImprovementsCatalog` named range, and migrate placed-improvement category assignment to use the catalog as source of truth.

**Architecture:** A new Python extractor reads `ImprovementsCatalog` from the workbook into `public/data/catalog.json`. A new Svelte store loads it globally from `App.svelte` after `loadMeta`. `improvement-categories.js` is rewritten to consult the catalog (exact + deterministic longest-shared-prefix fuzzy match) before falling back to the existing keyword regex. `MapCanvas.svelte` adds a reactive trigger so tiles re-colour when the catalog arrives. A new `CatalogModal.svelte` (focus trap, Esc/backdrop close, `inert` on background) is launched from a quiet `.s-chip` button next to the Map page's layer tabs.

**Spec:** `docs/superpowers/specs/2026-05-07-improvement-catalog-design.md`

**Commit policy:** No per-task commits. Backend half + frontend half are committed together at the end. (User preference recorded in memory.)

---

## Phase 1 — Backend extractor + sync wiring

### Task 1: Add `ImprovementsCatalog` block to fixture builder

**File:** `tests/fixtures/build_test_workbook.py` — append a new sheet block before `wb.save(out_path)` with header row + 3 rows (Solar Array Field / Hydroponic Farm / Heat Pump) + a blank row 5 for skip coverage. Register the named range `ImprovementsCatalog!$A$1:$AM$5` (39 columns).

### Task 2: Write failing extractor tests

**File:** `tests/extractors/test_catalog.py` (new). Seven tests:
1. Returns `improvements` list.
2. Skips blank-name rows.
3. Solar row maps correctly (category=energy, costs=…, yields.energy=200, …).
4. Hydroponic row falls through (category=None, splits populated).
5. Heat Pump (unknown category) → `other` + stdout warning via `caplog`.
6. Numeric blanks coerce to 0 (not None) for non-splits sections.
7. Missing range → `{ "improvements": [] }`.

Run pytest; expect failures with `ModuleNotFoundError: No module named 'extractors.catalog'`.

### Task 3: Implement `scripts/extractors/catalog.py`

Header-by-name parsing, slug normalization (lowercase + trim → 8-slug enum + `agriculture → agri` alias), blank-row filter, numeric coercion (blanks → 0 for costs/yields/upkeep/workforce; splits keep `None`), stdout warning for unknown categories. Use `read_named_range` and `coerce_number` helpers from `extractors._common`.

### Task 4: Wire into `sync_sheet.py` + bump SCHEMA_VERSION

- Add `from extractors import catalog as ex_catalog` to imports.
- Bump `SCHEMA_VERSION = 5` → `SCHEMA_VERSION = 6`.
- Add `("catalog", ex_catalog.extract)` to the extractors list.
- Update `tests/test_sync_sheet.py` schema_version assertion 5 → 6.

### Task 5: Register soft-optional range in `validate_schema.py`

Append `"ImprovementsCatalog"` to `SOFT_OPTIONAL_V3_RANGES` with a v6 comment.

### Smoke test

Run full sync against the fixture xlsx; verify `catalog.json` exists with 3 improvements, `meta.json` reports schema_version 6.

---

## Phase 2 — Frontend store + categorizer

### Task 6: Bump `EXPECTED_SCHEMA_VERSION` in `meta.js`

One-line edit: 5 → 6 in lockstep with backend.

### Task 7: Create `src/lib/stores/catalog.js`

Exports `catalog` writable, `loadCatalog(syncedAt)`, `normalizeName(s)`, `resolveImprovementRow(name, cat)` with deterministic longest-shared-prefix fuzzy matcher (min length 4, 75%-of-longer threshold, stem-based tiebreak). `resolveImprovementRow` memoizes via `placedNameLookup` Map (caches both hits and misses).

### Task 8: Wire `loadCatalog` into `App.svelte`

After `await loadMeta()`, fire-and-forget `loadCatalog(data.synced_at)` if meta loaded. Catalog is small (~50 rows) so global boot is fine.

### Task 9: Rewrite `improvement-categories.js`

Replace `categorySlugFor` with `getCategorySlug(name, catalog)` chain: catalog exact → catalog fuzzy (via `resolveImprovementRow`) → existing keyword regex (kept private as `regexCategorySlug`) → `'other'`. `categoryFor(improvement, catalog)` gains a 2nd arg. Old `categorySlugFor` exported as a throwing alias to surface stale imports.

### Tasks 10-12: Update categorizer call sites

5 sites across 3 files:
- `src/routes/Map.svelte` — `tileMatchesFilters` + tile inspector use `getCategorySlug` / `categoryFor` with `$catalog`. Pass `catalog={$catalog}` to `<RosterPanel>`.
- `src/lib/components/RosterPanel.svelte` — new `catalog` prop; `groupImprovements` threads it through; `buildRows` reactive includes catalog dep.
- `src/lib/components/MapCanvas.svelte` — filter check + ring-colour `categoryFor` use `$catalog`. Add `$: if ($catalog) { drawTerrain(...) }` so tiles re-colour when catalog arrives (gotcha 14 mitigation).

---

## Phase 3 — UI components + Map integration

### Task 13: Add `.cat-*` CSS to `global.css`

Append a new block: backdrop, modal, header, search, close, cat-cat-strip, body, group, grid, card, chip (with `.pos`/`.neg`/`.upkeep` modifiers), notes, empty + 600px mobile breakpoint. All theme variables (`--bg-2`, `--accent`, `--good`, `--crit`, `--muted`, `--fg`, `--bg`) are pre-defined across light/dark/schematic.

### Task 14: Create `ImprovementCard.svelte`

Reusable card: name + category icon, costs row, yields row (signed pos/neg), upkeep row, workforce list, splits mini-bar (food producers only), terrain & ownership notes. `compact` prop hides empty rows when used in tile inspector.

### Task 15: Create `CatalogModal.svelte`

Full modal: search box, category-toggle chips, grouped grid of `ImprovementCard`. Keydown via `<svelte:body on:keydown>`. **Setup in sync `onMount` (capture `triggerEl`, set `inert` on `#app`, focus search via `tick().then()`); cleanup in explicit `onDestroy` (remove `inert`, restore focus).** Esc closes with `stopPropagation()`. Backdrop close uses both `mousedown` and `click` checks so drag-out-of-modal selections don't close.

### Tasks 16-17: Wire modal launch + tile inspector enrichment in `Map.svelte`

- Quiet `.s-chip` ("⌬ Catalog") next to layer-tabs, hidden when `$catalog` is null/empty.
- `{#if catalogOpen}<CatalogModal/>{/if}` lazy-mount.
- `$: nameplate = t?.improvement ? resolveImprovementRow(t.improvement.name, $catalog) : null;` reactive.
- "Nameplate stats" `<ImprovementCard imp={nameplate} compact={true}/>` subsection inside `{#if t.improvement}` block.

---

## Phase 4 — Documentation

### Task 18: Update `CLAUDE.md`

- Layout section: add `CatalogModal`, `ImprovementCard` to components list.
- Convention 12 vocab list: append `.cat-*` classes.
- New gotcha 19: catalog-as-canonical-category-source pattern, redraw trigger, App.svelte load site.

---

## Final review + commit

Run full pytest (expect 129 pass / 2 pre-existing test_status.py failures per gotcha 10 — unrelated). Run `npm run build` (expect clean). Two commits on `feat/improvement-catalog`: backend half, then frontend + docs half.
