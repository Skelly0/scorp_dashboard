# Mobile-Friendly Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every dashboard route usable on a 360-414px portrait phone with touch-first map inspection, 44x44 tap targets, no body-level horizontal overflow, and desktop behavior preserved.

**Architecture:** Frontend-only responsive pass. Use shared CSS primitives in `src/styles/global.css`, existing Svelte routes, the existing fit-to-width map zoom foundation in `src/lib/map-zoom.js`, and the existing `s-sheet` bottom-sheet primitive. No data shape, store, extractor, backend, or route duplication changes.

**Tech Stack:** Svelte 4, Vite, Tailwind utility classes where already present, shared `global.css` design vocabulary per `CLAUDE.md` convention #12, Vitest, Playwright + axe-core.

**Spec:** `docs/superpowers/specs/2026-05-09-mobile-friendly-design.md`

**Current-state note:** The resizable-map work already exists in this worktree: `src/lib/map-zoom.js`, `src/lib/components/MapCanvas.svelte`, `src/routes/Map.svelte`, and `tests-e2e/map-zoom.spec.js` already provide fit-to-width zoom buttons and a `zoomstep` event for keyboard zoom. This plan extends that foundation with fractional/scaled zoom, pinch events, and mobile inspector sheet behavior.

**Commit policy:** Do not commit per task. Stage only when useful for review. Before any final commit/push, update `CLAUDE.md` as Task 11 requires, then ask the user how to structure commits.

---

## File Structure

**Create:**
- `src/lib/components/MapInspector.svelte` - extracted tile-inspector content from `Map.svelte`; renders the same `kv`, improvement, yields, upkeep, workforce, and staffing sections without owning shell layout.
- `src/lib/components/MapBottomSheet.svelte` - dismissable mobile dialog wrapper using `.s-sheet` and `.s-sheet-backdrop`.
- `tests-e2e/mobile-flow.spec.js` - phone smoke across all routes with no body-level horizontal overflow.

**Modify:**
- `src/styles/global.css` - route-safe mobile primitives: touch targets, KPI clamps, narrow Overton/Tier reflow, heatmap/table scroll utilities, bottom-sheet close sizing, tech-chip narrow fallback.
- `src/lib/components/NavBar.svelte` - mobile current page label, year-label hide at very narrow widths, 44px menu links.
- `src/lib/components/Heatmap.svelte` - replace internal generic overflow wrapper with `.heatmap-scroll`.
- `src/lib/map-zoom.js` - add scaled zoom and pinch math helpers while keeping discrete `stepZoom` intact.
- `src/lib/map-zoom.test.js` - add unit tests for scaled zoom and pinch math.
- `src/lib/components/MapCanvas.svelte` - touch/gesture handlers, `touch-action`, fractional `zoomstep` dispatch.
- `src/routes/Map.svelte` - extract inspector, render desktop inspector at `md+`, render mobile bottom sheet at `<md`, handle scaled zoom.
- `src/routes/Demographics.svelte` - mobile-trim the 11-column Class Vitals table, add hint text, keep row drilldown as full-data path.
- `src/routes/Population.svelte` - phone-first radar grid and class table scroll wrapper.
- `src/routes/GoIs.svelte` - route padding, GoI card body collapse, heatmap uses shared scroll, existing sub-faction sheet remains.
- `src/routes/Parties.svelte` - route padding, party card body collapse, heatmaps use shared scroll.
- `src/routes/Senate.svelte` - route padding, coalitions table scroll wrapper, heatmap uses shared scroll.
- `src/routes/Status.svelte`, `src/routes/Situations.svelte`, `src/routes/Tech.svelte` - route padding only, plus tech chip CSS support through `global.css`.
- `playwright.config.js` - add touch-enabled mobile projects.
- `tests-e2e/demographics.spec.js` - add mobile table-trim/drilldown test.
- `tests-e2e/map.spec.js` - add mobile tap-to-pin bottom-sheet test.
- `tests-e2e/a11y.spec.js` - add mobile viewport pass to the existing theme sweep.
- `CLAUDE.md` - add mobile-dashboard gotcha and "Where to read more" links before commit.

**Untouched:**
- `scripts/`, extractors, schema version, `src/lib/stores/*`, JSON payload shapes, route paths.

---

## Task 1: Baseline Check

**Files:** none.

- [ ] **Step 1: Install dependencies if needed**

Run:

```bash
npm install
```

Expected: dependencies are installed without errors. If `node_modules/` is already present and current, this should be quick and leave `package-lock.json` unchanged.

- [ ] **Step 2: Run unit tests**

Run:

```bash
npm test -- --run
```

Expected: Vitest suite passes. If it fails before any edits, record the exact failing test names and output before continuing.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: Vite build succeeds.

- [ ] **Step 4: Run focused existing e2e smoke**

Run:

```bash
npx playwright test tests-e2e/map-zoom.spec.js tests-e2e/demographics.spec.js
```

Expected: both existing specs pass. If an existing demographics assertion about `"/ turn"` vs `"/ year"` fails, record it as baseline drift before making mobile changes. Do not silently rewrite unrelated behavior.

