# Resizable Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard's 40×40 colony map fit-to-width by default with a user-controlled zoom multiplier (0.75×–2×), preserving render sharpness, hit-testing, and overlay legibility.

**Architecture:** Two-layer wrapper (outer `.map-viewport` with `bind:clientWidth` and `overflow:auto`, inner `.map-content` sized to the rendered pixel dimensions). Canvas draws at fixed `BASE_TILE = 16` coordinates with `ctx.scale(displayScale × dpr)` once per draw. SVG `viewBox` likewise stays in BASE_TILE units so all literal SVG coords keep working. Zoom state lives in `Map.svelte` (single source of truth) with localStorage persistence; `MapCanvas.svelte` is display-only and dispatches `zoomstep` events for keyboard input. Pure helpers (clamp, step, snap, read/write localStorage) live in a small testable module.

**Tech Stack:** Svelte 4, Vite, Tailwind tokens (utilities banned per CLAUDE.md #12 — design vocabulary lives in `global.css`), Vitest + jsdom + @testing-library/svelte for unit tests, Playwright + @axe-core/playwright for e2e + a11y.

**Spec:** `docs/superpowers/specs/2026-05-07-resizable-map-design.md`

**Commit strategy:** Per the user's "Defer commits until plan execution finishes" preference, **DO NOT commit between tasks**. Verify each task by running its tests / visually checking, then move on. Final task is to stop and ask the user how to structure commits.

---

## File Structure

**New files:**
- `src/lib/map-zoom.js` — pure helpers: clamp, step on the 0.25 grid, reset, localStorage round-trip with try/catch. Exported constants for ZOOM_MIN/MAX/DEFAULT/STEP/STORAGE_KEY.
- `src/lib/map-zoom.test.js` — vitest unit tests for the helpers.
- `tests-e2e/map-zoom.spec.js` — Playwright e2e covering the zoom UI, accessibility, and persistence.

**Modified files:**
- `src/lib/components/MapCanvas.svelte` — two-layer wrapper, `bind:clientWidth`, fit-to-width sizing pipeline, canvas DPR + ctx.scale rewrite, `zoom` prop, `zoomstep` event dispatch, viewport tabindex, keyboard handler bound on viewport.
- `src/routes/Map.svelte` — owns `zoom` state, reads/writes localStorage, renders `.s-zoom` segmented control inside the `.layer-tabs` row, listens to `zoomstep`, applies via `stepZoom`/`resetZoom`.
- `src/styles/global.css` — adds `.map-viewport`, `.map-content`, `.s-zoom` blocks; threads CSS variables already on `:root[data-theme=…]`.
- `CLAUDE.md` — adds a gotcha entry about BASE_TILE / displayScale separation as the contract for future map work.

**Untouched:**
- Backend, sync, schema, JSON shape, palette logic, hit-testing math, overlay glyph layout, sidebar layout.

---

## Task 1: Baseline check

**Files:** none modified.

- [ ] **Step 1: Install dependencies**

Run from the worktree root:

```bash
npm install
```

Expected: completes without errors, populates `node_modules/`.

- [ ] **Step 2: Run unit tests**

Run:

```bash
npm test -- --run
```

Expected: all existing vitest tests pass. Note count for comparison later. If any unrelated test fails on this branch (no edits yet), record the failure and confirm it's identical to `main` before proceeding — this is a baseline drift indicator, not a new regression.

- [ ] **Step 3: Run a build sanity check**

Run:

```bash
npm run build
```

Expected: clean Vite build into `dist/` with no errors.

- [ ] **Step 4: Skip Playwright baseline**

Playwright e2e requires the Pages-deployed JSON to be present. We'll wire the new e2e spec in Task 11 and rely on `npm run dev` for live browser verification in earlier tasks. No baseline run needed.

---

## Task 2: Pure zoom helpers (TDD)

**Files:**
- Create: `src/lib/map-zoom.js`
- Create: `src/lib/map-zoom.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/map-zoom.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_DEFAULT,
  ZOOM_STEP,
  ZOOM_STORAGE_KEY,
  clampZoom,
  stepZoom,
  resetZoom,
  readZoom,
  writeZoom,
} from './map-zoom.js';

describe('clampZoom', () => {
  it('clamps below ZOOM_MIN to ZOOM_MIN', () => {
    expect(clampZoom(0.1)).toBeCloseTo(ZOOM_MIN, 10);
  });
  it('clamps above ZOOM_MAX to ZOOM_MAX', () => {
    expect(clampZoom(99)).toBeCloseTo(ZOOM_MAX, 10);
  });
  it('passes through values in range', () => {
    expect(clampZoom(1.0)).toBeCloseTo(1.0, 10);
    expect(clampZoom(1.5)).toBeCloseTo(1.5, 10);
  });
  it('returns ZOOM_DEFAULT for non-finite input', () => {
    expect(clampZoom(NaN)).toBeCloseTo(ZOOM_DEFAULT, 10);
    expect(clampZoom(Infinity)).toBeCloseTo(ZOOM_DEFAULT, 10);
    expect(clampZoom(undefined)).toBeCloseTo(ZOOM_DEFAULT, 10);
  });
});

describe('stepZoom', () => {
  it('increments by ZOOM_STEP and snaps to grid', () => {
    expect(stepZoom(1.0, +1)).toBeCloseTo(1.0 + ZOOM_STEP, 10);
    expect(stepZoom(1.0, -1)).toBeCloseTo(1.0 - ZOOM_STEP, 10);
  });
  it('clamps at the upper bound', () => {
    expect(stepZoom(ZOOM_MAX, +1)).toBeCloseTo(ZOOM_MAX, 10);
  });
  it('clamps at the lower bound', () => {
    expect(stepZoom(ZOOM_MIN, -1)).toBeCloseTo(ZOOM_MIN, 10);
  });
  it('snaps an off-grid current value onto the grid before stepping', () => {
    // 1.13 → snap to nearest grid point (1.25), then add ZOOM_STEP → 1.5.
    expect(stepZoom(1.13, +1)).toBeCloseTo(1.5, 10);
  });
});

describe('resetZoom', () => {
  it('returns ZOOM_DEFAULT', () => {
    expect(resetZoom()).toBeCloseTo(ZOOM_DEFAULT, 10);
  });
});

describe('readZoom / writeZoom', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns ZOOM_DEFAULT when nothing is stored', () => {
    expect(readZoom()).toBeCloseTo(ZOOM_DEFAULT, 10);
  });
  it('round-trips a valid value', () => {
    writeZoom(1.5);
    expect(readZoom()).toBeCloseTo(1.5, 10);
  });
  it('clamps an out-of-range stored value on read', () => {
    localStorage.setItem(ZOOM_STORAGE_KEY, '5.0');
    expect(readZoom()).toBeCloseTo(ZOOM_MAX, 10);
  });
  it('returns ZOOM_DEFAULT for a corrupt stored value', () => {
    localStorage.setItem(ZOOM_STORAGE_KEY, 'not a number');
    expect(readZoom()).toBeCloseTo(ZOOM_DEFAULT, 10);
  });
  it('survives localStorage being unavailable on read', () => {
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    try {
      expect(readZoom()).toBeCloseTo(ZOOM_DEFAULT, 10);
    } finally {
      Storage.prototype.getItem = originalGetItem;
    }
  });
  it('survives localStorage being unavailable on write', () => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
    try {
      expect(() => writeZoom(1.5)).not.toThrow();
    } finally {
      Storage.prototype.setItem = originalSetItem;
    }
  });
});
```

- [ ] **Step 2: Run tests — expect them to fail**

Run:

```bash
npm test -- --run src/lib/map-zoom.test.js
```

Expected: all tests fail with "Cannot resolve module './map-zoom.js'" or similar.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/map-zoom.js`:

```javascript
// Pure helpers for the Map page's zoom multiplier.
// State lives in Map.svelte; this module is just maths + storage.

export const ZOOM_MIN = 0.75;
export const ZOOM_MAX = 2.0;
export const ZOOM_DEFAULT = 1.0;
export const ZOOM_STEP = 0.25;
export const ZOOM_STORAGE_KEY = 'scorp.map.zoom';

export function clampZoom(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return ZOOM_DEFAULT;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));
}

