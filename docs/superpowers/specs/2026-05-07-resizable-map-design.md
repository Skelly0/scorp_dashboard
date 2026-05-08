# Resizable Map — Design

**Status:** Draft
**Date:** 2026-05-07
**Scope:** Frontend only. No backend, sync, or schema changes.

## Problem

The Map page renders a fixed `40 × 40 × 16px = 640 × 640px` canvas. On a 1600px-wide layout that places the canvas inside a `grid-cols-[1fr_300px]` row, the map column has roughly `1280px` of horizontal space but the map only consumes `640px`, leaving a large empty band on the right side of the map. There is no way for the user to make the map bigger or smaller.

## Goal

Let the map fill the available column width by default, with a user-controlled zoom multiplier for going larger or smaller, while preserving render sharpness, hit-testing accuracy, overlay legibility, and existing keyboard / focus behaviour.

## Non-goals

- Pan / drag-scroll the map with the mouse (out of scope; native scroll is sufficient).
- Resize via drag handle on the map's edge.
- Changing tile coordinate space, hit-testing math, or overlay glyph layout.
- Backend / sync / schema changes.

## Decisions (settled)

1. **Resize style:** fit-to-width by default plus a discrete zoom control. Not drag-resize; not preset S/M/L/XL.
2. **Overflow:** when zoom takes the rendered map past the column width, the map box scrolls internally. Sidebar always remains visible at its 300px width.
3. **Coord-space stability:** the SVG `viewBox` and the canvas's *internal drawing coordinates* stay anchored at a fixed `BASE_TILE = 16` units per tile. CSS scales the wrapper. All existing literal SVG coordinates (`width="10"`, `font-size="6"`, `r="2.5"`, etc.) keep working unchanged.
4. **Canvas sharpness:** canvas backing store is sized to `displayedCssPx × devicePixelRatio`, with `ctx.scale(displayScale × dpr)` applied once at the start of each draw. Fixes a pre-existing softness on Hi-DPI displays as a side effect.
5. **Zoom range:** `0.75×` to `2×` of fit-to-width. `1.0×` is the neutral default. Range chosen to cover real use cases without producing a giant scrolling pit at the top end.
6. **Persistence:** zoom multiplier persists in `localStorage['scorp.map.zoom']`. Both read and write are wrapped in `try/catch` so that privacy-mode browsers (where storage access throws) degrade gracefully. Out-of-range stored values clamp on read.
7. **Controls:** a small `−` `1×` `+` segmented control rendered alongside the existing `.layer-tabs` row at the top of the map. Right-aligned within the same band so it does not introduce a new row.
8. **Keyboard shortcuts:** `+` / `-` / `0` while the canvas has focus, gated on `!e.ctrlKey && !e.metaKey` so they never fight browser zoom. Enter/Space/Arrow keys keep their existing behaviour.

## Architecture

### Components