---

## Task 2: Shared Mobile CSS and Route Padding

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/routes/Status.svelte`
- Modify: `src/routes/Map.svelte`
- Modify: `src/routes/Population.svelte`
- Modify: `src/routes/Demographics.svelte`
- Modify: `src/routes/GoIs.svelte`
- Modify: `src/routes/Tech.svelte`
- Modify: `src/routes/Parties.svelte`
- Modify: `src/routes/Senate.svelte`
- Modify: `src/routes/Situations.svelte`

- [ ] **Step 1: Tighten route padding on every route**

Replace the opening `<section>` class on every route listed below:

```svelte
<section class="px-6 py-5 max-w-[1600px]">
```

with:

```svelte
<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px]">
```

Apply the same base padding change while preserving extra attributes/classes:

```svelte
<!-- src/routes/Map.svelte -->
<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px]" tabindex="-1" on:keydown={handlePageKey}>

<!-- src/routes/GoIs.svelte -->
<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px] gois-page">
```

Verify with:

```bash
rg -n '<section class="px-6 py-5' src/routes
```

Expected: no matches.

- [ ] **Step 2: Add global mobile primitives**

Append this block to `src/styles/global.css` after the existing route/component CSS blocks, before the final tech-grid block if you want related rules grouped, or at the end if grouping is clearer:

```css
/* === Mobile friendliness =================================================== */
.narrow-hide { display: inline; }

