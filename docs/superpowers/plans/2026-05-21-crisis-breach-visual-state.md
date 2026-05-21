# Crisis Breach Visual State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When colony-wide `status.crisis_factor` exceeds `1.0`, put the whole dashboard into a hazard "breach" state — a marching perimeter frame and red atmosphere on every page, a hazard banner, an overflow/surplus gauge on the Status Crisis KPI, and a tab-title + favicon alert.

**Architecture:** Pure breach math in `src/lib/crisis-breach.js`; a `crisisBreach` store *derived from the existing shared `status` store* (App.svelte calls the existing `loadStatus` once globally so the value is available on every route — no new fetch). Three small Svelte components (`CrisisFrame` fixed overlay, `CrisisBanner` in-flow alarm, `CrisisGauge` capacity/surplus bar) gate on that store. `page-title.js` gains a `crisisAlert` store driving the tab title + favicon. All visuals are pure CSS using existing theme tokens, with a `prefers-reduced-motion` static fallback.

**Tech Stack:** Svelte 4, svelte-spa-router, Vite, Vitest + @testing-library/svelte (jsdom), Playwright + @axe-core/playwright.

**Spec:** `docs/superpowers/specs/2026-05-21-crisis-breach-visual-state-design.md`

**Delta from spec:** The spec described a slim independent `loadCrisis` fetch of `status.json`. This plan instead reuses the existing `status` store (`src/lib/stores/status.js`) and adds a single global `loadStatus` call in `App.svelte`, deriving `crisisBreach` from it. Same behaviour, zero duplicate fetch.

**Commit policy (user preference):** Do NOT commit per task. Implement and verify each task, leaving changes in the working tree. The final task runs full verification and then asks how to structure the commit(s). Current branch is `crisis-over-one` (already created off `main`).

---

## File structure

**Create:**
- `src/lib/crisis-breach.js` — pure breach math + gauge geometry (no Svelte, no DOM).
- `src/lib/crisis-breach.test.js` — unit tests for the pure math.
- `src/lib/stores/crisis.js` — `crisisBreach` derived store.
- `src/lib/stores/crisis.test.js` — derived-store tests.
- `src/lib/components/CrisisGauge.svelte` — capacity/surplus bar.
- `src/lib/components/CrisisGauge.test.js`
- `src/lib/components/CrisisBanner.svelte` — in-flow hazard banner.
- `src/lib/components/CrisisBanner.test.js`
- `src/lib/components/CrisisFrame.svelte` — fixed perimeter + atmosphere overlay.
- `src/lib/components/CrisisFrame.test.js`
- `public/favicon-alert.svg` — red-alert favicon variant.
- `tests-e2e/crisis-breach.spec.js` — Playwright + axe coverage.

**Modify:**
- `src/lib/page-title.js` — add `crisisAlert`, title prefix, favicon swap.
- `src/lib/page-title.test.js` — new test file for the above (create).
- `src/lib/components/KpiBlock.svelte` — add one optional `<slot />`.
- `src/routes/Status.svelte` — OVER tag + `CrisisGauge` in the Crisis Pressure KPI when breached.
- `src/App.svelte` — global `loadStatus`, mount `CrisisBanner` + `CrisisFrame`, drive `crisisAlert`.
- `src/styles/global.css` — `.crisis-*` classes + reduced-motion block.
- `CLAUDE.md` — new convention/gotcha entries.

---

## Task 1: Pure breach math + gauge geometry

**Files:**
- Create: `src/lib/crisis-breach.js`
- Test: `src/lib/crisis-breach.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/crisis-breach.test.js`:

```js
import { describe, expect, test } from 'vitest';
import { computeCrisisBreach, crisisGaugeGeometry, CRISIS_GAUGE_MAX } from './crisis-breach.js';

describe('computeCrisisBreach', () => {
  test('null factor is not breached', () => {
    expect(computeCrisisBreach(null)).toEqual({ factor: null, breached: false, surplus: 0, intensity: 0 });
  });

  test('non-finite factor is treated as null', () => {
    expect(computeCrisisBreach(NaN).breached).toBe(false);
    expect(computeCrisisBreach(undefined).factor).toBe(null);
  });

  test('high-but-under-1 load is not breached', () => {
    const r = computeCrisisBreach(0.84);
    expect(r.breached).toBe(false);
    expect(r.surplus).toBe(0);
    expect(r.intensity).toBe(0);
  });

  test('exactly 1.0 is NOT breached (strictly over 1)', () => {
    expect(computeCrisisBreach(1.0).breached).toBe(false);
  });

  test('over 1.0 is breached with surplus and ramped intensity', () => {
    const r = computeCrisisBreach(1.18);
    expect(r.breached).toBe(true);
    expect(r.surplus).toBeCloseTo(0.18, 5);
    expect(r.intensity).toBeCloseTo(0.35 + 0.18 * 1.3, 5);
  });

  test('intensity is capped at 1', () => {
    expect(computeCrisisBreach(2.0).intensity).toBe(1);
  });
});

describe('crisisGaugeGeometry', () => {
  test('1.0 tick sits at 1/1.5 of the track', () => {
    expect(crisisGaugeGeometry(0).tickPct).toBeCloseTo((1 / CRISIS_GAUGE_MAX) * 100, 5);
  });

  test('1.18 fills solid to capacity and shows surplus segment', () => {
    const g = crisisGaugeGeometry(1.18);
    expect(g.solidPct).toBeCloseTo((1 / 1.5) * 100, 5);
    expect(g.surplusPct).toBeCloseTo((0.18 / 1.5) * 100, 5);
    expect(g.surplus).toBeCloseTo(0.18, 5);
  });

  test('under 1.0 fills proportionally with no surplus', () => {
    const g = crisisGaugeGeometry(0.6);
    expect(g.solidPct).toBeCloseTo((0.6 / 1.5) * 100, 5);
    expect(g.surplusPct).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- run src/lib/crisis-breach.test.js`
Expected: FAIL — `Failed to resolve import "./crisis-breach.js"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/crisis-breach.js`:

```js
// Pure colony-wide Crisis breach math. No Svelte, no DOM — unit-testable in isolation.
// Breach is STRICT: crisis_factor must be > 1.0 ("over 1"). Exactly 1.0 is at capacity, not breached.

export const CRISIS_GAUGE_MAX = 1.5; // gauge axis: 0 .. 1.5, so the 1.0 tick sits at 66.667%

function toFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function computeCrisisBreach(factor) {
  const cf = toFinite(factor);
  const breached = cf != null && cf > 1.0;
  const surplus = breached ? cf - 1.0 : 0;
  const intensity = breached ? Math.min(1, Math.max(0, 0.35 + surplus * 1.3)) : 0;
  return { factor: cf, breached, surplus, intensity };
}

export function crisisGaugeGeometry(factor) {
  const cf = toFinite(factor) ?? 0;
  const max = CRISIS_GAUGE_MAX;
  const solidPct = (Math.max(0, Math.min(cf, 1)) / max) * 100;
  const tickPct = (1 / max) * 100;
  const surplus = Math.max(0, cf - 1);
  const surplusPct = (surplus / max) * 100;
  return { solidPct, tickPct, surplusPct, surplus };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- run src/lib/crisis-breach.test.js`
Expected: PASS (all cases).

---

## Task 2: `crisisBreach` derived store

**Files:**
- Create: `src/lib/stores/crisis.js`
- Test: `src/lib/stores/crisis.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/stores/crisis.test.js`:

```js
import { afterEach, describe, expect, test } from 'vitest';
import { get } from 'svelte/store';
import { status } from './status.js';
import { crisisBreach } from './crisis.js';

afterEach(() => status.set(null));

describe('crisisBreach store', () => {
  test('null status is not breached', () => {
    status.set(null);
    expect(get(crisisBreach).breached).toBe(false);
  });

  test('derives breach from status.crisis_factor', () => {
    status.set({ crisis_factor: 1.2 });
    const r = get(crisisBreach);
    expect(r.breached).toBe(true);
    expect(r.surplus).toBeCloseTo(0.2, 5);
  });

  test('under-1 crisis_factor is not breached', () => {
    status.set({ crisis_factor: 0.84 });
    expect(get(crisisBreach).breached).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- run src/lib/stores/crisis.test.js`
Expected: FAIL — cannot resolve `./crisis.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/stores/crisis.js`:

```js
import { derived } from 'svelte/store';
import { status } from './status.js';
import { computeCrisisBreach } from '../crisis-breach.js';

// Colony-wide breach state, available app-wide. Derived from the shared `status` store,
// which App.svelte loads once globally so every route sees it.
export const crisisBreach = derived(status, ($status) =>
  computeCrisisBreach($status?.crisis_factor ?? null),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- run src/lib/stores/crisis.test.js`
Expected: PASS.

---

## Task 3: Tab-title prefix + favicon swap

