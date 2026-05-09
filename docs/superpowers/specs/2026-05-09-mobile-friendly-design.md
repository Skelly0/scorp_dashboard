# Mobile-Friendly Dashboard — Design

**Status:** Draft
**Date:** 2026-05-09
**Scope:** Frontend only. No backend, sync, or schema changes.

## Problem

The dashboard already has partial mobile work — `NavBar` has a hamburger drop-down, `CatalogModal` goes full-screen at `≤600px`, `GoIs.svelte` uses an `s-sheet` bottom-sheet for sub-faction detail, and most KPI grids reflow via `grid-cols-N md:grid-cols-M`. But several pieces break or feel hostile on a phone:

- **Map page** has no touch gestures: no pinch-to-zoom, no canvas-scoped pan, and pin-to-tile dumps the inspector below the canvas where the user has to scroll to find it.
- **Demographics** has an 11-column class-vitals table that horizontally overflows below `~640px`.
- **Heatmaps** (GoIs Pop-Capture, Parties compat matrices, Senate GoI-capture) overflow without a scroll affordance or sticky labels.
- **Touch target sizes**: `s-chip`, `s-tag` interactive variants, `layer-tabs button`, and tier rows are below the 44×44 minimum on phone.
- **Route padding**: `px-6 py-5` (24px sides) compounds across nested cards and steals real estate at narrow widths.
- **Hero numbers**: `kpi-num` at fixed `56px` and `stat-tile .val` at fixed `32px` overflow narrow KPI columns when the value is long (e.g. seven-digit population counts in a half-width phone column).
- **Overton row** grid `110px 1fr 110px 40px` (~260px minimum) blows out on viewports below ~360px.
- **MapCanvas inspector aside** stacks below the map at `<lg`, requiring a scroll-down-then-back-up loop to inspect multiple tiles.

## Goal

Every route in the dashboard is usable on a 360–414px portrait phone with touch-first interactions and 44×44 minimum tap targets, without compromising the desktop experience or duplicating routes.

## Non-goals

- New mobile-only routes (`/m/*`). All paths stay shared.
- PWA / installable web app, manifest tuning, offline mode.
- Landscape-specific layouts (will work but not specifically tuned).
- Backend / sync / schema changes.
- Visual-regression / screenshot-diff testing infrastructure.
- Replacing the hamburger nav with a bottom tab bar (9 routes is too many for a tab bar; the existing pattern works).

## Decisions (settled)

