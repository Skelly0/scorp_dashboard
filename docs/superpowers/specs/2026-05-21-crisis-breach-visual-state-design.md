# Crisis Breach Visual State — Design

**Date:** 2026-05-21
**Status:** Approved for planning
**Scope:** Frontend only. No backend, extractor, schema, or `schema_version` change.

## Problem

`status.crisis_factor` is a colony-wide load value that can exceed `1.0`. Today it renders as a flat percentage in the Status "Crisis Pressure" KPI (e.g. `137%`) with the number toned red above `0.66` — but nothing distinguishes the moment the colony *tips past full saturation*. Crossing `1.0` is the dramatic "the dam breaks" beat and the dashboard should make it unmissable, everywhere.

## Goal

When `crisis_factor > 1.0`, the **entire dashboard** enters a breach state:

1. A **marching hazard frame** circulates the full viewport perimeter on every page.
2. A **hazard banner** ("⚠ CRISIS THRESHOLD BREACHED") sits at the top of the content area on every page, with marching chevron strips.
3. A red **vignette + scanline** atmosphere breathes at the screen edges, its intensity scaling with how far over `1.0` the colony is.
4. The Status **Crisis Pressure KPI** gains an `OVER 1.0` tag and a **capacity/surplus gauge**: solid fill to the `1.0` tick, hatched surplus beyond.
5. The **browser tab** signals the alarm: title becomes `⚠ CRISIS · <page> · SCORP Colony` and the favicon swaps to a red-alert variant.

Below `1.0`, none of this shows — the colony hasn't tipped. The Crisis number can still be red (high load) without the breach treatment. The threshold is strict: exactly `1.0` is *not* breached ("over 1").

## Non-goals (explicitly cut)

- Tiered escalation (named "CRITICAL" stage beyond ~1.25). The intensity ramp is continuous instead.
- Smooth slide/fade entry transition.
- "Breached since Year N" timestamp in the banner.
- The earlier mockup's spillover *effects list* (Stability −x / situations escalating) — gauge only.
- Audio/klaxon sound.

## Breach math (single source of truth)

Given `cf = status.crisis_factor` (`number | null`):

- `breached = cf != null && cf > 1.0`
- `surplus = breached ? cf - 1.0 : 0`
- `intensity = clamp(0.35 + surplus * 1.3, 0, 1)` — surplus `0 → 0.35`, surplus `≥0.5 → 1.0`. Drives the atmosphere opacity.

The gauge maps values onto a `0 … 1.5` axis (so the `1.0` tick sits at `66.667%`):
- solid fill width = `min(cf, 1.0) / 1.5`
- surplus segment left = `66.667%`, width = `surplus / 1.5`

## Architecture

`crisis_factor` lives in `status.json`, but the breach treatment is global, so the value must be available app-wide rather than only on the Status route.

### New store: `src/lib/stores/crisis.js`

- `crisisFactor` — `writable<number | null>` (starts `null`).
- `loadCrisis(syncedAt)` — fetches `status.json?v=<syncedAt>` via the shared `fetchPage()` helper (honours the 404/`text/html` → `null` fallback per existing convention) and sets `crisisFactor` to the file's `crisis_factor`. Best-effort: failure leaves `null` (no breach), never throws.
- `crisisBreach` — `derived(crisisFactor, …)` returning `{ factor, breached, surplus, intensity }` using the math above.

This is a slim, independent fetch of `status.json` (the Status route still loads it through its own store; the duplicate cache-busted fetch is acceptable and keeps the global path decoupled from route stores).

### `src/App.svelte` changes

- In `onMount`, after `loadMeta()`, call `loadCrisis(data.synced_at)` alongside `loadCatalog(...)`.
- Inside the existing `z-10` content wrapper, render `<CrisisBanner />` immediately after `<NavBar />` and before `<Router />` — in-flow, so it pushes page content down on every route and never overlaps.
- After the `z-10` wrapper, render `<CrisisFrame />` — a `position:fixed` overlay (edges + vignette + scanlines) with `pointer-events:none` and `aria-hidden="true"`, at a z-index above content (e.g. `z-20`) so the frame draws over everything but never blocks clicks (NavBar stays usable).
- Both components subscribe to `crisisBreach` and render nothing when `!breached`.

### New component: `src/lib/components/CrisisFrame.svelte`

Fixed, full-viewport, `aria-hidden`, `pointer-events:none`. Contains:
- four `.crisis-edge` strips (top/right/bottom/left) forming the marching perimeter;
- a `.crisis-vignette` (breathing radial gradient) and `.crisis-scan` (scanlines).
- Sets an inline `--crisis-intensity` custom property from `$crisisBreach.intensity`; CSS uses it to scale the vignette alpha (capped — see Accessibility).

**Marching circulation (clockwise):** each edge is a `repeating-linear-gradient` whose pattern period along its axis is exactly the animated shift distance, so the loop is seamless. Top flows right (`+x`), right flows down (`+y`), bottom flows left (`−x`), left flows up (`−y`).

### New component: `src/lib/components/CrisisBanner.svelte`

In-flow alarm bar shown when breached. Contains the marching chevron strips (top + bottom, opposite directions), a blinking `⚠`, the text "Crisis Threshold Breached", and a sub-label `Load <cf.toFixed(2)> · capacity exceeded`.