**Files:**
- Modify: `src/lib/page-title.js`
- Test: `src/lib/page-title.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/page-title.test.js` (build the DOM with safe createElement, not innerHTML):

```js
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { pageTitle, crisisAlert } from './page-title.js';

beforeEach(() => {
  document.head.replaceChildren();
  const link = document.createElement('link');
  link.setAttribute('rel', 'icon');
  link.setAttribute('href', 'http://localhost/favicon.svg');
  document.head.appendChild(link);
  pageTitle.set('Status');
  crisisAlert.set(false);
});
afterEach(() => crisisAlert.set(false));

function iconHref() {
  return document.querySelector('link[rel="icon"]').getAttribute('href');
}

describe('page-title crisis alert', () => {
  test('normal title has no crisis prefix', () => {
    expect(document.title).toBe('Status · SCORP Colony');
  });

  test('crisisAlert prefixes the title and swaps the favicon', () => {
    crisisAlert.set(true);
    expect(document.title.startsWith('⚠ CRISIS · ')).toBe(true);
    expect(iconHref().endsWith('favicon-alert.svg')).toBe(true);
  });

  test('clearing crisisAlert restores title and favicon', () => {
    crisisAlert.set(true);
    crisisAlert.set(false);
    expect(document.title).toBe('Status · SCORP Colony');
    expect(iconHref().endsWith('favicon.svg')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- run src/lib/page-title.test.js`
Expected: FAIL — `crisisAlert` is not exported.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/lib/page-title.js` with:

```js
import { writable, derived } from 'svelte/store';

export const pageTitle = writable('Colony Status');
export const crisisAlert = writable(false);

const FAVICON_NORMAL = 'favicon.svg';
const FAVICON_ALERT = 'favicon-alert.svg';

function apply([title, alert]) {
  document.title = `${alert ? '⚠ CRISIS · ' : ''}${title} · SCORP Colony`;
  const link = document.querySelector('link[rel="icon"]');
  if (link) {
    const next = alert ? FAVICON_ALERT : FAVICON_NORMAL;
    // Swap only the final path segment so the Vite base path (base: './') is preserved.
    link.setAttribute('href', link.getAttribute('href').replace(/[^/]*$/, next));
  }
}

derived([pageTitle, crisisAlert], (vals) => vals).subscribe(apply);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- run src/lib/page-title.test.js`
Expected: PASS.

- [ ] **Step 5: Guard against regressions in dependents**

Run: `npm run test -- run`
Expected: PASS — existing routes import `pageTitle` only; the new export is additive.

---

## Task 4: `CrisisGauge` component

**Files:**
- Create: `src/lib/components/CrisisGauge.svelte`
- Test: `src/lib/components/CrisisGauge.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/CrisisGauge.test.js`:

```js
import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import CrisisGauge from './CrisisGauge.svelte';