function snapToStep(v) {
  // Snap onto the ZOOM_MIN + k*ZOOM_STEP grid so off-grid drift never accumulates.
  const k = Math.round((v - ZOOM_MIN) / ZOOM_STEP);
  return ZOOM_MIN + k * ZOOM_STEP;
}

export function stepZoom(current, delta) {
  const snapped = snapToStep(clampZoom(current));
  return clampZoom(snapped + delta * ZOOM_STEP);
}

export function resetZoom() {
  return ZOOM_DEFAULT;
}

export function readZoom() {
  try {
    const raw = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (raw == null) return ZOOM_DEFAULT;
    const v = Number.parseFloat(raw);
    return clampZoom(v);
  } catch {
    return ZOOM_DEFAULT;
  }
}

export function writeZoom(v) {
  try {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(clampZoom(v)));
  } catch {
    /* localStorage unavailable — silently degrade */
  }
}
```

- [ ] **Step 4: Run tests — expect them to pass**

Run:

```bash
npm test -- --run src/lib/map-zoom.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Run the full unit test suite**

Run:

```bash
npm test -- --run
```

Expected: every test passes (no regressions in unrelated specs).

---

## Task 3: Switch canvas drawing to BASE_TILE + DPR pipeline

**Files:**
- Modify: `src/lib/components/MapCanvas.svelte` — only the `drawTerrain` function and adjacent `<canvas>` width/height attribute bindings.

**Goal of this task:** introduce the `BASE_TILE = 16` constant and the `ctx.setTransform(scale * dpr, …)` pipeline *without changing visible behaviour*. The map should still render exactly as before (640×640, sharp at 1×). This isolates the canvas-drawing refactor from the wrapper-structure change in Task 4.

- [ ] **Step 1: Replace `TILE_SIZE` with `BASE_TILE`**

In `src/lib/components/MapCanvas.svelte`, near the top of the `<script>`:

```javascript
const BASE_TILE = 16;          // drawing-coordinate size; never changes.
// Keep an alias for any inline templates that still read TILE_SIZE — we'll
// scrub remaining references in the next steps.
const TILE_SIZE = BASE_TILE;
```

- [ ] **Step 2: Add `displayScale` as a reactive — for now, hardcoded to 1**

Below the existing reactive block:

```javascript
// Kept at 1 in this task; Task 4 wires it to the measured viewport width.
$: displayScale = 1;
```

- [ ] **Step 3: Rewrite `drawTerrain` to use `setTransform` + DPR**

Replace the existing `drawTerrain` function with:

```javascript
async function drawTerrain(mapData, layer, layerMax, filters, displayScale) {
  if (!mapData) return;
  await tick();
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = mapData.width * BASE_TILE * displayScale;
  const cssH = mapData.height * BASE_TILE * displayScale;

  // Backing store sized to logical-pixel × DPR for crisp rendering.
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  // Pre-resolve theme tokens (CLAUDE.md gotcha #14 — canvas fillStyle does
  // not resolve var(--…)).
  const styles = getComputedStyle(canvas);
  const theme = {
    bg: styles.getPropertyValue('--bg').trim() || '#0a0a0a',
    crit: styles.getPropertyValue('--crit').trim() || '#ff4d4d',
  };

  const ctx = canvas.getContext('2d');
  // One transform handles both display-scale and DPR; drawing code stays in
  // BASE_TILE coordinates regardless of zoom.
  ctx.setTransform(displayScale * dpr, 0, 0, displayScale * dpr, 0, 0);
  ctx.clearRect(0, 0, mapData.width * BASE_TILE, mapData.height * BASE_TILE);

  for (const t of mapData.tiles) {
    ctx.fillStyle = tileColor(t, layer, mapData.palettes, layerMax, theme);
    ctx.fillRect(t.x * BASE_TILE, t.y * BASE_TILE, BASE_TILE, BASE_TILE);
  }

  if (filters && (filters.resource || filters.feature || filters.improvement)) {
    ctx.fillStyle = bgWithAlpha(theme.bg);
    for (const t of mapData.tiles) {
      if (!tileMatches(t, filters)) {
        ctx.fillRect(t.x * BASE_TILE, t.y * BASE_TILE, BASE_TILE, BASE_TILE);
      }
    }
  }
}
```

- [ ] **Step 4: Update the reactive draw call to include `displayScale`**

Find:

```javascript
$: drawTerrain(mapData, layer, layerMax, filters);
```

Replace with:

```javascript
$: drawTerrain(mapData, layer, layerMax, filters, displayScale);
```

- [ ] **Step 5: Update existing `width`/`height` reactive declarations**

The existing lines:

```javascript
$: width = mapData.width * TILE_SIZE;
$: height = mapData.height * TILE_SIZE;
$: viewBox = `0 0 ${width} ${height}`;
```