1. **Approach:** native gestures + bottom sheets, reusing existing primitives (`s-sheet`, `cat-modal`, `ClassDetail` row-click drilldown). Not "light retouch only" — the Map and Demographics gaps are too big. Not "mobile-only routes" — drift risk + duplication.
2. **Breakpoints:** Tailwind defaults stay (`sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px). Phone-first base styles, `md:` flips to tablet/desktop. A custom `@media (max-width: 380px)` block in `global.css` for the most-cramped narrow-phone tweaks.
3. **Touch gesture model on the Map:** pinch-to-zoom + tap-to-pin + native overflow-scroll for pan. No JS-driven pan implementation — `touch-action: pan-x pan-y` keeps free 1-finger scroll, and we only intercept 2-finger pinch.
4. **Pinch implementation:** custom `touchstart`/`touchmove`/`touchend` with parallel Safari `gesturestart`/`gesturechange`/`gestureend` handlers. Both paths dispatch the existing `zoomstep` event, extended to accept fractional `delta` so pinch produces smooth zoom (not stepped). No third-party gesture library.
5. **Map inspector on phone:** `pinnedTile` triggers a slide-up `s-sheet` at `<md`. Desktop `<aside>` keeps rendering at `md+`. Same `<MapInspector>` component renders inside both shells.
6. **Demographics 11-column table:** trim 7 lower-priority columns at `<sm` via `display: none`. Keep Class · Pop · Fill % · Satisfaction. The existing row-click → `ClassDetail` band already shows the hidden numbers, so no data is lost.
7. **Heatmaps:** wrap in `.heatmap-scroll` (overflow-x: auto) plus a sticky-left-column rule on `.heatmap-cell.row-head`. Applied site-wide via the shared `Heatmap.svelte` component.
8. **Senate coalitions table:** horizontal-scroll the whole table (low row count makes a row-click drilldown not worth building).
9. **Touch targets:** `@media (hover: none) and (pointer: coarse)` block bumps `s-chip`, `s-tag` (interactive), `layer-tabs button`, `tier` rows, and modal close buttons to `min-height: 44px`. Desktop stays compact.
10. **Hero number scaling:** `kpi-num` font-size becomes `clamp(2rem, 9vw, 56px)`; `stat-tile .val` becomes `clamp(1.5rem, 6.5vw, 32px)`. Long values stay legible in narrow columns.
11. **Route padding:** every route's `<section>` wrapper changes from `px-6 py-5` to `px-3 py-4 md:px-6 md:py-5`. Tightens horizontal real estate on phone.
12. **No data-shape changes.** All JSON schemas, store APIs, and component prop contracts remain identical. This is purely a CSS + interaction layer.

## Architecture

### Touched files (summary)

| File | Change |
|---|---|
| `src/styles/global.css` | New touch-target media query block, narrow-mode tweaks (Overton, Tier), heatmap scroll utility, hero number clamps, mobile bottom-sheet variant for Map inspector |
| `src/lib/components/NavBar.svelte` | Hamburger drop-down items get 44px hit area; year label hides at `≤380px`; current-page label visible next to hamburger |
| `src/lib/components/MapCanvas.svelte` | New `touchstart`/`touchmove`/`touchend` handlers; `gesturestart`/`gesturechange`/`gestureend` fallback; `touch-action: pan-x pan-y`; `zoomstep` event extended to accept fractional delta |
| `src/routes/Map.svelte` | Renders `<MapInspector>` inline at `md+`, in `<MapBottomSheet>` at `<md`; layer-tabs strip switches to horizontal scroll at `<md` |
| `src/lib/components/MapInspector.svelte` | **New.** Extracted from the inline inspector body in `Map.svelte`. Same content, just decoupled from the `<aside>` shell. |
| `src/lib/components/MapBottomSheet.svelte` | **New.** Wraps `<MapInspector>` in an `s-sheet` + backdrop, dismissable. |
| `src/routes/Demographics.svelte` | Class-vitals table gets `.tbl-trim-mobile`; 7 columns get `.hide-narrow`; "tap a row for full vitals" caption visible only at `<sm` |
| `src/routes/Population.svelte` | Worldview radar grid drops to `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4`; class table gets narrow-mode padding tweak |
| `src/routes/GoIs.svelte` | GoI card body grid collapses to single column at `<480px`; radar size clamps to `min(170px, 50vw)`; Pop Capture matrix gets `.heatmap-scroll` |
| `src/routes/Parties.svelte` | Card body grid collapses to single column at `<400px`; radar 140px clamps; both compat matrices get `.heatmap-scroll` |
| `src/routes/Senate.svelte` | Coalitions table wrapped in `.tbl-scroll`; capture matrix gets `.heatmap-scroll` |
| `src/lib/components/Heatmap.svelte` | Sticky-left-column rule for `row-head` cells (CSS-only change inside the component) |
| `src/lib/components/TechCard.svelte` | `.tech-effect-chip` columns get a wrap fallback at narrow widths |
| `playwright.config.js` | New `mobile-pixel5` and `mobile-iphone13` projects with `hasTouch: true` |
| `tests-e2e/mobile-flow.spec.js` | **New.** Smoke-tests every route at iPhone 13 width: no horizontal page overflow, primary KPI visible without scroll |
| `tests-e2e/demographics.spec.js` | New test: hidden columns are not visible at `<sm`; row tap opens ClassDetail with full data |
| `tests-e2e/map.spec.js` | New test: tap-to-pin opens bottom sheet at mobile width; backdrop dismiss works |
| `tests-e2e/a11y.spec.js` | Existing 3-theme run extended to also iterate the mobile viewport |
| `tests/test_pinch_math.js` (Vitest) | **New.** Unit-tests the helper that converts two finger positions into a zoom delta |

### Components

#### Map gesture handling

- `MapCanvas.svelte` adds:
  - `touch-action: pan-x pan-y` on `.map-viewport` so 1-finger drag still uses the existing `overflow:auto` pan (no JS).
  - `on:touchstart|passive=false` / `on:touchmove|passive=false` / `on:touchend` on the viewport. Single-finger touch is ignored (lets browser scroll handle it). Two-finger touch records initial pinch distance, then on each `touchmove` calculates the new distance, computes a scale ratio, calls `e.preventDefault()`, and dispatches `zoomstep` with `{ delta: deltaScale }`.
  - `on:gesturestart|passive=false` / `on:gesturechange` / `on:gestureend` for Safari, which doesn't always emit reliable two-finger `touchmove` events. Records `e.scale`, dispatches `zoomstep` with `{ delta: ratio }`.
  - Both paths use a shared `pinchMathStep(currentScale, baseScale, currentZoom)` helper (also used by the Vitest unit test).
- `Map.svelte` extends its `zoomstep` handler:
  - Existing: `if (e.detail.reset) zoom = resetZoom(); else zoom = stepZoom(zoom, e.detail.delta)` where `delta` was always ±1 (discrete step).
  - New: if `e.detail.delta` is a fractional `Number`, treat it as a multiplier on `zoom` and clamp via `clampZoom`. Discrete `±1` keypaths still call `stepZoom`.
- Layer-tabs row at `<md`: `flex-wrap: nowrap; overflow-x: auto; scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch`. The `s-zoom` segmented control loses `margin-left: auto` at `<md` and just sits at the end of the scrollable strip.

#### Map inspector → bottom sheet

- The inspector card content (the *second* `<div class="s-card">` inside `<aside>` in `Map.svelte` — `s-card-header`, `kv` lists, workforce rows, staffing meter) extracts to `src/lib/components/MapInspector.svelte`. The Roster card (the *first* `<div class="s-card">` inside the aside) stays inline. `MapInspector`'s props are the same data inputs the inline body already reads (`tile`, `mapData`, `catalog`, `nameplate`, plus a callback for the "Filter by category" link).
- `MapBottomSheet.svelte` wraps `<MapInspector>` in an `s-sheet` + `s-sheet-backdrop`, with a `dismiss` event that fires on backdrop click, close-button click, and Escape key.
- `Map.svelte` renders a single source-of-truth inspector via CSS-only viewport scoping (no JS resize listener):
  ```svelte
  <main class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start">
    <MapCanvas .../>
    <aside class="flex flex-col gap-3">
      {#if rosterActive}
        <div class="s-card"><RosterPanel .../></div>     <!-- stays at every width -->
      {/if}
      <div class="s-card hidden md:block">
        <MapInspector .../>                              <!-- desktop-only render -->
      </div>
    </aside>
  </main>
  {#if pinnedTile}
    <MapBottomSheet
      class="md:hidden"
      on:dismiss={() => pinnedTile = null}>
      <MapInspector .../>                                <!-- mobile-only render -->
    </MapBottomSheet>
  {/if}
  ```
  - At `md+`: aside is the right rail (300px). Inspector card visible inside aside; bottom sheet hidden via `md:hidden`.
  - At `<md`: grid collapses to single column, so aside flows below the map. Roster card (if rosterActive) stays visible; inline Inspector card hides via `hidden md:block`. When `pinnedTile` is set, the bottom sheet floats over everything.
  - Roster lives in only one place (the aside) at every viewport — it just changes position from "right rail" to "below map" via the grid collapse. No duplicate render.
  - Inspector renders twice in markup but only one is visible at any time (CSS-gated).

#### Demographics table trim

- The 11-column table in `Demographics.svelte` adds class `tbl-trim-mobile` and 7 of its `<th>`/`<td>` cells get `class="hide-narrow"`:
  - Mortality, Births/year, Deaths/year, Mobility In, Mobility Out, Demand, Unemployed
- Visible at all widths: Class · Pop · Fill % · Satisfaction.
- Global CSS: `@media (max-width: 639px) { .tbl-trim-mobile .hide-narrow { display: none; } }`.
- Above the table at `<sm`, render: `<p class="tbl-hint sm:hidden">Tap a row for full vitals.</p>`.
- The existing row-click → `ClassDetail` band already renders the hidden numbers (Birth, Death, Mobility, Demand, Unemployed counts). No new component or data flow needed.

#### Heatmaps

- `Heatmap.svelte` adds CSS rules for sticky left column:
  ```css
  .heatmap-cell.row-head {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--bg);
  }
  ```
- Each `Heatmap` consumer (GoIs Pop Capture, Parties compat ×2, Senate capture) wraps the heatmap in `<div class="heatmap-scroll">`, with shared CSS:
  ```css
  .heatmap-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  ```
- Optional polish: a small right-edge fade gradient (`mask-image: linear-gradient(...)`) hints "more content to scroll." Defer if tight on budget.

#### NavBar

- Drop-down items (`<li><a>` inside `md:hidden`): change `block px-4 py-2` to `flex items-center px-4 py-3 min-h-[44px]`.
- At `≤380px`: hide the year label (`Y-XX`) — it's redundant with the `pageTitle` shown elsewhere. Apply via the new `.narrow-hide` utility:
  ```css
  @media (max-width: 380px) { .narrow-hide { display: none; } }
  ```
- Add a small current-page indicator next to the hamburger, visible at `<md`:
  ```svelte
  <span class="md:hidden text-xs uppercase tracking-widest text-muted">
    {pages.find((p) => p.path === $location)?.label ?? ''}
  </span>
  ```

#### Globals — touch targets, hero clamps, narrow-mode tweaks

```css
/* Touch-device upgrade — desktop unaffected */
@media (hover: none) and (pointer: coarse) {
  .s-chip, .layer-tabs button,
  .layer-tabs .layer-menu-trigger, .tier, .cat-close,
  .roster-row, .roster-section-header {
    min-height: 44px;
    padding: 10px 14px;
  }
  .filter-chip button {
    /* Visually 12px; tappable 32×32 via padding + negative margin */
    padding: 10px;
    margin: -10px;
  }
}

/* KPI hero clamps */
.kpi-block .kpi-num { font-size: clamp(2rem, 9vw, 56px); }
.stat-tile .val    { font-size: clamp(1.5rem, 6.5vw, 32px); }

/* Narrow-mode reflows */
@media (max-width: 380px) {
  .overton-row {
    grid-template-columns: 1fr;
    gap: 4px;
    padding: 10px 0;
  }
  .overton-row .overton-axis-left  { text-align: left; }
  .overton-row .overton-axis-right { text-align: right; grid-column: 1; }
  .overton-row .overton-track { grid-column: 1; }
  .overton-row .overton-value { grid-column: 1; text-align: right; }
  .tier { grid-template-columns: 60px 1fr auto; }
}
```

#### Route-section padding

A simple find-replace across the 9 routes:
```
- <section class="px-6 py-5 max-w-[1600px]">
+ <section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px]">
```

### Data flow

No data-flow changes. All stores, JSON schemas, and component props stay identical. The work is entirely in the CSS + interaction layer.

```
Existing flow (unchanged):
  GitHub Action → JSON in public/data/ → fetch → store → component

New (additive):
  touchstart/touchmove on .map-viewport
    → pinchMathStep(currentScale, baseScale, currentZoom)
    → dispatch('zoomstep', { delta: ratio })
    → Map.svelte: zoom = clampZoom(zoom * ratio); writeZoom(zoom)
    → MapCanvas reactive: drawTerrain(...) at new displayScale
```

### Testing

#### Playwright

- Add to `playwright.config.js`:
  ```js
  {
    name: 'mobile-pixel5',
    use: { ...devices['Pixel 5'], hasTouch: true },
  },
  {
    name: 'mobile-iphone13',
    use: { ...devices['iPhone 13'], hasTouch: true },
  },
  ```
- Existing desktop project unchanged.
- `a11y.spec.js`: extend the existing 3-theme loop to also iterate `[desktop, mobile-pixel5]` viewports.
- `demographics.spec.js`: new test asserts that at iPhone width the hidden columns have `display: none`, and that `page.touchscreen.tap(row)` opens the ClassDetail band with the hidden numbers visible.
- `map.spec.js`: new test asserts `page.touchscreen.tap(canvas, x, y)` produces a `s-sheet` element with the tile inspector content; backdrop tap dismisses it.

#### Vitest unit test

- `tests/test_pinch_math.js`:
  ```
  pinchMathStep(currentScale, baseScale, currentZoom) → newZoom
    - Two fingers move from 100px apart to 200px apart at zoom 1.0 → newZoom 2.0
    - Two fingers move from 100px apart to 50px apart at zoom 1.0 → newZoom 0.5
    - Result is clamped to [ZOOM_MIN, ZOOM_MAX]
    - Edge cases: baseScale = 0, currentScale = 0
  ```

#### `tests-e2e/mobile-flow.spec.js` (new)

For each route in `[/, /map, /population, /demographics, /gois, /tech, /parties, /senate, /situations]`:
- Navigate at iPhone 13 viewport.
- Wait for primary content to load.
- Assert no console errors during load.
- Assert `document.documentElement.scrollWidth ≤ window.innerWidth + 1` (no horizontal page overflow).
- Assert the first `.kpi-block` (or equivalent primary content) is visible without scroll.

#### Manual verification

Per the project's CLAUDE.md (`For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete`):
- Dev server with DevTools device emulation across Pixel 5, iPhone 13, iPhone SE (smallest realistic).
- Real-device check on iPhone (Safari) and Android (Chrome) — pinch / scroll behaviour differs between browsers.

## Risks / open questions

- **Pinch on Safari iOS** is the riskiest piece. Safari sometimes pre-empts canvas touch events with native page-pinch even with `touch-action: pan-x pan-y`. The `gesturestart`/`gesturechange` parallel path mitigates this, but real-device testing is essential. Fallback: keep the existing `+`/`−` zoom buttons as the always-works escape hatch.
- **`touch-action: pan-x pan-y`** allows free 1-finger scroll, but means we cannot also intercept single-finger drag for any custom gesture (e.g., long-press preview). If we later want long-press preview, we'd need to either move to `touch-action: none` and re-implement scroll, or use a `pointercancel` time-window approach.
- **`Heatmap` sticky-left** depends on every theme's `--bg` being opaque. All three themes (light, dark, schematic) define `--bg` as a solid color; this is safe.
- **Mobile Playwright browser engine** — `Pixel 5` and `iPhone 13` device descriptors run in Chromium under the hood (Playwright doesn't use real Safari/WebKit for `iPhone 13` unless explicitly configured). Real iOS Safari pinch behaviour is NOT covered by automated tests. Manual verification on a real iPhone is the only reliable check for that path.
- **`s-sheet` already-existing usage** — currently used by `GoIs.svelte` for sub-faction. Reusing the same class is fine, but if both pages were ever to render at the same time at `<md` (impossible today since they're separate routes), z-index stacking would need to be revisited.

## Phasing (informational — actual sequencing belongs in the implementation plan)

The pieces are largely independent and can ship in any order. A natural sequencing for review/testing:

1. Globals (touch targets, padding, hero clamps, narrow-mode CSS) — lowest risk, broadest impact.
2. NavBar polish.
3. Heatmap sticky-left + scroll wrapper (one component change, ripples to GoIs/Parties/Senate).
4. Per-route reflow (Demographics trim, Population/GoIs/Parties radar collapse, Senate scroll wrap, TechCard chip wrap).
5. Map inspector → bottom sheet (component extraction + new BottomSheet wrapper).
6. Map gestures (pinch + Safari gesture handlers + fractional zoomstep).
7. Tests (Playwright mobile projects + new specs + Vitest pinch math).

Each phase is independently shippable.

## Out of scope (explicit)

- Native PWA manifest, service worker, offline mode.
- Bottom tab bar nav (rejected — too many routes for the pattern to work).
- Dedicated landscape layouts.
- Visual-regression / screenshot diff testing.
- Replacing the hamburger nav.
- Backend, sync, or schema changes.