**Seamless chevron fix (learned in mockup):** a 45° `repeating-linear-gradient` does *not* repeat horizontally at its stop period, so shifting by the stop period jumps on loop. Instead the chevron uses a non-repeating `linear-gradient` with an explicit `background-size: 24px 24px` and the animation shifts `background-position` by exactly one tile (`24px`), which loops perfectly.

The banner conveys state as real text (screen-reader accessible); the decorative frame/vignette are `aria-hidden`. The banner is marked `role="status"` so it is announced politely without interrupting on every route change.

### New component: `src/lib/components/CrisisGauge.svelte`

The capacity/surplus bar for the Status Crisis KPI: a track with a solid fill to `min(cf,1)`, a hatched `.surplus` segment past the `1.0` tick, the `1.0` tick mark, and a caption (`capacity 1.00 · surplus +<surplus>`). Takes `factor` as a prop.

### `src/lib/components/KpiBlock.svelte` change

Add a single optional default `<slot />` rendered at the end of the block (after `.kpi-foot`). Empty for all existing call sites (backward compatible). The block root is already `position:relative`, so slotted absolutely-positioned content (the `OVER 1.0` tag) anchors correctly.

### `src/routes/Status.svelte` change

For the Crisis Pressure `KpiBlock` only, when `$crisisBreach.breached`, pass slot content: the `OVER 1.0` tag (absolutely positioned) and `<CrisisGauge factor={$status.crisis_factor} />`. The existing percent value, tone, and sparkline are unchanged. `formatStatusPercent` still returns the uncapped percent (e.g. `137%`).

### Tab title + favicon alert — `src/lib/page-title.js` change

Extend the module with a `crisisAlert` writable (`boolean`). The document-title subscription combines both stores:

```
document.title = `${alert ? '⚠ CRISIS · ' : ''}${title} · SCORP Colony`;
```

The same subscription swaps the favicon: locate `link[rel="icon"]` and set its `href` to `favicon-alert.svg` when `alert`, restoring `favicon.svg` otherwise (relative paths, consistent with Vite `base: './'`). `App.svelte` sets `crisisAlert` from `crisisBreach.breached` via a reactive subscription.

### New asset: `public/favicon-alert.svg`

A red-tinted variant of the existing schematic moon favicon (`public/favicon.svg`) — same wireframe-moon mark, crit-red lines. Hand-authored alongside the existing favicon.

### Styling — `src/styles/global.css`

New design-vocabulary classes (per the "CSS classes, not Tailwind utilities" convention): `.crisis-frame`, `.crisis-edge` (+ `.top/.right/.bottom/.left`), `.crisis-vignette`, `.crisis-scan`, `.crisis-banner` (+ `.hz` chevron, `.sig`, `.htxt`, `.hsub`), `.crisis-gauge` (+ `.solid/.surplus/.tick/.cap/.sp`), `.crisis-over-tag`. All colours come from existing theme tokens (`--crit`, `--crit-soft`, `--fg`, `--bg-2`, `--muted`) which every theme already defines, so the treatment is theme-reactive with no JS token resolution (it is pure CSS, so the canvas `getComputedStyle` gotcha does not apply).

## Accessibility

- **`prefers-reduced-motion: reduce`** — a media block disables *all* breach animation (edge march, vignette breathe, chevron march, `⚠` blink, banner pulse). The static red frame, banner, and a fixed modest vignette still render, preserving the signal without motion. This is required: the build's Playwright + axe job gates merges.
- **Legibility cap** — the vignette only darkens screen edges (centre stays transparent), and its strongest alpha is capped (~`0.45`) regardless of `intensity`, so page content remains readable at any `crisis_factor`.
- **Decorative vs semantic** — frame/vignette/scan are `aria-hidden`; the banner carries the textual state (`role="status"`).
- **Flash safety** — blink/pulse cadences stay ~1 Hz (well under the 3 Hz seizure threshold).
- **No layout shift on mobile** — frame is `fixed` + `pointer-events:none`; banner is in-flow. `tests-e2e` must keep `documentElement.scrollWidth <= innerWidth + 1` true while breached.

## Testing

- **Unit** — `src/lib/stores/crisis.test.js`: `crisisBreach` derivation across `cf = null, 0.84, 1.0, 1.18, 1.42` (breached flag, surplus, intensity, clamp ceiling).
- **Component** — `CrisisGauge` fill/surplus widths and caption; `CrisisBanner` shows only when breached and exposes `role="status"`; `KpiBlock` renders slot content and stays unchanged when slot empty.
- **e2e (`tests-e2e/crisis-breach.spec.js`)** — mock `status.json` with `crisis_factor` > 1.0: assert the frame, banner, OVER tag, and gauge render and that the tab title gains the `⚠ CRISIS` prefix; flip to `< 1.0` and assert all of it disappears; assert no horizontal scroll at mobile width; run axe with breach active (must pass). Add a reduced-motion variant asserting the static path renders.

## Files

**Add:** `src/lib/stores/crisis.js`, `src/lib/components/CrisisFrame.svelte`, `src/lib/components/CrisisBanner.svelte`, `src/lib/components/CrisisGauge.svelte`, `public/favicon-alert.svg`, `src/lib/stores/crisis.test.js`, component tests, `tests-e2e/crisis-breach.spec.js`.

**Edit:** `src/App.svelte`, `src/routes/Status.svelte`, `src/lib/components/KpiBlock.svelte`, `src/lib/page-title.js`, `src/styles/global.css`, `CLAUDE.md` (new convention/gotcha entries: global crisis store + overlay, seamless-march technique, reduced-motion requirement, frontend-only no-schema note).