are unchanged in *this task* (they still drive the SVG viewBox and the wrapper inline width — we'll restructure the wrapper in Task 4). Just confirm `TILE_SIZE` still resolves (it aliases `BASE_TILE`).

- [ ] **Step 6: Drop the explicit `{width}`/`{height}` attributes from `<canvas>`**

The canvas's pixel-size attributes are now set imperatively inside `drawTerrain`. In the existing `<canvas>` element, **delete only the `{width}` and `{height}` attribute lines** and add an inline `style` attribute. Every other attribute, listener, and class stays exactly as it is.

Replace this:

```html
<canvas
  bind:this={canvas}
  {width}
  {height}
  role="application"
  aria-label="Colony map: {mapData.width} by {mapData.height} grid"
  tabindex="0"
  on:mousemove={handleMove}
  on:click={handleClick}
  on:keydown={handleKey}
  class="block w-full h-full cursor-crosshair focus:outline focus:outline-2 focus:outline-accent"
></canvas>
```

With this:

```html
<canvas
  bind:this={canvas}
  style="width: 100%; height: 100%;"
  role="application"
  aria-label="Colony map: {mapData.width} by {mapData.height} grid"
  tabindex="0"
  on:mousemove={handleMove}
  on:click={handleClick}
  on:keydown={handleKey}
  class="block w-full h-full cursor-crosshair focus:outline focus:outline-2 focus:outline-accent"
></canvas>
```

The Tailwind class already gives it `width:100%;height:100%`; the inline style is belt-and-braces for any environment that strips Tailwind. All event handlers and ARIA attributes stay.

- [ ] **Step 7: Verify visually**

Run `npm run dev` and load the Map page:

```bash
npm run dev
```

Navigate to `http://localhost:5173/#/map`.

Expected behaviour (unchanged from before this task):
- Map renders at 640×640.
- Hovering a tile shows the inspector card.
- Clicking pins it.
- Switching layer tabs works.

Bonus: pixels should look slightly *crisper* on Hi-DPI screens than before (this is the DPR fix landing as a side effect).

- [ ] **Step 8: Run unit tests + build**

```bash
npm test -- --run
npm run build
```

Expected: all tests pass, build succeeds.

---

## Task 4: Two-layer wrapper + fit-to-width

**Files:**
- Modify: `src/lib/components/MapCanvas.svelte` — wrapper structure, `bind:clientWidth`, `displayScale` derivation from viewport width.

**Goal:** the map now fills the available column width by default, with internal scrolling reserved for future zoom-in. Still no zoom controls — `zoom = 1` stays implicit.

- [ ] **Step 1: Replace the wrapper markup (preserve canvas + svg children verbatim)**

In `src/lib/components/MapCanvas.svelte`, the current structure is:

```
<div class="map-canvas-wrap">
  <div class="relative inline-block border-4 border-border" style="...">
    <canvas .../>             ← entire canvas element (after Task 3 step 6 edit)
    <svg ...>                 ← entire <svg> element with all overlays inside
      ...lots of overlay markup...
    </svg>
  </div>
  {#if layer !== 'terrain'} ... {/if}    ← legend block, stays as-is
</div>
```

The change is to wrap the existing `<canvas>` and `<svg>` elements in a new two-layer container. Concretely:

1. Replace the opening line `<div class="relative inline-block border-4 border-border" style="width: {width}px; height: {height}px;">` with:

```html
<div
  class="map-viewport relative border-4 border-border"
  bind:clientWidth={viewportClientWidth}
>
  <div
    class="map-content relative"
    style="width: {contentCssW}px; height: {contentCssH}px;"
  >
```

2. Leave the existing `<canvas>` element in place exactly as it is (already updated by Task 3 step 6 — full attribute list intact).

3. Leave the existing `<svg viewBox={viewBox} class="absolute inset-0 pointer-events-none w-full h-full">…</svg>` element in place exactly as it is, including ALL of its overlay children (the improvement glyphs, resource chips, feature chips, focus highlight, filter rings — all hundreds of lines of `{#each}` blocks). Do NOT rewrite or omit any overlay markup.

4. Replace the existing closing `</div>` of the inner inline-block wrapper with TWO closing tags — one for `.map-content`, one for `.map-viewport`:

```html
  </div>  <!-- /.map-content -->
</div>    <!-- /.map-viewport -->
```

The outer `<div class="map-canvas-wrap">` and the legend block underneath stay as-is.

- [ ] **Step 2: Add reactive declarations for sizing**

Replace the placeholder `$: displayScale = 1;` (from Task 3) and the existing `$: width / $: height` block with:

```javascript
let viewportClientWidth = 0;

const NATIVE_TILE_PX = BASE_TILE; // alias for readability in formulas
$: nativeMapW = mapData.width * NATIVE_TILE_PX;
$: nativeMapH = mapData.height * NATIVE_TILE_PX;
$: fitScale = viewportClientWidth > 0
  ? viewportClientWidth / nativeMapW
  : 1;
// In this task, zoom is implicit-1; Task 5 wires it to a real prop.
$: displayScale = fitScale;
$: contentCssW = nativeMapW * displayScale;
$: contentCssH = nativeMapH * displayScale;
$: viewBox = `0 0 ${nativeMapW} ${nativeMapH}`; // unchanged shape, BASE_TILE coords
```

Delete the old `$: width = …` and `$: height = …` lines (`width`/`height` aren't referenced anywhere else after the canvas attribute change in Task 3 step 6 — verify by searching the file).

- [ ] **Step 3: Verify visually that the map now fills the column**

```bash
npm run dev
```

Open `http://localhost:5173/#/map` on a wide window (≥1400px). Expected:
- Map fills the left column (no empty band on the right).
- Tiles render at a larger size than 16px (closer to 32px on a typical screen).
- Hover/click/inspector still work — verify by hovering a tile.
- Resizing the browser window resizes the map smoothly.

- [ ] **Step 4: Verify hit-testing still tracks**

In dev tools, hover specific tiles and confirm the inspector card displays the right `(x, y)`. Try corners (0,0), (39,39), and a tile near the centre. Coordinates should match.

- [ ] **Step 5: Run unit tests**

```bash
npm test -- --run
```

Expected: all pass.

---

## Task 5: Add `zoom` prop + clamped displayScale

**Files:**
- Modify: `src/lib/components/MapCanvas.svelte`

- [ ] **Step 1: Accept `zoom` as a prop**

Near the top of `<script>` in `MapCanvas.svelte`, add:

```javascript
import { ZOOM_MIN, ZOOM_MAX, ZOOM_DEFAULT, clampZoom } from '../map-zoom.js';

export let zoom = ZOOM_DEFAULT;
```

- [ ] **Step 2: Wire zoom into displayScale**

Replace the `$: displayScale = fitScale;` line with:

```javascript
$: displayScale = (() => {
  const z = clampZoom(zoom);
  const raw = fitScale * z;
  // Hard floor protects against pathological narrow viewports.
  return Math.max(0.25, raw);
})();
```

- [ ] **Step 3: Verify the prop wiring without modifying `Map.svelte`**

The default value `zoom = ZOOM_DEFAULT` (1.0) means `MapCanvas` still renders identical to Task 4 even though the prop now exists. Confirm the prop is plumbed correctly by inspecting reactivity in DevTools rather than by adding a temporary literal — `Map.svelte` will pass `zoom` for real in Task 6.

```bash
npm run dev
```

In the browser DevTools console:

```javascript
// Inspect the MapCanvas component instance via its DOM root.
// Easier: temporarily add `console.log` inside MapCanvas's reactive block.
```

Suggested verification: in `MapCanvas.svelte`, *temporarily* add a `console.log` next to the `displayScale` reactive — for example `$: console.log('displayScale', displayScale, 'fitScale', fitScale, 'zoom', zoom);` — reload, confirm the log fires with sane values (e.g. `displayScale ≈ fitScale ≈ 2`, `zoom = 1`), then **delete the console.log** before continuing. No changes to `Map.svelte` in this task.

- [ ] **Step 4: Run tests**

```bash
npm test -- --run
```

Expected: all pass.

---

## Task 6: Zoom state in Map.svelte + localStorage

**Files:**
- Modify: `src/routes/Map.svelte`

- [ ] **Step 1: Import zoom helpers**

At the top of the `<script>` in `src/routes/Map.svelte`, add:

```javascript
import {
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_DEFAULT,
  ZOOM_STEP,
  clampZoom,
  stepZoom,
  resetZoom,
  readZoom,
  writeZoom,
} from '../lib/map-zoom.js';
```

- [ ] **Step 2: Add `zoom` state and persistence wiring (single consolidated `onMount`)**

There must be exactly one `onMount` in `Map.svelte` after this step. Apply the changes in this order:

1. Near the existing `let layer = 'terrain';` declarations, add two new `let` bindings:

```javascript
let zoom = ZOOM_DEFAULT;   // overwritten in onMount once localStorage is available
let zoomReady = false;     // gates the persistence reactive so we don't overwrite stored value with the default on first tick
```

2. Replace the entire existing `onMount` block — currently:

```javascript
onMount(() => {
  pageTitle.set('Map');
  if ($meta?.synced_at) loadMap($meta.synced_at);
});
```

with this consolidated version:

```javascript
onMount(() => {
  pageTitle.set('Map');
  if ($meta?.synced_at) loadMap($meta.synced_at);
  zoom = readZoom();
  zoomReady = true;
});
```

3. Anywhere below the `onMount` block (the script's existing `$:` reactive declarations are a natural neighbour), add the persistence reactive:

```javascript
$: if (zoomReady) writeZoom(zoom);
```

The `zoomReady` flag means the very first reactive run (which fires before `onMount` completes) is a no-op; subsequent updates to `zoom` write through to localStorage.

- [ ] **Step 3: Pass `zoom` into MapCanvas**

Update the `<MapCanvas>` usage:

```html
<MapCanvas
  mapData={$map}
  {layer}
  tab={layer}
  {filters}
  {zoom}
  on:hover={(e) => (hoverTile = e.detail)}
  on:pin={(e) => (pinnedTile = e.detail)}
/>
```

- [ ] **Step 4: Verify persistence (manual)**

```bash
npm run dev
```

In the browser dev tools console:

```javascript
localStorage.setItem('scorp.map.zoom', '1.5');
location.reload();
```

Expected: map loads at 1.5× of fit-to-width.

Then in the console:

```javascript
localStorage.setItem('scorp.map.zoom', '99');
location.reload();
```

Expected: clamps to 2× on read; map loads at 2×.

```javascript
localStorage.setItem('scorp.map.zoom', 'corrupt');
location.reload();
```

Expected: falls back to default 1.0×.

```javascript
localStorage.removeItem('scorp.map.zoom');
location.reload();
```

Expected: default 1.0× (no scroll on a wide window).

- [ ] **Step 5: Run unit tests**

```bash
npm test -- --run
```

Expected: all pass.

---

## Task 7: `zoomstep` event + keyboard shortcuts

**Files:**
- Modify: `src/lib/components/MapCanvas.svelte`
- Modify: `src/routes/Map.svelte`

- [ ] **Step 1: Extend `handleKey` in MapCanvas**

In `src/lib/components/MapCanvas.svelte`, find the `handleKey` function and replace with:

```javascript
function handleKey(e) {
  // Don't intercept browser zoom or any modifier-prefixed shortcuts.
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // Zoom shortcuts.
  if (e.key === '+' || e.key === '=') {
    dispatch('zoomstep', { delta: +1 });
    e.preventDefault();
    return;
  }
  if (e.key === '-' || e.key === '_') {
    dispatch('zoomstep', { delta: -1 });
    e.preventDefault();
    return;
  }
  if (e.key === '0') {
    dispatch('zoomstep', { reset: true });
    e.preventDefault();
    return;
  }

  // Existing arrow + Enter/Space behaviour follows.
  let { x, y } = focused;
  if (e.key === 'ArrowLeft') x = Math.max(0, x - 1);
  else if (e.key === 'ArrowRight') x = Math.min(mapData.width - 1, x + 1);
  else if (e.key === 'ArrowUp') y = Math.max(0, y - 1);
  else if (e.key === 'ArrowDown') y = Math.min(mapData.height - 1, y + 1);
  else if (e.key === 'Enter' || e.key === ' ') { dispatch('pin', tileAt(x, y)); e.preventDefault(); return; }
  else return;
  e.preventDefault();
  focused = { x, y };
  dispatch('hover', tileAt(x, y));
}
```

- [ ] **Step 2: Bind `handleKey` to the viewport too**

In the wrapper markup, add `tabindex="0"` and `on:keydown={handleKey}` to the `.map-viewport` div so keyboard input works even when the canvas is partially scrolled out:

```html
<div
  class="map-viewport relative border-4 border-border"
  bind:clientWidth={viewportClientWidth}
  tabindex="0"
  on:keydown={handleKey}
>
```

The existing `tabindex="0"` and `on:keydown={handleKey}` on the `<canvas>` stay — both elements can take focus, both can fire keyboard events.

- [ ] **Step 3: Listen for `zoomstep` in Map.svelte**

In `src/routes/Map.svelte`, add the event handler on `<MapCanvas>`:

```html
<MapCanvas
  mapData={$map}
  {layer}
  tab={layer}
  {filters}
  {zoom}
  on:hover={(e) => (hoverTile = e.detail)}
  on:pin={(e) => (pinnedTile = e.detail)}
  on:zoomstep={(e) => {
    if (e.detail.reset) zoom = resetZoom();
    else zoom = stepZoom(zoom, e.detail.delta);
  }}
/>
```

- [ ] **Step 4: Verify keyboard shortcuts work**

```bash
npm run dev
```

On the Map page, click the canvas to give it focus, then press:
- `+` (Shift+= on US layouts) → map zooms in by one step.
- `-` → zooms out by one step.
- `0` → resets to 1.0×.

Verify: `Ctrl++` and `Cmd++` still trigger browser zoom (our handler should ignore them).

Verify keyboard works after scrolling the viewport: zoom in to 2×, scroll the inner content, click on the viewport border (not the canvas), press `0`. Map resets.

- [ ] **Step 5: Run unit tests**

```bash
npm test -- --run
```

Expected: all pass.

---

## Task 8: `.s-zoom` UI control in Map.svelte

**Files:**
- Modify: `src/routes/Map.svelte`

- [ ] **Step 1: Add the segmented zoom control as a sibling inside `.layer-tabs`**

Per the spec (decision 7), the zoom group lives inside the existing `.layer-tabs` element — *not* in a new wrapper. The existing block is:

```html
<div class="layer-tabs">
  {#each LAYERS as l}
    <button
      aria-pressed={layer === l.value}
      on:click={() => (layer = l.value)}
    >
      {l.label}{THEMATIC_LAYERS.some(t => t.value === l.value) && l.value !== 'terrain' ? ' yield' : ''}
    </button>
  {/each}
</div>
```

Two changes: (a) inside the `{#each}` body, rename the inner closure parameter from `t` to `lyr` so it no longer shadows the outer `$: t = pinnedTile ?? hoverTile;` reactive (low-cost cleanup while we're touching the block); (b) append the zoom group as a final child of `.layer-tabs`. Result:

```html
<div class="layer-tabs">
  {#each LAYERS as l}
    <button
      aria-pressed={layer === l.value}
      on:click={() => (layer = l.value)}
    >
      {l.label}{THEMATIC_LAYERS.some(lyr => lyr.value === l.value) && l.value !== 'terrain' ? ' yield' : ''}
    </button>
  {/each}

  <div class="s-zoom" role="group" aria-label="Map zoom">
    <button
      type="button"
      aria-label="Zoom out"
      disabled={zoom <= ZOOM_MIN}
      on:click={() => { zoom = stepZoom(zoom, -1); }}
    >−</button>
    <button
      type="button"
      aria-label="Reset zoom to {Math.round(ZOOM_DEFAULT * 100)} percent"
      aria-pressed={zoom === ZOOM_DEFAULT}
      on:click={() => { zoom = resetZoom(); }}
    >{Math.round(zoom * 100)}%</button>
    <button
      type="button"
      aria-label="Zoom in"
      disabled={zoom >= ZOOM_MAX}
      on:click={() => { zoom = stepZoom(zoom, +1); }}
    >+</button>
  </div>
</div>
```

The zoom group is right-aligned via `margin-left: auto` in the CSS task — no extra wrapper needed.

- [ ] **Step 2: Verify in dev**

```bash
npm run dev
```

On the Map page:
- Three buttons (`−` `100%` `+`) appear at the right of the tabs row.
- Clicking `+` increases zoom by one step; the `100%` label updates.
- At `200%`, the `+` button is disabled.
- Clicking the middle button resets to `100%`.
- At `75%`, the `−` button is disabled.

- [ ] **Step 3: Verify keyboard parity**

Click the canvas, then press `+`/`-`/`0`. The zoom indicator and the map size should update identically.

- [ ] **Step 4: Run unit tests**

```bash
npm test -- --run
```

Expected: all pass.

---

## Task 9: CSS for `.map-viewport`, `.map-content`, `.s-zoom`

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add the new CSS blocks**

Open `src/styles/global.css` and append the following to the relevant sections (near the existing `.layer-tabs` block):

```css
.map-viewport {
  width: 100%;
  max-width: 100%;
  overflow: auto;
  /* Match existing border-4 border-border via Tailwind utility on the
     element; nothing to add here for the border itself. */
  background: var(--bg-2);
}

.map-content {
  position: relative;
  /* width/height inline-styled to displayedCssPx in the component. */
}

.s-zoom {
  display: inline-flex;
  align-items: stretch;
  margin-left: auto;        /* push to the right end of the .layer-tabs flex row */
  border: 1px solid var(--border);
  background: var(--bg);
  /* No --font-mono token exists in the theme blocks — use the same literal
     stack as Tailwind's font-mono utility used throughout the app. */
  font-family: ui-monospace, "JetBrains Mono", "IBM Plex Mono", Consolas, monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.s-zoom button {
  background: transparent;
  color: var(--fg);
  border: none;
  border-right: 1px solid var(--border);
  padding: 4px 10px;
  min-width: 28px;
  cursor: pointer;
  line-height: 1;
}

.s-zoom button:last-child {
  border-right: none;
}

.s-zoom button:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--bg);
}

.s-zoom button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.s-zoom button[aria-pressed="true"] {
  background: var(--accent);
  color: var(--bg);
}
```

- [ ] **Step 2: Sanity-check CSS variable coverage**

The above uses `--bg`, `--bg-2`, `--fg`, `--border`, `--accent`, `--accent-soft`. Per CLAUDE.md #12, all three themes (`light`, `dark`, `schematic`) must define every variable used by a component. Open `src/styles/global.css` and confirm these all exist under each `:root[data-theme=…]` block. If any is missing, fall back to a hard-coded sensible default at the use site (e.g. `var(--bg-2, #f0f0f0)`); do NOT silently add a new variable to one theme without also adding it to the other two.

(If this check fails, treat it as a stop-and-ask moment. Don't unilaterally edit theme blocks. Note: `--font-mono` is intentionally NOT used here — `.s-zoom` already inlines the literal monospace stack.)

- [ ] **Step 3: Verify visually across all three themes**

```bash
npm run dev
```

On the Map page, cycle the theme toggle (☀ ☾ ⊞) and confirm:
- Zoom buttons are legible in light mode.
- Zoom buttons are legible in dark mode.
- Zoom buttons are legible in schematic mode (this is the default).
- Hover state is visible in all three themes.
- Pressed/active state on the middle button is visible in all three themes.

- [ ] **Step 4: Run unit tests + build**

```bash
npm test -- --run
npm run build
```

Expected: all pass.

---

## Task 10: e2e test for zoom controls

**Files:**
- Create: `tests-e2e/map-zoom.spec.js`

- [ ] **Step 1: Add the spec**

Create `tests-e2e/map-zoom.spec.js`:

```javascript
import { test, expect } from '@playwright/test';

test.describe('Map zoom controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.removeItem('scorp.map.zoom'); } catch {}
    });
    await page.goto('/#/map');
    await page.waitForLoadState('networkidle');
  });

  test('renders the zoom segmented control with three labelled buttons', async ({ page }) => {
    const group = page.getByRole('group', { name: /map zoom/i });
    await expect(group).toBeVisible();
    await expect(group.getByRole('button', { name: /zoom out/i })).toBeVisible();
    await expect(group.getByRole('button', { name: /zoom in/i })).toBeVisible();
    await expect(group.getByRole('button', { name: /reset zoom/i })).toBeVisible();
  });

  test('clicking + and − changes the percentage label', async ({ page }) => {
    const group = page.getByRole('group', { name: /map zoom/i });
    const reset = group.getByRole('button', { name: /reset zoom/i });

    await expect(reset).toHaveText('100%');
    await group.getByRole('button', { name: /zoom in/i }).click();
    await expect(reset).toHaveText('125%');
    await group.getByRole('button', { name: /zoom out/i }).click();
    await expect(reset).toHaveText('100%');
  });

  test('disables + at the upper bound and − at the lower bound', async ({ page }) => {
    const group = page.getByRole('group', { name: /map zoom/i });
    const zoomIn = group.getByRole('button', { name: /zoom in/i });
    const zoomOut = group.getByRole('button', { name: /zoom out/i });

    // Step from 100% to 200% (four steps of 25%).
    for (let i = 0; i < 4; i++) await zoomIn.click();
    await expect(group.getByRole('button', { name: /reset zoom/i })).toHaveText('200%');
    await expect(zoomIn).toBeDisabled();

    // Reset to 100% then step down to 75% (one step of 25%).
    await group.getByRole('button', { name: /reset zoom/i }).click();
    await zoomOut.click();
    await expect(group.getByRole('button', { name: /reset zoom/i })).toHaveText('75%');
    await expect(zoomOut).toBeDisabled();
  });

  test('persists zoom across reload', async ({ page }) => {
    const group = page.getByRole('group', { name: /map zoom/i });
    await group.getByRole('button', { name: /zoom in/i }).click();
    await expect(group.getByRole('button', { name: /reset zoom/i })).toHaveText('125%');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('group', { name: /map zoom/i })
      .getByRole('button', { name: /reset zoom/i })).toHaveText('125%');
  });

  test('keyboard shortcut + zooms when canvas has focus', async ({ page }) => {
    await page.locator('canvas[role="application"]').focus();
    await page.keyboard.press('=');
    const reset = page.getByRole('group', { name: /map zoom/i })
      .getByRole('button', { name: /reset zoom/i });
    await expect(reset).toHaveText('125%');
    await page.keyboard.press('0');
    await expect(reset).toHaveText('100%');
  });
});
```

- [ ] **Step 2: Run the e2e**

```bash
npx playwright test tests-e2e/map-zoom.spec.js
```

(If Playwright browsers haven't been installed in the worktree, run `npx playwright install` first.)

Expected: all five tests pass. If a test times out waiting for `localStorage.removeItem`, confirm the dev server has `public/data/*.json` available — Playwright config likely points at `npm run preview` or `npm run dev`.

- [ ] **Step 3: Run the existing a11y suite to confirm no regression**

```bash
npx playwright test tests-e2e/a11y.spec.js
```

Expected: still passes (zoom buttons have `aria-label`s, so they shouldn't introduce contrast or label issues).

---

## Task 11: Update CLAUDE.md gotcha list

**Files:**
- Modify: `CLAUDE.md` (project-level, in the worktree)

- [ ] **Step 1: Add a new gotcha entry**

Open `CLAUDE.md`. Find the "Common gotchas" numbered list. Add a new entry at the end (numbered as the next index — currently 17, will be 18):

```markdown
18. **Map drawing coords are anchored at `BASE_TILE = 16`; rendered size is decoupled.** `MapCanvas.svelte` is fit-to-width with a user-controlled zoom multiplier. The canvas always *draws* at BASE_TILE coordinates and applies `ctx.setTransform(displayScale * dpr, …)` once per draw to handle both scaling and DPR. The SVG `viewBox` likewise stays in BASE_TILE units, so all literal SVG coords (`width="10"`, `font-size="6"`, `r="2.5"`, etc.) keep working at any rendered size. Two-layer wrapper: `.map-viewport` (outer, has `bind:clientWidth` and `overflow:auto`) wraps `.map-content` (inner, sized to `displayedCssPx`). When you change the drawing pipeline, **never reach for the displayed pixel size from drawing code** — write at BASE_TILE coords and let the transform handle the rest. Zoom state lives in `Map.svelte` as a single source of truth, persisted to `localStorage['scorp.map.zoom']`; `MapCanvas` is display-only and dispatches `zoomstep` events for keyboard input.
```

(Adjust the leading number if more entries land on `main` before this merges.)

- [ ] **Step 2: Verify the file still parses cleanly**

Open the file in any markdown viewer (or just read it back) and confirm no formatting got mangled.

---

## Task 12: Manual verification pass

**Files:** none.

Run through the spec's testing checklist one last time before stopping for review.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify each item in the spec's testing list**

- [ ] Map fills column at default zoom on a wide window (resize browser to ≥1400px wide).
- [ ] Zoom in twice (to 150%) → map overflows column → internal scroll appears, sidebar still visible at 300px on the right.
- [ ] Zoom out twice (to 50% — wait, that's below ZOOM_MIN; verify the button disables at 75% and the floor is real).
- [ ] Disable persistence (private window) → zoom controls still work, just don't survive reload.
- [ ] Hit-testing: hover at corner tiles `(0,0)`, `(39,0)`, `(0,39)`, `(39,39)` after zoom change → inspector card matches.
- [ ] Hi-DPI: pixels look sharp at 100% and 200% zoom on a 200%-scaled display (or at OS-level 200% display scaling).
- [ ] All three themes (`light`, `dark`, `schematic`) render the zoom control legibly.
- [ ] Keyboard `+`/`-`/`0` work when canvas focused; same shortcuts work when viewport focused.
- [ ] `Ctrl++` / `Cmd++` still trigger browser zoom (our handler defers to it).

- [ ] **Step 3: Run the full suite one more time**

```bash
npm test -- --run
npx playwright test
```

Expected: all pass.

---

## Task 13: Stop and ask the user how to commit

**Files:** none.

- [ ] **Step 1: Print a summary**

Output to the user:

> All tasks complete. Modified:
> - `src/lib/map-zoom.js` (new)
> - `src/lib/map-zoom.test.js` (new)
> - `src/lib/components/MapCanvas.svelte`
> - `src/routes/Map.svelte`
> - `src/styles/global.css`
> - `tests-e2e/map-zoom.spec.js` (new)
> - `CLAUDE.md`
> - `docs/superpowers/specs/2026-05-07-resizable-map-design.md` (new)
> - `docs/superpowers/plans/2026-05-08-resizable-map.md` (new)
>
> Commits deferred per your preference. How do you want to structure the final commit(s)?
> Options:
> - One commit covering everything
> - Two commits: docs (spec + plan) + feature (code + tests + CLAUDE.md gotcha)
> - Three commits: docs / pure helpers + tests / canvas refactor + UI

- [ ] **Step 2: Wait for user direction**

Do NOT commit anything until the user picks a strategy.