.kpi-block .kpi-num {
  font-size: clamp(2rem, 9vw, 56px);
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.stat-tile .val {
  font-size: clamp(1.5rem, 6.5vw, 32px);
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.heatmap-scroll,
.tbl-scroll {
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.tbl-scroll > table.tbl {
  min-width: 640px;
}

.tbl-hint {
  margin: 0 0 8px;
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

@media (max-width: 639px) {
  .tbl-trim-mobile .hide-narrow {
    display: none;
  }
}

@media (hover: none) and (pointer: coarse) {
  .s-chip,
  .s-tag,
  .layer-tabs button,
  .layer-tabs .layer-menu-trigger,
  .tier,
  .cat-close,
  .s-rail-close,
  .roster-row,
  .roster-section-header {
    min-height: 44px;
  }

  .s-chip,
  .layer-tabs button,
  .layer-tabs .layer-menu-trigger,
  .cat-close {
    padding: 10px 14px;
  }

  .filter-chip button {
    padding: 10px;
    margin: -10px;
    min-width: 32px;
    min-height: 32px;
  }
}

@media (max-width: 380px) {
  .narrow-hide { display: none; }

  .overton-row {
    grid-template-columns: 1fr;
    gap: 4px;
    padding: 10px 0;
  }
  .overton-axis-left { text-align: left; }
  .overton-axis-right {
    text-align: right;
    grid-column: 1;
  }
  .overton-track { grid-column: 1; }
  .overton-value {
    grid-column: 1;
    text-align: right;
  }

  .tier {
    grid-template-columns: 60px minmax(0, 1fr) auto;
    gap: 8px;
  }
}

@media (max-width: 420px) {
  .tech-effect-chip {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
```

- [ ] **Step 3: Make the map layer strip scroll on phones**

In `src/styles/global.css`, extend the existing `.layer-tabs` rules with:

```css
@media (max-width: 767px) {
  .layer-tabs {
    flex-wrap: nowrap;
    max-width: 100%;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
  }
  .layer-tabs > button,
  .layer-tabs .layer-menu,
  .layer-tabs .s-zoom {
    flex: 0 0 auto;
    scroll-snap-align: start;
  }
  .layer-tabs .s-zoom {
    margin-left: 0;
  }
}
```

- [ ] **Step 4: Build after shared CSS**

Run:

```bash
npm run build
```

Expected: build succeeds. No CSS variable warnings, no Svelte parse errors.

---

## Task 3: Mobile NavBar Polish

**Files:**
- Modify: `src/lib/components/NavBar.svelte`

- [ ] **Step 1: Add current label derived state**

In the `<script>` block, after `yearLabel`, add:

```javascript
  $: currentLabel = pages.find((p) => p.path === $location)?.label ?? '';
```

- [ ] **Step 2: Hide year label at very narrow widths and show current route next to the hamburger**

Replace the brand/hamburger block in `NavBar.svelte` with this structure:

```svelte
      <span class="font-mono font-bold uppercase tracking-widest text-accent text-sm md:text-base whitespace-nowrap">
        Colony{#if yearLabel}<span class="narrow-hide"><span class="inline-block mx-2 md:mx-3 opacity-70">|</span>{yearLabel}</span>{/if}
      </span>
      <button
        class="md:hidden border-2 border-border px-3 py-2 min-h-[44px] min-w-[44px] text-xs uppercase tracking-widest"
        on:click={() => (menuOpen = !menuOpen)}
        aria-label="Toggle nav"
        aria-expanded={menuOpen}
      >
        {menuOpen ? 'x' : '☰'}
      </button>
      <span class="md:hidden text-xs uppercase tracking-widest text-muted truncate max-w-[10rem]">
        {currentLabel}
      </span>
```

The vertical separator changes from `▌` to `|` to keep the new markup ASCII-friendly; the hamburger glyph can stay because the existing file already uses it.

- [ ] **Step 3: Increase mobile dropdown hit area**

Replace the mobile menu anchor class:

```svelte
class="block px-4 py-2 border-b border-border/30"
```

with:

```svelte
class="flex items-center min-h-[44px] px-4 py-3 border-b border-border/30"
```

- [ ] **Step 4: Verify nav**

Run:

```bash
npm run build
npx playwright test tests-e2e/a11y.spec.js --project=chromium
```

Expected: build succeeds and the existing desktop a11y project still passes.

---

## Task 4: Demographics Mobile Table Trim

**Files:**
- Modify: `src/routes/Demographics.svelte`
- Modify: `tests-e2e/demographics.spec.js`

- [ ] **Step 1: Add mobile hint and trim classes**

In `src/routes/Demographics.svelte`, just inside the Class Vitals `.s-card`, before the `<table>`, add:

```svelte
      <p class="tbl-hint sm:hidden">Tap a row for full vitals.</p>
```

Change the table class:

```svelte
      <table class="tbl">
```

to:

```svelte
      <table class="tbl tbl-trim-mobile">
```

- [ ] **Step 2: Hide lower-priority columns below `sm`**

Add `hide-narrow` to these `<th>` cells:

```svelte
            <th class="num hide-narrow">Mortality</th>
            <th class="num hide-narrow">Births/year</th>
            <th class="num hide-narrow">Deaths/year</th>
            <th class="num hide-narrow">Mobility In</th>
            <th class="num hide-narrow">Mobility Out</th>
            <th class="num hide-narrow">Demand</th>
            <th class="num hide-narrow">Unemployed</th>
```

Keep these visible at all widths:

```svelte
            <th>Class</th>
            <th class="num">Pop</th>
            <th class="num">Fill %</th>
            <th class="num">Satisfaction</th>
```

Add the same `hide-narrow` class to the matching `<td>` cells in the same order:

```svelte
              <td class="num hide-narrow">{c.mortality_rate != null ? (c.mortality_rate * 100).toFixed(2) + '%' : '—'}</td>
              <td class="num hide-narrow">{c.births_per_turn != null ? Math.round(c.births_per_turn).toLocaleString() : '—'}</td>
              <td class="num hide-narrow">{c.deaths_per_turn != null ? Math.round(c.deaths_per_turn).toLocaleString() : '—'}</td>
              <td class="num hide-narrow">{c.mobility_in != null ? Math.round(c.mobility_in).toLocaleString() : '—'}</td>
              <td class="num hide-narrow">{c.mobility_out != null ? Math.round(c.mobility_out).toLocaleString() : '—'}</td>
              <td class="num hide-narrow">{c.workforce?.demand != null ? Math.round(c.workforce.demand).toLocaleString() : '—'}</td>
              <td class="num hide-narrow">{c.unemployed_count != null ? Math.round(c.unemployed_count).toLocaleString() : '—'}</td>
```

- [ ] **Step 3: Add mobile e2e coverage**

Append this describe block to `tests-e2e/demographics.spec.js`:

```javascript
test.describe('Demographics mobile table trim', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/demographics');
    await expect(page.locator('text=Pop Dynamics')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table.tbl tbody tr').first()).toBeVisible();
  });

  test('trims lower-priority columns and keeps row drilldown for full data', async ({ page }) => {
    await expect(page.locator('.tbl-hint')).toBeVisible();
    await expect(page.locator('th', { hasText: 'Class' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Pop' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Fill %' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Satisfaction' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Mortality' })).toBeHidden();
    await expect(page.locator('th', { hasText: 'Births/year' })).toBeHidden();
    await expect(page.locator('th', { hasText: 'Demand' })).toBeHidden();

    const firstRow = page.locator('table.tbl tbody tr').first();
    await firstRow.tap();
    await expect(page.locator('text=per-class drilldown')).toBeVisible();
    await expect(page.locator('.s-card', { hasText: 'Workforce' }).filter({ hasText: 'Demand' })).toBeVisible();
  });
});
```

- [ ] **Step 4: Run the demographics tests**

Run:

```bash
npx playwright test tests-e2e/demographics.spec.js
```

Expected: all demographics tests pass. The existing `Class Vitals has Demand and Fill % columns` test should still pass because hidden columns remain in the DOM at desktop viewport.

---

## Task 5: Heatmaps and Senate Table Scrolling

**Files:**
- Modify: `src/lib/components/Heatmap.svelte`
- Modify: `src/styles/global.css`
- Modify: `src/routes/Senate.svelte`

- [ ] **Step 1: Move Heatmap to the shared scroll class**

In `src/lib/components/Heatmap.svelte`, replace:

```svelte
<div class="overflow-x-auto">
```

with:

```svelte
<div class="heatmap-scroll">
```

Do not change the inner `.heatmap` grid or props.

- [ ] **Step 2: Add sticky row-head styling**

In `src/styles/global.css`, extend the heatmap section:

```css
.heatmap-scroll .heatmap {
  min-width: max-content;
}

.heatmap-cell.row-head {
  position: sticky;
  left: 0;
  z-index: 2;
  background: var(--bg);
}
```

This reuses the existing `--bg` token, which all three themes define.

- [ ] **Step 3: Scroll-wrap the Senate coalitions table**

In `src/routes/Senate.svelte`, replace:

```svelte
      <div class="s-card">
        <table class="tbl">
```

with:

```svelte
      <div class="s-card tbl-scroll">
        <table class="tbl">
```

Only the coalitions table needs this wrapper; the low row count makes a drilldown unnecessary.

- [ ] **Step 4: Verify heatmap routes**

Run:

```bash
npm run build
npx playwright test tests-e2e/gois.spec.js tests-e2e/a11y.spec.js --project=chromium
```

Expected: build succeeds, GoIs existing tests pass, and a11y desktop sweep stays green.

---

## Task 6: Route-Specific Reflows

**Files:**
- Modify: `src/routes/Population.svelte`
- Modify: `src/routes/GoIs.svelte`
- Modify: `src/routes/Parties.svelte`
- Modify: `src/routes/Senate.svelte`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Population route phone-first grid and table scroll**

In `src/routes/Population.svelte`, wrap the Class Roster table card with `tbl-scroll`:

```svelte
    <div class="s-card tbl-scroll">
```

Change the radar card grid:

```svelte
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
```

to:

```svelte
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
```

- [ ] **Step 2: GoIs card body collapse**

In `src/routes/GoIs.svelte`, replace the GoI card body class:

```svelte
          <div class="s-card-pad grid grid-cols-[170px_1fr] gap-4">
```

with:

```svelte
          <div class="s-card-pad goi-card-body">
```

Add this CSS to the existing `<style>` block in `GoIs.svelte`:

```css
  .goi-card-body {
    display: grid;
    grid-template-columns: 170px minmax(0, 1fr);
    gap: 16px;
  }
  .goi-card-body svg {
    max-width: min(170px, 50vw);
    height: auto;
    justify-self: center;
  }
  @media (max-width: 479px) {
    .goi-card-body {
      grid-template-columns: 1fr;
    }
  }
```

- [ ] **Step 3: Parties card body collapse**

In `src/routes/Parties.svelte`, replace the party card body class:

```svelte
          <div class="s-card-pad grid grid-cols-[1fr_140px] gap-3">
```

with:

```svelte
          <div class="s-card-pad party-card-body">
```

Append a `<style>` block to `Parties.svelte`:

```svelte
<style>
  .party-card-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 140px;
    gap: 12px;
  }
  .party-card-body svg {
    max-width: min(140px, 45vw);
    height: auto;
    justify-self: center;
  }
  @media (max-width: 399px) {
    .party-card-body {
      grid-template-columns: 1fr;
    }
  }
</style>
```

- [ ] **Step 4: Confirm TechCard chip fallback**

Task 2 already added the `.tech-effect-chip` narrow fallback. Inspect `src/lib/components/TechCard.svelte` and confirm it still uses:

```svelte
        <div class="tech-effect-chip {dir}">
```

Expected: no file edit needed in `TechCard.svelte`.

- [ ] **Step 5: Build after route reflows**

Run:

```bash
npm run build
```

Expected: build succeeds.

---

## Task 7: Extract Map Inspector and Add Mobile Bottom Sheet

**Files:**
- Create: `src/lib/components/MapInspector.svelte`
- Create: `src/lib/components/MapBottomSheet.svelte`
- Modify: `src/routes/Map.svelte`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Create `MapInspector.svelte` shell**

Create `src/lib/components/MapInspector.svelte` with this script and event contract:

```svelte
<script>
  import { createEventDispatcher } from 'svelte';
  import { categoryFor, CATEGORIES } from '../improvement-categories.js';
  import { RESOURCE_CODES, FEATURE_CODES } from '../map-codes.js';
  import { classColor } from '../faction-colors.js';
  import ImprovementCard from './ImprovementCard.svelte';

  export let tile = null;
  export let mapData;
  export let catalog = null;
  export let layer = 'terrain';
  export let nameplate = null;

  const dispatch = createEventDispatcher();
</script>
```

Then move the existing inspector body from `src/routes/Map.svelte` into this component:

- Start at the current `Map.svelte` inspector card content inside the second `<div class="s-card">`, beginning with:

```svelte
          {#if !t}
```

- End after the staffing-efficiency block and its closing `{/if}` for the tile content.
- In the moved markup, replace every `t` reference with `tile`.
- Replace `$map` with `mapData`.
- Replace `$catalog` with `catalog`.
- Replace the "Filter by category" button handler with:

```svelte
                  <button
                    class="filter-link"
                    on:click={() => dispatch('filter-category', { slug: cat.slug })}
                  >Filter by {cat.icon} {cat.label}</button>
```

The component must still render the empty state:

```svelte
{#if !tile}
  <div class="s-card-pad">
    <p class="text-muted text-xs uppercase tracking-widest">Hover or click a tile to inspect.</p>
  </div>
{:else}
  ...
{/if}
```

- [ ] **Step 2: Create `MapBottomSheet.svelte`**

Create `src/lib/components/MapBottomSheet.svelte`:

```svelte
<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  function dismiss() {
    dispatch('dismiss');
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') dismiss();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div
  class="s-sheet-backdrop md:hidden"
  on:click={dismiss}
  role="presentation"
></div>

<section
  class="s-sheet map-inspector-sheet md:hidden"
  role="dialog"
  aria-modal="true"
  aria-label="Tile inspector"
>
  <button
    class="s-rail-close map-sheet-close"
    type="button"
    aria-label="Close tile inspector"
    on:click={dismiss}
  >x</button>
  <slot />
</section>
```

- [ ] **Step 3: Add imports and a filter helper to `Map.svelte`**

Add imports:

```javascript
  import MapInspector from '../lib/components/MapInspector.svelte';
  import MapBottomSheet from '../lib/components/MapBottomSheet.svelte';
```

Add this helper near `clearAllFilters()`:

```javascript
  function filterByImprovementCategory(slug) {
    filters = { ...filters, improvement: slug };
    layer = 'improvements';
  }
```

- [ ] **Step 4: Replace inline inspector with component instances**

Replace the current second inspector card in `Map.svelte` with:

```svelte
        <div class="s-card hidden md:block">
          <MapInspector
            tile={t}
            mapData={$map}
            catalog={$catalog}
            {layer}
            {nameplate}
            on:filter-category={(e) => filterByImprovementCategory(e.detail.slug)}
          />
        </div>
```

After the closing `</div>` of the main grid, before the legend text block, add:

```svelte
    {#if pinnedTile}
      <MapBottomSheet on:dismiss={() => (pinnedTile = null)}>
        <MapInspector
          tile={pinnedTile}
          mapData={$map}
          catalog={$catalog}
          {layer}
          {nameplate}
          on:filter-category={(e) => {
            filterByImprovementCategory(e.detail.slug);
            pinnedTile = null;
          }}
        />
      </MapBottomSheet>
    {/if}
```

- [ ] **Step 5: Change the map/aside breakpoint from `lg` to `md`**

In `Map.svelte`, replace:

```svelte
    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start">
```

with:

```svelte
    <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start">
```

Roster remains in the aside at every width; only the inspector card is hidden below `md`.

- [ ] **Step 6: Add sheet polish CSS**

Append to `src/styles/global.css`:

```css
.map-inspector-sheet {
  padding-top: 52px;
}

.map-sheet-close {
  position: absolute;
  top: 12px;
  right: 12px;
}
```

- [ ] **Step 7: Build and manually smoke Map**

Run:

```bash
npm run build
npm run dev
```

Manual expected results:
- Desktop width >= 768px: inspector appears in the right rail and still updates on hover/click.
- Phone width < 768px: tapping a tile opens a bottom sheet; backdrop, close button, and Escape all dismiss.
- Roster panel still appears below the map on narrow width when a roster layer is active.

Stop the dev server after the smoke.

---

## Task 8: Pinch-to-Zoom and Fractional Zoom

**Files:**
- Modify: `src/lib/map-zoom.js`
- Modify: `src/lib/map-zoom.test.js`
- Modify: `src/lib/components/MapCanvas.svelte`
- Modify: `src/routes/Map.svelte`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add scaled zoom helpers**

In `src/lib/map-zoom.js`, add below `stepZoom`:

```javascript
export function scaleZoom(current, ratio) {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio <= 0) {
    return clampZoom(current);
  }
  return clampZoom(clampZoom(current) * ratio);
}

export function pinchMathStep(currentDistance, previousDistance, currentZoom) {
  if (
    typeof currentDistance !== 'number' ||
    typeof previousDistance !== 'number' ||
    !Number.isFinite(currentDistance) ||
    !Number.isFinite(previousDistance) ||
    currentDistance <= 0 ||
    previousDistance <= 0
  ) {
    return clampZoom(currentZoom);
  }
  return scaleZoom(currentZoom, currentDistance / previousDistance);
}
```

- [ ] **Step 2: Add Vitest coverage**

In `src/lib/map-zoom.test.js`, add `scaleZoom` and `pinchMathStep` to the import list, then append:

```javascript
describe('scaleZoom', () => {
  it('multiplies the current zoom by a scale ratio', () => {
    expect(scaleZoom(1.0, 1.2)).toBeCloseTo(1.2, 10);
    expect(scaleZoom(1.5, 0.5)).toBeCloseTo(0.75, 10);
  });

  it('clamps scaled values to zoom bounds', () => {
    expect(scaleZoom(2.0, 2.0)).toBeCloseTo(ZOOM_MAX, 10);
    expect(scaleZoom(0.75, 0.1)).toBeCloseTo(ZOOM_MIN, 10);
  });

  it('ignores invalid scale ratios', () => {
    expect(scaleZoom(1.25, 0)).toBeCloseTo(1.25, 10);
    expect(scaleZoom(1.25, NaN)).toBeCloseTo(1.25, 10);
  });
});

describe('pinchMathStep', () => {
  it('doubles zoom when two fingers move from 100px apart to 200px apart', () => {
    expect(pinchMathStep(200, 100, 1.0)).toBeCloseTo(2.0, 10);
  });

  it('halves zoom when two fingers move from 100px apart to 50px apart', () => {
    expect(pinchMathStep(50, 100, 1.0)).toBeCloseTo(ZOOM_MIN, 10);
  });

  it('returns clamped current zoom for zero distances', () => {
    expect(pinchMathStep(0, 100, 1.25)).toBeCloseTo(1.25, 10);
    expect(pinchMathStep(100, 0, 1.25)).toBeCloseTo(1.25, 10);
  });
});
```

Run:

```bash
npm test -- --run src/lib/map-zoom.test.js
```

Expected: tests pass after helper implementation.

- [ ] **Step 3: Add touch state and handlers to MapCanvas**

In `src/lib/components/MapCanvas.svelte`, update the import:

```javascript
  import { ZOOM_DEFAULT, clampZoom, pinchMathStep } from '../map-zoom.js';
```

Add state near `viewportClientWidth`:

```javascript
  let pinchPreviousDistance = null;
  let gesturePreviousScale = null;
```

Add helper functions after `handleClick` or near other event handlers:

```javascript
  function touchDistance(touches) {
    const [a, b] = touches;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function dispatchScaleFromDistances(currentDistance, previousDistance) {
    const next = pinchMathStep(currentDistance, previousDistance, zoom);
    const ratio = next / clampZoom(zoom);
    if (Number.isFinite(ratio) && ratio > 0 && Math.abs(ratio - 1) > 0.001) {
      dispatch('zoomstep', { mode: 'scale', delta: ratio });
    }
  }

  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      pinchPreviousDistance = touchDistance(e.touches);
    }
  }

  function handleTouchMove(e) {
    if (e.touches.length !== 2 || pinchPreviousDistance == null) return;
    const currentDistance = touchDistance(e.touches);
    e.preventDefault();
    dispatchScaleFromDistances(currentDistance, pinchPreviousDistance);
    pinchPreviousDistance = currentDistance;
  }

  function handleTouchEnd(e) {
    if (e.touches.length < 2) {
      pinchPreviousDistance = null;
    }
  }

  function handleGestureStart(e) {
    gesturePreviousScale = e.scale || 1;
    e.preventDefault();
  }

  function handleGestureChange(e) {
    if (gesturePreviousScale == null) return;
    const currentScale = e.scale || 1;
    e.preventDefault();
    dispatchScaleFromDistances(currentScale, gesturePreviousScale);
    gesturePreviousScale = currentScale;
  }

  function handleGestureEnd() {
    gesturePreviousScale = null;
  }
```

- [ ] **Step 4: Bind touch and gesture events on `.map-viewport`**

In `MapCanvas.svelte`, update the `.map-viewport` element:

```svelte
  <div
    class="map-viewport relative border-4 border-border focus:outline focus:outline-2 focus:outline-accent"
    bind:clientWidth={viewportClientWidth}
    tabindex="0"
    on:keydown={handleKey}
    on:touchstart|nonpassive={handleTouchStart}
    on:touchmove|nonpassive={handleTouchMove}
    on:touchend={handleTouchEnd}
    on:touchcancel={handleTouchEnd}
    on:gesturestart|nonpassive={handleGestureStart}
    on:gesturechange|nonpassive={handleGestureChange}
    on:gestureend={handleGestureEnd}
  >
```

- [ ] **Step 5: Set map viewport touch policy**

In `src/styles/global.css`, add to `.map-viewport`:

```css
  touch-action: pan-x pan-y;
  overscroll-behavior: contain;
```

Expected: one-finger native pan still works through the existing `overflow: auto`; two-finger pinch is intercepted.

- [ ] **Step 6: Handle scaled `zoomstep` in Map.svelte**

In `src/routes/Map.svelte`, add `scaleZoom` to the map-zoom import:

```javascript
    scaleZoom,
```

Replace the inline `on:zoomstep` handler with:

```svelte
        on:zoomstep={(e) => {
          if (e.detail.reset) zoom = resetZoom();
          else if (e.detail.mode === 'scale') zoom = scaleZoom(zoom, e.detail.delta);
          else zoom = stepZoom(zoom, e.detail.delta);
        }}
```

Keyboard `+`, `-`, and `0` still use stepped zoom because those dispatch without `mode: 'scale'`.

- [ ] **Step 7: Verify pinch helpers and map zoom e2e**

Run:

```bash
npm test -- --run src/lib/map-zoom.test.js
npx playwright test tests-e2e/map-zoom.spec.js
```

Expected: all pass. Playwright does not prove real iOS Safari pinch, so manual device testing remains in Task 12.

---

## Task 9: Mobile Playwright Projects and New E2E Coverage

**Files:**
- Modify: `playwright.config.js`
- Create: `tests-e2e/mobile-flow.spec.js`
- Modify: `tests-e2e/map.spec.js`
- Modify: `tests-e2e/a11y.spec.js`

- [ ] **Step 1: Add mobile projects**

Replace `playwright.config.js` with:

```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests-e2e',
  use: {
    baseURL: 'http://localhost:4173',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-pixel5',
      use: { ...devices['Pixel 5'], hasTouch: true },
    },
    {
      name: 'mobile-iphone13',
      use: { ...devices['iPhone 13'], hasTouch: true },
    },
  ],
  webServer: {
    command: 'npm run preview',
    port: 4173,
    timeout: 30000,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 2: Add mobile route smoke**

Create `tests-e2e/mobile-flow.spec.js`:

```javascript
import { test, expect } from '@playwright/test';

const ROUTES = [
  '/',
  '/#/map',
  '/#/population',
  '/#/demographics',
  '/#/gois',
  '/#/tech',
  '/#/parties',
  '/#/situations',
];

test.describe('mobile route smoke', () => {
  test('routes render without body-level horizontal overflow', async ({ page, request }) => {
    const routes = [...ROUTES];
    const senate = await request.get('/data/senate.json');
    if (senate.ok()) routes.push('/#/senate');

    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.band, .kpi-block, .s-card, canvas[role="application"]').first()).toBeVisible({ timeout: 10000 });
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow, `${route} horizontal overflow`).toBeLessThanOrEqual(1);
    }

    expect(errors).toEqual([]);
  });
});
```

- [ ] **Step 3: Add mobile map bottom-sheet e2e**

Append to `tests-e2e/map.spec.js`:

```javascript
test.describe('Map mobile inspector sheet', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/map');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('canvas[role=application]')).toBeVisible();
  });

  test('tapping a tile opens a dismissable bottom sheet', async ({ page }) => {
    const canvas = page.locator('canvas[role=application]');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.map-inspector-sheet')).toBeVisible();
    await expect(page.locator('.map-inspector-sheet', { hasText: /Tile/ })).toBeVisible();

    await page.locator('.s-sheet-backdrop').click();
    await expect(page.locator('.map-inspector-sheet')).toHaveCount(0);
  });
});
```

- [ ] **Step 4: Add mobile viewport to the a11y sweep**

In `tests-e2e/a11y.spec.js`, add:

```javascript
const VIEWPORTS = [
  { name: 'desktop', size: { width: 1280, height: 900 } },
  { name: 'mobile', size: { width: 390, height: 844 } },
];
```

Replace the first nested `for` block with a three-level loop:

```javascript
for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    for (const path of PAGES) {
      test(`a11y: ${theme} theme - ${viewport.name} - ${path}`, async ({ page }) => {
        await page.setViewportSize(viewport.size);
        await page.goto('/');
        await page.evaluate((t) => {
          localStorage.setItem('theme', t);
        }, theme);
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze();
        expect(results.violations).toEqual([]);
      });
    }
  }
}
```

Keep the existing GoIs selected-state and Demographics detail-state a11y blocks below this loop; they already set their own viewport where needed.

- [ ] **Step 5: Run mobile-focused tests**

Run:

```bash
npx playwright test tests-e2e/mobile-flow.spec.js --project=mobile-iphone13
npx playwright test tests-e2e/map.spec.js --project=mobile-iphone13
npx playwright test tests-e2e/demographics.spec.js --project=mobile-iphone13
```

Expected: all pass. If the new `mobile-flow` catches route overflow, inspect `document.elementFromPoint(window.innerWidth - 1, 1)` and the widest element in DevTools before changing CSS.

---

## Task 10: Visual Browser Verification

**Files:** none.

- [ ] **Step 1: Start dev server**

Run:

```bash
npm run dev
```

Expected: Vite serves on `http://localhost:5173/`.

- [ ] **Step 2: Manual phone-width route pass**

Use browser device emulation at 390x844 and 360x800. Verify:

- `/` Status: KPI numbers do not overflow; Overton rows collapse at 360px; situation/tier rows remain tappable.
- `/#/map`: layer strip scrolls horizontally; one-finger pan scrolls the map viewport; tapping a tile opens the bottom sheet; close/backdrop/Escape dismiss; zoom buttons are 44px tappable on touch emulation.
- `/#/population`: class table scrolls internally; radar cards are single column on phone.
- `/#/demographics`: visible columns are Class, Pop, Fill %, Satisfaction; tapping a row opens the full drilldown.
- `/#/gois`: GoI cards collapse to one-column body; sub-faction bottom sheet still works; Pop Capture heatmap scrolls with sticky row labels.
- `/#/tech`: effect chips wrap in a one-column chip layout below 420px.
- `/#/parties`: party card body collapses below 400px; compatibility heatmaps scroll.
- `/#/senate` if `public/data/senate.json` exists: coalitions table scrolls internally; capture heatmap scrolls.
- `/#/situations`: crisis tier ladder does not overflow below 380px.

- [ ] **Step 3: Stop dev server**

Stop the Vite process with Ctrl-C.

---

## Task 11: CLAUDE.md Update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a mobile-dashboard gotcha**

Append a new numbered gotcha after the current last gotcha in `CLAUDE.md`:

```markdown
28. **Mobile layout is shared-route, not mobile-route.** The dashboard stays on the same hash routes at phone widths. Route sections use `px-3 py-4 md:px-6 md:py-5`; touch upgrades live in `global.css` under `(hover: none) and (pointer: coarse)`; heatmaps and wide tables must scroll internally via `.heatmap-scroll` / `.tbl-scroll` so `document.documentElement.scrollWidth <= window.innerWidth + 1` remains true in `tests-e2e/mobile-flow.spec.js`. Map inspection is the one exception to inline desktop layout: `MapInspector.svelte` renders in the right rail at `md+` and inside `MapBottomSheet.svelte` below `md` when `pinnedTile` is set. Pinch zoom uses `scaleZoom` / `pinchMathStep` in `src/lib/map-zoom.js`; keyboard and button zoom still use stepped `stepZoom`.
```

If the next number is not 28 by the time this executes, use the actual next number.

- [ ] **Step 2: Add spec/plan links**

At the bottom of `CLAUDE.md` under "Where to read more", append:

```markdown
- Spec (mobile-friendly dashboard): `docs/superpowers/specs/2026-05-09-mobile-friendly-design.md`
- Plan (mobile-friendly dashboard): `docs/superpowers/plans/2026-05-09-mobile-friendly.md`
```

- [ ] **Step 3: Verify CLAUDE.md formatting**

Run:

```bash
rg -n "Mobile layout is shared-route|mobile-friendly dashboard" CLAUDE.md
```

Expected: one gotcha match plus two "Where to read more" link matches.

---

## Task 12: Final Verification

**Files:** none.

- [ ] **Step 1: Run unit suite**

Run:

```bash
npm test -- --run
```

Expected: all Vitest tests pass, including the new map pinch tests.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: Vite build succeeds.

- [ ] **Step 3: Run focused mobile e2e**

Run:

```bash
npx playwright test tests-e2e/mobile-flow.spec.js --project=mobile-pixel5
npx playwright test tests-e2e/mobile-flow.spec.js --project=mobile-iphone13
npx playwright test tests-e2e/map.spec.js --project=mobile-iphone13
npx playwright test tests-e2e/demographics.spec.js --project=mobile-iphone13
```

Expected: all pass.

- [ ] **Step 4: Run full e2e if time allows**

Run:

```bash
npm run test:e2e
```

Expected: all Playwright projects pass. If full e2e is too slow locally, run the three focused commands from Step 3 plus:

```bash
npx playwright test tests-e2e/a11y.spec.js --project=chromium
```

and state clearly that the full cross-project suite was not run.

- [ ] **Step 5: Real-device spot check**

Manual expected results:
- iPhone Safari: map two-finger pinch changes zoom smoothly; if Safari intercepts page zoom, the `+`/`-` buttons still work and the failure is recorded.
- Android Chrome: one-finger map pan stays native and two-finger pinch zooms map content.

- [ ] **Step 6: Report and ask commit strategy**

Report:
- Files changed.
- Tests run with pass/fail output.
- Any manual mobile/Safari caveats.
- Ask the user whether they want one commit or split commits. Do not commit before this answer.

---

## Self-Review

**Spec coverage check:**
- [x] Map touch gestures: Task 8 adds touch and Safari gesture handlers, fractional/scaled zoom, unit tests.
- [x] Map inspector sheet: Task 7 extracts `MapInspector` and adds `<md` bottom sheet.
- [x] Demographics 11-column overflow: Task 4 trims 7 columns below `sm` and keeps row drilldown.
- [x] Heatmaps: Task 5 uses `.heatmap-scroll` and sticky row heads.
- [x] Senate coalitions table: Task 5 wraps with `.tbl-scroll`.
- [x] 44x44 touch targets: Task 2 touch media query, Task 3 nav menu sizing.
- [x] Route padding: Task 2 updates all 9 route wrappers.
- [x] Hero number scaling: Task 2 clamps `.kpi-num` and `.stat-tile .val`.
- [x] Overton narrow reflow: Task 2 `max-width: 380px` rules.
- [x] Population/GoIs/Parties/Tech responsive fixes: Task 6 plus Task 2 chip fallback.
- [x] Playwright mobile projects and smoke: Task 9.
- [x] CLAUDE.md before commit: Task 11.

**Marker scan:** No unresolved markers or unnamed files. Large extraction is anchored to exact existing `Map.svelte` block boundaries and concrete replacement rules.

**Type/name consistency:**
- `scaleZoom`, `pinchMathStep`, `stepZoom`, and `resetZoom` all live in `src/lib/map-zoom.js`.
- `zoomstep` uses `{ mode: 'scale', delta: ratio }` for pinch, and existing `{ delta: +/-1 }` for keyboard/buttons.
- `MapInspector` props are `tile`, `mapData`, `catalog`, `layer`, `nameplate`; it dispatches `filter-category`.
- `MapBottomSheet` dispatches `dismiss`.
- Mobile table classes are `.tbl-trim-mobile`, `.hide-narrow`, `.tbl-hint`.