describe('CrisisGauge', () => {
  test('renders solid fill, surplus segment, and surplus caption for 1.18', () => {
    const { container } = render(CrisisGauge, { props: { factor: 1.18 } });
    const solid = container.querySelector('.crisis-gauge .solid');
    const surplus = container.querySelector('.crisis-gauge .surplus');
    expect(solid.getAttribute('style')).toContain('width:66.6');
    expect(surplus.getAttribute('style')).toContain('width:12');
    expect(container.querySelector('.crisis-gauge-cap .sp').textContent).toBe('surplus +0.18');
  });

  test('under 1.0 shows no surplus width', () => {
    const { container } = render(CrisisGauge, { props: { factor: 0.6 } });
    expect(container.querySelector('.crisis-gauge .surplus').getAttribute('style')).toContain('width:0%');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- run src/lib/components/CrisisGauge.test.js`
Expected: FAIL — cannot resolve `./CrisisGauge.svelte`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/components/CrisisGauge.svelte`:

```svelte
<script>
  import { crisisGaugeGeometry } from '../crisis-breach.js';
  export let factor;
  $: g = crisisGaugeGeometry(factor);
</script>

<div class="crisis-gauge" aria-hidden="true">
  <div class="solid" style="width:{g.solidPct}%"></div>
  <div class="surplus" style="left:{g.tickPct}%;width:{g.surplusPct}%"></div>
  <div class="tick" style="left:{g.tickPct}%"></div>
</div>
<div class="crisis-gauge-cap">capacity 1.00 · <span class="sp">surplus +{g.surplus.toFixed(2)}</span></div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- run src/lib/components/CrisisGauge.test.js`
Expected: PASS.

---

## Task 5: `CrisisBanner` component

**Files:**
- Create: `src/lib/components/CrisisBanner.svelte`
- Test: `src/lib/components/CrisisBanner.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/CrisisBanner.test.js`:

```js
import { afterEach, describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import { status } from '../stores/status.js';
import CrisisBanner from './CrisisBanner.svelte';

afterEach(() => status.set(null));

describe('CrisisBanner', () => {
  test('renders nothing when not breached', () => {
    status.set({ crisis_factor: 0.84 });
    const { container } = render(CrisisBanner);
    expect(container.querySelector('.crisis-banner')).toBe(null);
  });

  test('renders an announced banner with load when breached', () => {
    status.set({ crisis_factor: 1.18 });
    const { container, getByText } = render(CrisisBanner);
    const banner = container.querySelector('.crisis-banner');
    expect(banner).not.toBe(null);
    expect(banner.getAttribute('role')).toBe('status');
    expect(getByText('Crisis Threshold Breached')).toBeTruthy();
    expect(container.querySelector('.hsub').textContent).toContain('1.18');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- run src/lib/components/CrisisBanner.test.js`
Expected: FAIL — cannot resolve `./CrisisBanner.svelte`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/components/CrisisBanner.svelte`:

```svelte
<script>
  import { crisisBreach } from '../stores/crisis.js';
</script>

{#if $crisisBreach.breached}
  <div class="crisis-banner" role="status">
    <div class="hz t" aria-hidden="true"></div>
    <div class="crisis-banner-mid">
      <span class="sig" aria-hidden="true">⚠</span>
      <span class="htxt">Crisis Threshold Breached</span>
      <span class="hsub">Load {$crisisBreach.factor.toFixed(2)} · capacity exceeded</span>
    </div>
    <div class="hz b" aria-hidden="true"></div>
  </div>
{/if}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- run src/lib/components/CrisisBanner.test.js`
Expected: PASS.

---

## Task 6: `CrisisFrame` component

**Files:**
- Create: `src/lib/components/CrisisFrame.svelte`
- Test: `src/lib/components/CrisisFrame.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/CrisisFrame.test.js`:

```js
import { afterEach, describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import { status } from '../stores/status.js';
import CrisisFrame from './CrisisFrame.svelte';

afterEach(() => status.set(null));

describe('CrisisFrame', () => {
  test('renders nothing when not breached', () => {
    status.set({ crisis_factor: 0.9 });
    const { container } = render(CrisisFrame);
    expect(container.querySelector('.crisis-frame')).toBe(null);
  });

  test('renders four edges and an intensity custom property when breached', () => {
    status.set({ crisis_factor: 1.42 });
    const { container } = render(CrisisFrame);
    const frame = container.querySelector('.crisis-frame');
    expect(frame).not.toBe(null);
    expect(frame.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('.crisis-edge').length).toBe(4);
    expect(frame.getAttribute('style')).toContain('--crisis-intensity:');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- run src/lib/components/CrisisFrame.test.js`
Expected: FAIL — cannot resolve `./CrisisFrame.svelte`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/components/CrisisFrame.svelte`:

```svelte
<script>
  import { crisisBreach } from '../stores/crisis.js';
</script>

{#if $crisisBreach.breached}
  <div class="crisis-frame" aria-hidden="true" style="--crisis-intensity:{$crisisBreach.intensity}">
    <div class="crisis-vignette"></div>
    <div class="crisis-scan"></div>
    <div class="crisis-edge top"></div>
    <div class="crisis-edge right"></div>
    <div class="crisis-edge bottom"></div>
    <div class="crisis-edge left"></div>
  </div>
{/if}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- run src/lib/components/CrisisFrame.test.js`
Expected: PASS.

---

## Task 7: Add optional slot to `KpiBlock`

**Files:**
- Modify: `src/lib/components/KpiBlock.svelte`

- [ ] **Step 1: Confirm the existing KpiBlock test still defines current behaviour**

Run: `npm run test -- run src/lib/components/KpiBlock.test.js`
Expected: PASS (baseline before the change).

- [ ] **Step 2: Add the slot**

In `src/lib/components/KpiBlock.svelte`, the markup currently ends:

```svelte
    {#if history}
      <Sparkline data={history} color={resolvedSparkColor} />
    {/if}
  </div>
</div>
```

Change it to render an optional default slot after the `.kpi-foot` div, still inside the block (the block root is `position:relative`, so absolutely-positioned slot content anchors to it):

```svelte
    {#if history}
      <Sparkline data={history} color={resolvedSparkColor} />
    {/if}
  </div>
  <slot />
</div>
```

- [ ] **Step 3: Verify no regression**

Run: `npm run test -- run src/lib/components/KpiBlock.test.js`
Expected: PASS — the slot is empty for all existing call sites, so output is unchanged. (Slot *content* is covered by the Status integration in the e2e spec, Task 12.)

---

## Task 8: Wire breach treatment into Status

**Files:**
- Modify: `src/routes/Status.svelte`

- [ ] **Step 1: Add imports**

In the `<script>` block of `src/routes/Status.svelte`, add after the existing component imports (e.g. after the `KpiBlock` import):

```js
  import CrisisGauge from '../lib/components/CrisisGauge.svelte';
  import { crisisBreach } from '../lib/stores/crisis.js';
```

- [ ] **Step 2: Fill the Crisis Pressure KPI slot when breached**

The Crisis Pressure block currently is self-closing (around lines 116–121):

```svelte
        <KpiBlock
          label="Crisis Pressure"
          value={formatStatusPercent($status.crisis_factor)}
          tone={statusMetricTone($status.crisis_factor, CRISIS_TONE_OPTIONS)}
          history={$crisisFactorHistory.length >= 2 ? $crisisFactorHistory : null}
        />
```

Replace it with an open/close form that passes slot content only when breached:

```svelte
        <KpiBlock
          label="Crisis Pressure"
          value={formatStatusPercent($status.crisis_factor)}
          tone={statusMetricTone($status.crisis_factor, CRISIS_TONE_OPTIONS)}
          history={$crisisFactorHistory.length >= 2 ? $crisisFactorHistory : null}
        >
          {#if $crisisBreach.breached}
            <span class="crisis-over-tag" aria-hidden="true">OVER 1.0</span>
            <CrisisGauge factor={$status.crisis_factor} />
          {/if}
        </KpiBlock>
```

- [ ] **Step 3: Verify the unit suite still passes**

Run: `npm run test -- run`
Expected: PASS (Status has no unit test asserting the old self-closing form; behaviour is exercised in e2e).

---

## Task 9: Mount global breach layers in App

**Files:**
- Modify: `src/App.svelte`

- [ ] **Step 1: Add imports**

In the `<script>` of `src/App.svelte`, add alongside the existing store/component imports:

```js
  import { loadStatus } from './lib/stores/status.js';
  import { crisisBreach } from './lib/stores/crisis.js';
  import { crisisAlert } from './lib/page-title.js';
  import CrisisBanner from './lib/components/CrisisBanner.svelte';
  import CrisisFrame from './lib/components/CrisisFrame.svelte';
```

- [ ] **Step 2: Load status globally and drive the tab alert**

Change the `onMount` body so the global status load happens after meta loads, and add a reactive line that mirrors breach state into `crisisAlert`:

```js
  onMount(async () => {
    initTheme();
    const data = await loadMeta();
    if (data) {
      // Catalog is fire-and-forget — categorizer regex is the load-time fallback.
      loadCatalog(data.synced_at);
      // Load status once globally so the crisis breach treatment is available on every route.
      loadStatus(data.synced_at);
    }
  });

  // Tab title + favicon alert mirror the colony-wide breach state.
  $: crisisAlert.set($crisisBreach.breached);
```

- [ ] **Step 3: Mount the banner (in-flow) and frame (fixed overlay)**

In the template, the loaded branch currently is:

```svelte
    {:else}
      <NavBar />
      <Router {routes} />
    {/if}
  </div>
</div>
```

Change it to render the banner under the nav (in-flow, on every page) and the frame as a sibling overlay after the content wrapper:

```svelte
    {:else}
      <NavBar />
      <CrisisBanner />
      <Router {routes} />
    {/if}
  </div>
  <CrisisFrame />
</div>
```

`CrisisFrame` renders nothing unless breached and is `position:fixed` + `pointer-events:none`, so it never blocks interaction even though it sits after the `z-10` content wrapper.

- [ ] **Step 4: Verify build compiles**

Run: `npm run build`
Expected: SUCCESS — Vite builds with no Svelte compile errors.

---

## Task 10: Styles + reduced-motion fallback

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Append the crisis breach styles**

Add this block to the end of `src/styles/global.css`. All colours use existing theme tokens (every theme defines `--crit`, `--crit-soft`, `--fg`, `--bg-2`, `--muted`), so the treatment is theme-reactive with no JS.

```css
/* === Crisis breach visual state (crisis_factor > 1.0) ====================== */

/* Hazard banner — in-flow, top of every page when breached */
.crisis-banner {
  border: 2px solid var(--crit);
  background: var(--crit-soft);
  margin-bottom: 18px;
  position: relative;
  overflow: hidden;
  animation: crisis-pulse 1.7s ease-in-out infinite;
}
@keyframes crisis-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--crit) 0%, transparent); }
  50%      { box-shadow: 0 0 0 5px color-mix(in srgb, var(--crit) 22%, transparent); }
}
/* Tiled chevron: explicit background-size + one-tile shift => seamless march (no jump) */
.crisis-banner .hz {
  height: 10px;
  background-image: linear-gradient(45deg,
    var(--crit) 25%, transparent 25%, transparent 50%,
    var(--crit) 50%, var(--crit) 75%, transparent 75%);
  background-size: 24px 24px;
}
.crisis-banner .hz.t { animation: crisis-march 0.9s linear infinite; }
.crisis-banner .hz.b { animation: crisis-march-rev 0.9s linear infinite; }
@keyframes crisis-march     { to { background-position: 24px 0; } }
@keyframes crisis-march-rev { to { background-position: -24px 0; } }
.crisis-banner-mid { display: flex; align-items: center; gap: 14px; padding: 11px 16px; }
.crisis-banner .sig { font-size: 22px; color: var(--crit); animation: crisis-blink 1.05s steps(1) infinite; }
@keyframes crisis-blink { 50% { opacity: 0.2; } }
.crisis-banner .htxt {
  font-size: 13px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--crit);
}
.crisis-banner .hsub {
  font-size: 10px; letter-spacing: 0.1em; color: var(--fg-dim);
  margin-left: auto; text-transform: uppercase;
}

/* Fixed perimeter + atmosphere overlay — every page when breached */
.crisis-frame {
  position: fixed; inset: 0; z-index: 40; pointer-events: none;
}
.crisis-frame .crisis-vignette {
  position: absolute; inset: 0;
  /* center stays transparent; edge alpha capped at ~0.45 for legibility, scaled by intensity */
  background: radial-gradient(125% 95% at 50% 48%, transparent 38%,
    color-mix(in srgb, var(--crit) calc(8% * var(--crisis-intensity, 1)), transparent) 70%,
    color-mix(in srgb, var(--crit) calc(45% * var(--crisis-intensity, 1)), transparent) 100%);
  animation: crisis-breathe 2.6s ease-in-out infinite;
}
@keyframes crisis-breathe { 0%, 100% { opacity: 0.72; } 50% { opacity: 1; } }
.crisis-frame .crisis-scan {
  position: absolute; inset: 0; mix-blend-mode: multiply;
  background: repeating-linear-gradient(0deg, transparent 0 3px,
    color-mix(in srgb, var(--crit) 7%, transparent) 3px 4px);
}
.crisis-frame .crisis-edge { position: absolute; background-repeat: repeat; }
.crisis-frame .crisis-edge.top {
  top: 0; left: 0; right: 0; height: 6px;
  background: repeating-linear-gradient(90deg, var(--crit) 0 16px, transparent 16px 32px);
  animation: crisis-mx 1.05s linear infinite;
}
.crisis-frame .crisis-edge.bottom {
  bottom: 0; left: 0; right: 0; height: 6px;
  background: repeating-linear-gradient(90deg, var(--crit) 0 16px, transparent 16px 32px);
  animation: crisis-mxr 1.05s linear infinite;
}
.crisis-frame .crisis-edge.right {
  top: 0; bottom: 0; right: 0; width: 6px;
  background: repeating-linear-gradient(0deg, var(--crit) 0 16px, transparent 16px 32px);
  animation: crisis-my 1.05s linear infinite;
}
.crisis-frame .crisis-edge.left {
  top: 0; bottom: 0; left: 0; width: 6px;
  background: repeating-linear-gradient(0deg, var(--crit) 0 16px, transparent 16px 32px);
  animation: crisis-myr 1.05s linear infinite;
}
@keyframes crisis-mx  { to { background-position: 32px 0; } }   /* top: flows right  */
@keyframes crisis-my  { to { background-position: 0 32px; } }   /* right: flows down  */
@keyframes crisis-mxr { to { background-position: -32px 0; } }  /* bottom: flows left */
@keyframes crisis-myr { to { background-position: 0 -32px; } }  /* left: flows up     */

/* Status Crisis KPI: OVER 1.0 tag (anchored to the relative .kpi-block) + surplus gauge */
.crisis-over-tag {
  position: absolute; top: 12px; right: 14px;
  font-size: 9px; font-weight: 800; letter-spacing: 0.12em;
  color: var(--crit); border: 2px solid var(--crit); padding: 1px 6px;
  animation: crisis-blink 1.05s steps(1) infinite;
}
.crisis-gauge {
  height: 13px; background: var(--bg-2); border: 2px solid var(--border);
  position: relative; overflow: visible; margin-top: 12px;
}
.crisis-gauge .solid { position: absolute; left: 0; top: 0; bottom: 0; background: var(--crit); }
.crisis-gauge .surplus {
  position: absolute; top: 0; bottom: 0;
  background: repeating-linear-gradient(45deg, var(--crit) 0 5px,
    color-mix(in srgb, var(--crit) 45%, #000) 5px 10px);
}
.crisis-gauge .tick { position: absolute; top: -5px; bottom: -5px; width: 2px; background: var(--fg); }
.crisis-gauge-cap {
  font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--muted); margin-top: 9px;
}
.crisis-gauge-cap .sp { color: var(--crit); font-weight: 800; }

/* Accessibility: honour reduced-motion — keep the signal, drop all animation */
@media (prefers-reduced-motion: reduce) {
  .crisis-banner,
  .crisis-banner .hz.t,
  .crisis-banner .hz.b,
  .crisis-banner .sig,
  .crisis-frame .crisis-vignette,
  .crisis-frame .crisis-edge,
  .crisis-over-tag {
    animation: none !important;
  }
}
```

- [ ] **Step 2: Verify build still compiles**

Run: `npm run build`
Expected: SUCCESS.

---

## Task 11: Red-alert favicon asset

**Files:**
- Create: `public/favicon-alert.svg`

- [ ] **Step 1: Create the asset**

Create `public/favicon-alert.svg` — a crit-red wireframe-moon mark on cream, matching the schematic favicon's mood but red for alert:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" fill="#f4f1ea"/>
  <g fill="none" stroke="#a53a26" stroke-width="1.5">
    <circle cx="16" cy="16" r="11"/>
    <path d="M16 5 v22 M5 16 h22"/>
    <ellipse cx="16" cy="16" rx="5.5" ry="11"/>
    <ellipse cx="16" cy="16" rx="11" ry="5.5"/>
  </g>
</svg>
```

- [ ] **Step 2: Verify it is a valid standalone SVG**

Run: `npm run build`
Expected: SUCCESS — `public/` assets are copied verbatim into `dist/`. (If `public/favicon.svg` uses a different mark, align this variant's shapes to it; the only required difference is the crit-red stroke.)

---

## Task 12: End-to-end coverage (Playwright + axe)

**Files:**
- Create: `tests-e2e/crisis-breach.spec.js`

- [ ] **Step 1: Write the spec**

Create `tests-e2e/crisis-breach.spec.js`. It intercepts `status.json` so the real `public/data` (which has `crisis_factor` ≈ 0.84) doesn't gate the breach states. `meta.json` is left real so the schema check passes.

```js
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function mockStatus(page, crisisFactor) {
  return page.route('**/data/status.json*', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        stability: 0.41,
        crisis_factor: crisisFactor,
        gov_approval: 0.31,
        population_total: 92000,
        resources: [{ name: 'Money', current: 1000, income: 10, upkeep: 5, delta: 5 }],
        active_situations: [],
        demographics: { avg_satisfaction: 0.3, total_births: 100, total_deaths: 80 },
      }),
    }),
  );
}

test.describe('Crisis breach visual state', () => {
  test('engages on every page when crisis_factor > 1.0', async ({ page }) => {
    await mockStatus(page, 1.18);
    await page.goto('/');

    await expect(page.locator('.crisis-banner')).toBeVisible();
    await expect(page.locator('.crisis-frame')).toBeAttached();
    await expect(page.locator('.crisis-edge')).toHaveCount(4);
    await expect(page.locator('.crisis-over-tag')).toBeVisible();
    await expect(page.locator('.crisis-gauge')).toBeVisible();
    await expect(page).toHaveTitle(/⚠ CRISIS · /);

    // Frame + banner persist across routes (colony-wide).
    await page.goto('/#/demographics');
    await expect(page.locator('.crisis-banner')).toBeVisible();
    await expect(page.locator('.crisis-frame')).toBeAttached();

    // No horizontal scroll introduced by the fixed frame.
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(noOverflow).toBe(true);
  });

  test('stays calm below 1.0', async ({ page }) => {
    await mockStatus(page, 0.84);
    await page.goto('/');
    await expect(page.locator('.crisis-banner')).toHaveCount(0);
    await expect(page.locator('.crisis-frame')).toHaveCount(0);
    await expect(page).not.toHaveTitle(/⚠ CRISIS/);
  });

  test('passes axe with breach active', async ({ page }) => {
    await mockStatus(page, 1.42);
    await page.goto('/');
    await expect(page.locator('.crisis-banner')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('renders a static breach under reduced motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await mockStatus(page, 1.2);
    await page.goto('/');
    await expect(page.locator('.crisis-frame')).toBeAttached();
    await expect(page.locator('.crisis-banner')).toBeVisible();
    await context.close();
  });
});
```

- [ ] **Step 2: Run the e2e spec**

Run: `npm run test:e2e -- crisis-breach`
Expected: PASS — all four tests. (Playwright builds + previews a fresh `dist` per `playwright.config.js`; the run may take a minute.)

---

## Task 13: Docs + full verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a gotcha/convention entry to CLAUDE.md**

Append a new numbered entry to the "Common gotchas" list in `CLAUDE.md`:

```markdown
50. **Crisis breach visual state is global and frontend-only.** When colony-wide `status.crisis_factor > 1.0` (strict — exactly 1.0 is at-capacity, not breached) the dashboard enters a hazard state on every route: `CrisisFrame.svelte` (fixed `pointer-events:none` perimeter + red vignette/scanlines, intensity = `clamp(0.35 + surplus*1.3, 0, 1)`), `CrisisBanner.svelte` (in-flow `role="status"` alarm under the nav), the Status Crisis KPI's `OVER 1.0` tag + `CrisisGauge.svelte` (capacity/surplus on a 0..1.5 axis, 1.0 tick at 66.667%), and a tab title `⚠ CRISIS · …` + `public/favicon-alert.svg` swap via `crisisAlert` in `page-title.js`. Breach math is the pure `src/lib/crisis-breach.js`; `crisisBreach` (in `src/lib/stores/crisis.js`) derives from the shared `status` store, which `App.svelte` now loads once globally via `loadStatus`. No backend/extractor/schema change — `crisis_factor` already exists in `status.json`. Marching stripes use an exact `background-size` tile + one-tile shift so the loop is seamless (a 45° `repeating-linear-gradient` shifted by its stop period visibly jumps — don't reintroduce that). All animation is gated behind `@media (prefers-reduced-motion: reduce)` (axe build requirement) and the vignette edge alpha is capped (~0.45) for legibility.
```

- [ ] **Step 2: Run the full unit suite**

Run: `npm run test -- run`
Expected: PASS — all unit/component tests including the new crisis tests, with no regressions.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 4: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: PASS — including `crisis-breach.spec.js` and the existing a11y/mobile specs.

- [ ] **Step 5: Commit (ask first)**

Per the user's commit preference, do NOT auto-commit. Surface the complete diff summary and ask how to structure the commit(s) — e.g. a single `feat: crisis breach visual state` commit, or split (`.gitignore`/docs vs. feature code). Then commit as directed on the `crisis-over-one` branch.

---

## Self-review notes

- **Spec coverage:** breach math + threshold (Task 1), global availability (Tasks 2, 9), marching frame on all pages (Tasks 6, 9, 10), hazard banner with marching chevrons (Tasks 5, 10), vignette intensity ramp + legibility cap (Tasks 6, 10), Status OVER tag + surplus gauge (Tasks 4, 7, 8, 10), tab title + favicon (Tasks 3, 11), reduced-motion fallback (Task 10), tests incl. axe + mobile + reduced-motion (Tasks 1–6, 12), docs (Task 13). All spec sections map to a task.
- **Cut scope honoured:** no tiered escalation, entry transition, timestamp, or effects list anywhere in the plan.
- **Naming consistency:** `computeCrisisBreach`/`crisisGaugeGeometry`/`CRISIS_GAUGE_MAX` (Task 1) are used identically in Tasks 2 and 4; `crisisBreach` store shape `{ factor, breached, surplus, intensity }` is consumed consistently in Tasks 5, 6, 8, 9; `crisisAlert` (Task 3) consumed in Task 9; `.crisis-*` class names match between component markup (Tasks 4–6, 8) and CSS (Task 10) and e2e selectors (Task 12).