- `src/lib/components/MapCanvas.svelte` — owns the viewport-width measurement (via `bind:clientWidth`) and the actual scaling pipeline. Derives `displayScale` from a `zoom` prop and the measured viewport width. Re-renders the canvas at the proper backing-store resolution whenever inputs change.
- `src/routes/Map.svelte` — owns the `zoom` value (state + localStorage round-trip) and renders the zoom control next to the layer tabs. Passes `zoom` into `MapCanvas`.
- `src/styles/global.css` — adds the `.s-zoom` segmented control styles, rendered as a sibling group inside the same row as `.layer-tabs`. The `s-` prefix matches the project naming convention (CLAUDE.md #12) and avoids any Tailwind utility collision.

### Data flow

```
User clicks +/−             →  Map.svelte updates `zoom` (+writes localStorage)
                                 │
                                 ▼
Map.svelte                  →   <MapCanvas zoom={zoom} ... />
                                 │
bind:clientWidth on the     →   viewportClientWidth (synchronous, no flicker)
viewport element                 │
                                 ▼
                                fitScale  = viewportClientWidth / (mapData.width * BASE_TILE)
                                displayScale = clamp(fitScale * zoom, ...)
                                 │
                                 ▼
                                Canvas: backing store = displayedCssPx × dpr
                                        ctx.scale(displayScale × dpr) once per draw
                                        draw at BASE_TILE coordinates
                                 │
                                 ▼
                                SVG: viewBox unchanged (BASE_TILE coord space)
                                     CSS width = 100% (scales to wrapper)
                                 │
                                 ▼
                                Wrapper: width = displayedCssPx (capped at column width
                                                                 → overflow:auto inside box
                                                                 when zoom * fitScale > 1)
```

### Sizing pipeline (concrete)

```
BASE_TILE        = 16                                            // unchanged
nativeMapPx      = mapData.width * BASE_TILE                     // 640 for a 40-wide map
fitScale         = viewportClientWidth / nativeMapPx               // e.g. 1280 / 640 = 2.0
displayScale     = clamp(fitScale * zoom, MIN_SCALE, MAX_SCALE)   // see range below
displayedCssPx   = nativeMapPx * displayScale
backingStorePx   = displayedCssPx * window.devicePixelRatio
```

`MIN_SCALE` / `MAX_SCALE` derived from zoom range:

- `zoomMin = 0.75`, `zoomMax = 2.0`
- effective `displayScale` is clamped to `[fitScale * zoomMin, fitScale * zoomMax]`
- additionally, for narrow wrappers (mobile / very small windows), enforce a hard floor of `displayScale ≥ 0.25` so the map never collapses to a thumbnail

When `displayScale > fitScale` (i.e. zoomed in past the column width), the wrapper's CSS `max-width` clips the visible area to the column width while the inner content grows to `displayedCssPx`, producing internal overflow scrolling.

### Wrapper structure

Current (in `MapCanvas.svelte`):
```html
<div class="relative inline-block border-4 border-border"
     style="width: {width}px; height: {height}px;">
  <canvas .../>
  <svg .../>
</div>
```

After (two-layer: outer scroll viewport, inner content at full rendered size):
```html
<div class="map-viewport relative border-4 border-border"
     bind:clientWidth={viewportClientWidth}>
  <div class="map-content"
       style="width: {mapData.width * BASE_TILE * displayScale}px;
              height: {mapData.height * BASE_TILE * displayScale}px;">
    <canvas class="block w-full h-full ..." .../>
    <svg viewBox={viewBox} class="absolute inset-0 w-full h-full" .../>
  </div>
</div>
```

CSS:
```css
.map-viewport {
  width: 100%;
  max-width: 100%;        /* never overshoot the grid column */
  overflow: auto;          /* scrolls when content exceeds viewport */
}
/* .map-content is inline-styled to the rendered pixel size */
```

The viewport always fills the grid column; its width is what `bind:clientWidth` measures. The inner `.map-content` is sized to the actual rendered pixel dimensions: at fit-to-width zoom that equals the viewport width (no scroll), and at higher zoom it exceeds the viewport (overflow scrolls inside the box). The canvas and SVG fill the content layer at `width:100%; height:100%`. The viewBox stays in BASE_TILE coordinates so SVG literals remain correct under any scale.

`.map-content`'s width and height are derived independently from `mapData.width` and `mapData.height` — no aspect-ratio coupling — so non-square maps (e.g. `40 × 30`) work naturally if the data ever ships them.

### Reactive declarations

Inside `MapCanvas.svelte`:

- `$: fitScale = viewportClientWidth ? viewportClientWidth / (mapData.width * BASE_TILE) : 1`
- `$: displayScale = clamp(fitScale * zoom, fitScale * 0.75, fitScale * 2.0)`
- `$: displayedCssPx = mapData.width * BASE_TILE * displayScale`
- `$: drawTerrain(mapData, layer, layerMax, filters, displayScale)` — `displayScale` added to the dep list so the canvas redraws on zoom change. Mirrors the structural concern in CLAUDE.md gotcha #14 (canvas needs explicit dep on values that affect output).

`drawTerrain` itself:

```
1. set canvas.width  = displayedCssPx * dpr
2. set canvas.height = displayedCssPx * (mapHeight / mapWidth) * dpr
3. set canvas.style.width  = '100%'
4. set canvas.style.height = '100%'
5. ctx.setTransform(displayScale * dpr, 0, 0, displayScale * dpr, 0, 0)
6. ctx.clearRect(0, 0, mapData.width * BASE_TILE, mapData.height * BASE_TILE)
7. for each tile: ctx.fillRect(t.x * BASE_TILE, t.y * BASE_TILE, BASE_TILE, BASE_TILE)
```

This means the **drawing code never has to know about `displayScale`**. It always draws at BASE_TILE coordinates. The transform handles scaling and DPR.

### Hit-testing

`handleMove` already uses `(e.clientX - rect.left) / rect.width * mapData.width`, which is resolution-agnostic — it uses the measured rect, not `TILE_SIZE`. No change required. Click and arrow-key handlers inherit from the same code path. Verified by reading the existing implementation.

### Persistence

In `Map.svelte`:

```
const ZOOM_KEY = 'scorp.map.zoom'
const ZOOM_MIN = 0.75
const ZOOM_MAX = 2.0
const ZOOM_DEFAULT = 1.0

function readZoom() {
  try {
    const raw = localStorage.getItem(ZOOM_KEY)
    if (raw == null) return ZOOM_DEFAULT
    const v = Number.parseFloat(raw)
    if (!Number.isFinite(v)) return ZOOM_DEFAULT
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v))
  } catch { return ZOOM_DEFAULT }
}

function writeZoom(v) {
  try { localStorage.setItem(ZOOM_KEY, String(v)) } catch { /* swallow */ }
}
```

`zoom` state is initialised in `onMount` (not at module top level) so the localStorage read happens after hydration, avoiding any SSR-shaped surprises even though this app is purely client-side today.

### Controls

Markup (sketched, names may shift slightly during implementation):

```html
<div class="layer-tabs">
  {#each LAYERS as l}
    <button aria-pressed={layer === l.value} on:click={() => (layer = l.value)}>...</button>
  {/each}
  <span class="layer-tabs__zoom" role="group" aria-label="Map zoom">
    <button on:click={zoomOut} aria-label="Zoom out"   disabled={zoom <= ZOOM_MIN}>−</button>
    <button on:click={zoomReset} aria-label="Reset zoom" aria-pressed={zoom === ZOOM_DEFAULT}>{Math.round(zoom * 100)}%</button>
    <button on:click={zoomIn}  aria-label="Zoom in"    disabled={zoom >= ZOOM_MAX}>+</button>
  </span>
</div>
```

The middle button doubles as a percentage display and a click-to-reset target. Step size: `0.25` (so the discrete steps inside `0.75 … 2.0` are `0.75, 1.0, 1.25, 1.5, 1.75, 2.0` — six positions). Buttons disable at the endpoints.

### Keyboard

Existing `handleKey` in `MapCanvas.svelte` handles arrows + Enter/Space. Extend it:

```
if (e.key === '+' || e.key === '=') { dispatch('zoomstep', { delta: +1 }) }
else if (e.key === '-') { dispatch('zoomstep', { delta: -1 }) }
else if (e.key === '0') { dispatch('zoomstep', { reset: true }) }
```

All gated on `!e.ctrlKey && !e.metaKey`. Listening surface: keys fire when *either* the canvas has focus (existing behaviour) *or* the `.map-viewport` does, since on heavy zoom the canvas may be partly outside the visible viewport — the viewport gets `tabindex="0"` so it can receive focus too, with the `handleKey` listener bound there.

### Zoom event contract

`MapCanvas.svelte` is *display-only* with respect to zoom. It accepts a `zoom: number` prop and dispatches `zoomstep` events; it never owns the zoom state itself. `Map.svelte` is the single source of truth: it holds the `zoom` value, listens to `on:zoomstep`, and decides how to apply each step (clamping to `[ZOOM_MIN, ZOOM_MAX]`, snapping to the 0.25 step grid, persisting to localStorage). The on-screen `−` `n%` `+` buttons in `Map.svelte` invoke the same step logic directly without going through the dispatcher. This keeps the rule "Map.svelte owns zoom; MapCanvas observes" intact regardless of input source.

Event payload:
- `zoomstep`: `{ delta?: -1 | +1, reset?: boolean }` — exactly one of `delta` / `reset` is set per dispatch.

## Edge cases

- **Initial paint flicker.** First render runs before `clientWidth` is observed. Mitigation: `bind:clientWidth` updates synchronously after layout in Svelte, so the first reactive pass after mount already has a real value. Belt-and-braces fallback: when `viewportClientWidth` is falsy (initial tick), `fitScale = 1` and the canvas draws at native size; the next reactive pass corrects it before the user can perceive the difference.
- **Window resize while zoom > fit threshold.** `fitScale` recomputes; `displayScale = fitScale * zoom` updates; canvas re-rasterises; scroll position may jump. Acceptable trade-off; not worth complicating with scroll-anchor logic.
- **Tab switch back to Map page.** Component unmount/mount cycle re-reads localStorage; state is restored.
- **localStorage unavailable.** Reads return default; writes silently fail. Map still works, just doesn't persist.
- **Hi-DPI display change** (e.g. external monitor unplugged). `devicePixelRatio` change is not currently observed. Out of scope; existing behaviour is the same. Could be added later via `matchMedia('(resolution: ...)')` if it ever matters.
- **Theme flip while zoomed.** CLAUDE.md gotcha #14 documents that the canvas does not redraw on theme change today. Adding `displayScale` to the dep list of `drawTerrain` does not fix that pre-existing behaviour, and resolving it is explicitly out of scope for this work. Stale colours after a theme swap will still clear on the next data/layer/zoom change. If we want to fix it, that's a separate ticket — a one-line `document` listener watching `[data-theme]` mutations.
- **Tile-level focus ring.** The existing focus rectangle uses BASE_TILE coordinates inside the SVG, so it scales naturally with the wrapper. No changes needed.
- **Filter ring stroke width.** SVG `stroke-width="2"` looks thinner when the SVG is scaled up, which is the expected behaviour for vector graphics. If this becomes a legibility issue at low zoom, a follow-up can adjust stroke widths to compensate; not addressing pre-emptively.

## Testing

- **Existing e2e a11y tests** (`tests-e2e/a11y.spec.js`) target buttons + contrast. Adding labelled zoom buttons should keep them passing. Verify locally before merge.
- **New manual / Playwright checks** during implementation:
  - Map fills column at default zoom on a wide window.
  - Zoom in twice → map overflows column → internal scroll appears, sidebar still visible.
  - Zoom out twice → map shrinks within column, no scroll, no layout jump in sidebar.
  - Disable persistence (private window) → zoom controls still work, just don't survive reload.
  - Hit-testing: hover at a known tile after zoom change → tooltip / pinned card matches the visible tile.
  - Hi-DPI: pixels look sharp at 1× and at 2× zoom on a 200% scaled display.
- **Pre-existing test failures** (CLAUDE.md gotcha #10) should not be touched. Frontend-only changes don't affect the failing pytest suite for fixtures.

## Files touched

- `src/lib/components/MapCanvas.svelte` — two-layer wrapper structure, viewport `bind:clientWidth`, canvas DPR + scale transform, redraw trigger, keyboard shortcut additions, `zoomstep` event dispatch.
- `src/routes/Map.svelte` — zoom state, localStorage round-trip, zoom control markup.
- `src/styles/global.css` — `.s-zoom` segmented control block plus a `.map-viewport` / `.map-content` rule pair.
- `CLAUDE.md` — add a gotcha entry about the BASE_TILE / displayScale separation, since this becomes the new contract for any future map work.

## Out of scope (deferred)

- Pinch-to-zoom / mouse-wheel-zoom (touch and trackpad gestures).
- Drag-to-pan inside the scrollable area.
- Per-page persistence beyond localStorage (URL params, server sync).
- Changing the sidebar layout or making it collapsible.
- Animating zoom transitions.
- Configurable zoom step size or extending the zoom range past `[0.75, 2.0]`.
