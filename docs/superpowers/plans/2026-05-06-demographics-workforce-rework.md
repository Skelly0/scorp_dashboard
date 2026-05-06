# Demographics — Workforce Band + Top-KPI Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three top-of-page KPIs on Demographics (CDR, Net Δ%, Total Deaths) with action-oriented readouts (Available Housing, Predicted Growth, Workforce Fill); add per-class workforce columns to Class Vitals; insert a new aggregate Workforce band with a skill-mismatch callout.

**Architecture:** Frontend-only change. Workforce aggregation lives in a new derived store (`src/lib/stores/workforce.js`) that consumes `$pops`. New `WorkforceBand.svelte` component encapsulates the band markup. `KpiBlock` gains a `subtitle` prop. No backend / sync-pipeline changes.

**Tech Stack:** Svelte 4, Vitest 2 (unit), Playwright (e2e), Tailwind (utilities) + custom CSS classes from `global.css`.

**Spec:** `docs/superpowers/specs/2026-05-06-demographics-workforce-rework-design.md`

---

## File Structure

**Create:**
- `src/lib/stores/workforce.js` — derived store: `{ totalDemand, totalSupply, totalUnemployed, fillRatio, shortage, topUnemployed, topShortage, mismatch }`
- `src/lib/stores/workforce.test.js` — Vitest tests for the derived store
- `src/lib/components/WorkforceBand.svelte` — Band 03 markup (3 KPI tiles + Fill bar + conditional callout)
- `tests-e2e/demographics.spec.js` — Playwright coverage of the reworked page

**Modify:**
- `src/lib/components/KpiBlock.svelte` — add optional `subtitle` prop
- `src/lib/stores/history.js` — add `populationDeltaHistory` derived (year-over-year deltas)
- `src/routes/Demographics.svelte` — three swap zones: top KPI tiles, Class Vitals columns, insert `<WorkforceBand>` band
- `src/styles/global.css` — add `.kpi-subtitle` rule
- `CLAUDE.md` — one-liner: new store + band ordering note

---

## Task 1: Add `subtitle` prop to `KpiBlock`

**Files:**
- Modify: `src/lib/components/KpiBlock.svelte`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add `subtitle` prop and render it inside `.kpi-foot`**

Replace the script block and template in `src/lib/components/KpiBlock.svelte` so the full file reads:

```svelte
<script>
  import Sparkline from './Sparkline.svelte';

  export let label;
  export let value;
  export let prefix = '';
  export let suffix = '';
  export let subtitle = null;
  export let delta = null;
  export let critical = false;
  export let good = false;
  export let history = null;
  export let sparkColor = null;

  $: deltaSign = delta != null ? (delta > 0 ? '▲' : delta < 0 ? '▼' : '·') : null;
  $: deltaClass = delta != null ? (delta > 0 ? 'delta up' : delta < 0 ? 'delta down' : 'delta') : '';
  $: numClass = critical ? 'kpi-num crit' : good ? 'kpi-num good' : 'kpi-num';
  $: displayValue = value == null ? '—' : value;
</script>

<div class="kpi-block" class:critical>
  <div class="kpi-label">{label}</div>
  <div class={numClass}>{prefix}{displayValue}{suffix}</div>
  {#if subtitle}
    <div class="kpi-subtitle">{subtitle}</div>
  {/if}
  <div class="kpi-foot">
    {#if delta != null}
      <span class={deltaClass}>{deltaSign} {delta > 0 ? '+' : ''}{delta}</span>
    {/if}
    {#if delta != null && history}<span class="text-muted">·</span>{/if}
    {#if history}
      <Sparkline data={history} color={sparkColor ?? (critical ? 'var(--crit)' : good ? 'var(--good)' : 'var(--accent)')} />
    {/if}
  </div>
</div>
```

- [ ] **Step 2: Add `.kpi-subtitle` CSS rule in `src/styles/global.css`**

Find the existing `.kpi-block` block and add this rule directly after it (before the next `.kpi-…` rule):

```css
.kpi-subtitle {
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  color: var(--muted);
  text-transform: uppercase;
  margin-top: 2px;
}
```

`--muted` is defined in all three themes (light/dark/schematic) and is what the existing kpi-foot text uses; reusing it keeps contrast consistent.

- [ ] **Step 3: Manual verify — run dev server, visit any page using KpiBlock**

Run:

```bash
npm run dev
```

Open `http://localhost:5173/#/status` (or any route with KpiBlock). Existing tiles render unchanged (no subtitle prop passed → no extra row).

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/KpiBlock.svelte src/styles/global.css
git commit -m "feat(kpi): optional subtitle prop on KpiBlock"
```

---

## Task 2: Write `workforce` derived store (TDD)

**Files:**
- Create: `src/lib/stores/workforce.js`
- Create: `src/lib/stores/workforce.test.js`

- [ ] **Step 1: Write failing tests in `src/lib/stores/workforce.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { get, writable } from 'svelte/store';

// Use a re-import pattern so we can swap the upstream `pops` store for tests.
// The store under test imports `pops` from './pops.js'; tests mock that module.
import { vi } from 'vitest';

vi.mock('./pops.js', () => {
  return { pops: writable(null) };
});

const { pops } = await import('./pops.js');
const { workforce } = await import('./workforce.js');

const sample = (overrides = {}) => ({
  classes: [
    { name: 'A', unemployed_count: 0, workforce: { demand: 100, supply: 80 } },
    { name: 'B', unemployed_count: 50, workforce: { demand: 200, supply: 250 } },
    { name: 'C', unemployed_count: 30, workforce: { demand: 50, supply: 40 } },
    ...((overrides.classes) ?? []),
  ],
  ...overrides,
});

describe('workforce derived store', () => {
  it('returns null when pops is null', () => {
    pops.set(null);
    expect(get(workforce)).toBeNull();
  });

  it('returns null when classes is empty', () => {
    pops.set({ classes: [] });
    expect(get(workforce)).toBeNull();
  });

  it('sums demand/supply/unemployed across classes', () => {
    pops.set(sample());
    const w = get(workforce);
    expect(w.totalDemand).toBe(350);
    expect(w.totalSupply).toBe(370);
    expect(w.totalUnemployed).toBe(80);
  });

  it('computes fillRatio as totalSupply/totalDemand', () => {
    pops.set(sample());
    expect(get(workforce).fillRatio).toBeCloseTo(370 / 350, 5);
  });

  it('returns null fillRatio when totalDemand is zero', () => {
    pops.set({ classes: [{ name: 'X', unemployed_count: 0, workforce: { demand: 0, supply: 0 } }] });
    expect(get(workforce).fillRatio).toBeNull();
  });

  it('shortage uses per-class summed shortage, not colony net', () => {
    // A: short by 20, B: surplus 50, C: short by 10. Net = -20 (surplus).
    // Per-class summed shortage = 20 + 0 + 10 = 30.
    pops.set(sample());
    expect(get(workforce).shortage).toBe(30);
  });

  it('topUnemployed lists top-2 by count, descending', () => {
    pops.set(sample());
    const top = get(workforce).topUnemployed;
    expect(top).toEqual([
      { name: 'B', count: 50 },
      { name: 'C', count: 30 },
    ]);
  });

  it('topShortage lists top-2 short classes, descending, ignores oversupplied', () => {
    pops.set(sample());
    const top = get(workforce).topShortage;
    expect(top).toEqual([
      { name: 'A', count: 20 },
      { name: 'C', count: 10 },
    ]);
  });

  it('mismatch is true only when both totalUnemployed > 0 and shortage > 0', () => {
    pops.set(sample());
    expect(get(workforce).mismatch).toBe(true);

    // No unemployment → no mismatch.
    pops.set({
      classes: [
        { name: 'A', unemployed_count: 0, workforce: { demand: 100, supply: 80 } },
      ],
    });
    expect(get(workforce).mismatch).toBe(false);

    // No shortage → no mismatch.
    pops.set({
      classes: [
        { name: 'A', unemployed_count: 50, workforce: { demand: 100, supply: 200 } },
      ],
    });
    expect(get(workforce).mismatch).toBe(false);
  });

  it('handles missing workforce/unemployed_count fields safely', () => {
    pops.set({
      classes: [
        { name: 'A' },
        { name: 'B', workforce: {} },
        { name: 'C', unemployed_count: null, workforce: { demand: null, supply: null } },
      ],
    });
    const w = get(workforce);
    expect(w.totalDemand).toBe(0);
    expect(w.totalSupply).toBe(0);
    expect(w.totalUnemployed).toBe(0);
    expect(w.fillRatio).toBeNull();
    expect(w.shortage).toBe(0);
    expect(w.mismatch).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they all fail**

```bash
npm run test -- src/lib/stores/workforce.test.js
```

Expected: ten failures, all "Cannot find module './workforce.js'" (or similar).

- [ ] **Step 3: Implement `src/lib/stores/workforce.js`**

```js
import { derived } from 'svelte/store';
import { pops } from './pops.js';

export const workforce = derived(pops, ($pops) => {
  if (!$pops?.classes?.length) return null;

  const classes = $pops.classes;
  const totalDemand = classes.reduce((s, c) => s + (c.workforce?.demand ?? 0), 0);
  const totalSupply = classes.reduce((s, c) => s + (c.workforce?.supply ?? 0), 0);
  const totalUnemployed = classes.reduce((s, c) => s + (c.unemployed_count ?? 0), 0);
  const fillRatio = totalDemand > 0 ? totalSupply / totalDemand : null;

  const perClassShortage = classes.map((c) => ({
    name: c.name,
    count: Math.max(0, (c.workforce?.demand ?? 0) - (c.workforce?.supply ?? 0)),
  }));
  const shortage = perClassShortage.reduce((s, x) => s + x.count, 0);

  const topUnemployed = [...classes]
    .filter((c) => (c.unemployed_count ?? 0) > 0)
    .sort((a, b) => (b.unemployed_count ?? 0) - (a.unemployed_count ?? 0))
    .slice(0, 2)
    .map((c) => ({ name: c.name, count: Math.round(c.unemployed_count) }));

  const topShortage = perClassShortage
    .map((x) => ({ name: x.name, count: Math.round(x.count) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2);

  return {
    totalDemand,
    totalSupply,
    totalUnemployed,
    fillRatio,
    shortage,
    topUnemployed,
    topShortage,
    mismatch: totalUnemployed > 0 && shortage > 0,
  };
});
```

- [ ] **Step 4: Run tests to verify they all pass**

```bash
npm run test -- src/lib/stores/workforce.test.js
```

Expected: ten passes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/workforce.js src/lib/stores/workforce.test.js
git commit -m "feat(stores): workforce derived store with TDD coverage"
```

---

## Task 3: Add `populationDeltaHistory` to `history.js`

**Files:**
- Modify: `src/lib/stores/history.js`

- [ ] **Step 1: Add the derived store**

Append to `src/lib/stores/history.js` (after the existing `avgSatHistory` line):

```js
// Year-over-year population delta. data[i] = pop[i] - pop[i-1].
// First entry is dropped (no prior reference).
export const populationDeltaHistory = derived(history, ($h) => {
  if (!$h) return [];
  const pops = $h.snapshots.map((s) => s?.population_total).filter((v) => v != null);
  if (pops.length < 2) return [];
  return pops.slice(1).map((v, i) => v - pops[i]);
});
```

- [ ] **Step 2: Manual verify — load the page in dev**

Run:

```bash
npm run dev
```

Open the Status page (which uses `populationHistory`). Confirm no console errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/history.js
git commit -m "feat(history): year-over-year populationDeltaHistory derived"
```

---

## Task 4: Build `WorkforceBand.svelte` component

**Files:**
- Create: `src/lib/components/WorkforceBand.svelte`

- [ ] **Step 1: Implement the component**

```svelte
<script>
  import { workforce } from '../stores/workforce.js';
  import Band from './Band.svelte';
  import KpiBlock from './KpiBlock.svelte';
  import Bar from './Bar.svelte';

  export let bandNum = '03';

  $: w = $workforce;
  $: fillVariant = w?.fillRatio == null
    ? ''
    : w.fillRatio < 0.85
      ? 'crit'
      : w.fillRatio > 1.0
        ? 'overflow'
        : '';
</script>

{#if w}
  <Band num={bandNum} title="Workforce" meta={w.mismatch ? 'SKILL MISMATCH' : 'colony labour'} />
  <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
    <KpiBlock label="Total Demand" value={Math.round(w.totalDemand).toLocaleString()} />
    <KpiBlock label="Total Supply" value={Math.round(w.totalSupply).toLocaleString()} />
    <KpiBlock
      label="Total Unemployed"
      value={Math.round(w.totalUnemployed).toLocaleString()}
      critical={w.totalUnemployed > 0 && w.mismatch}
    />
  </div>

  <div class="s-card mt-3">
    <div class="s-card-pad">
      <Bar
        label="Colony-wide Fill"
        value={w.fillRatio}
        max={1}
        variant={fillVariant}
        format="pct"
      />
    </div>
  </div>

  {#if w.mismatch}
    <div class="s-card sit-card sev-warn mt-3" role="status">
      <div class="s-card-pad">
        <strong>Skill mismatch:</strong>
        {w.totalUnemployed.toLocaleString()} idle
        {#if w.topUnemployed.length}
          (top: {w.topUnemployed.map((t) => `${t.name} (${t.count})`).join(', ')})
        {/if}
        while {w.shortage.toLocaleString()} jobs unfilled
        {#if w.topShortage.length}
          (top: {w.topShortage.map((t) => `${t.name} (${t.count})`).join(', ')})
        {/if}.
      </div>
    </div>
  {/if}
{/if}
```

- [ ] **Step 2: Confirm the component imports compile**

Touch the imports — verify `Band`, `KpiBlock`, `Bar` exist at those paths:

```bash
ls src/lib/components/Band.svelte src/lib/components/KpiBlock.svelte src/lib/components/Bar.svelte
```

Expected: all three files listed (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/WorkforceBand.svelte
git commit -m "feat(components): WorkforceBand with mismatch callout"
```

---

## Task 5: Wire `Demographics.svelte` — Top KPI swap

**Files:**
- Modify: `src/routes/Demographics.svelte`

- [ ] **Step 1: Update imports + add new reactive computations**

Replace the entire `<script>` block at the top of `src/routes/Demographics.svelte` so it reads:

```svelte
<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { pops, popsError, loadPops } from '../lib/stores/pops.js';
  import {
    demographics, demographicsError, loadDemographics,
  } from '../lib/stores/demographics.js';
  import { workforce } from '../lib/stores/workforce.js';
  import {
    avgSatHistory, populationDeltaHistory,
  } from '../lib/stores/history.js';
  import { pageTitle } from '../lib/page-title.js';
  import { classColor } from '../lib/faction-colors.js';
  import Band from '../lib/components/Band.svelte';
  import KpiBlock from '../lib/components/KpiBlock.svelte';
  import Bar from '../lib/components/Bar.svelte';
  import MoonLoader from '../lib/components/MoonLoader.svelte';
  import WorkforceBand from '../lib/components/WorkforceBand.svelte';

  onMount(() => {
    pageTitle.set('Demographics');
    if ($meta?.synced_at) {
      loadPops($meta.synced_at);
      loadDemographics($meta.synced_at);
    }
  });

  $: errorMsg = $demographicsError ?? $popsError;
  $: ready = $demographics && $pops;
  $: housingCritical = $demographics?.housing?.ratio != null
    && $demographics.housing.ratio > 1.0;

  // Available housing: capacity − pop, with % free subtitle.
  $: availableHousing = (() => {
    const cap = $demographics?.housing?.capacity;
    const pop = $demographics?.housing?.pop;
    if (cap == null || pop == null || cap === 0) return { value: null, subtitle: null };
    const free = cap - pop;
    const pct = Math.round((free / cap) * 100);
    return { value: free.toLocaleString(), subtitle: `${pct}% free` };
  })();

  // Predicted growth: pop × (effective_growth × housing_growth_mult − cdr), rounded, signed.
  $: predictedGrowth = (() => {
    const t = $demographics?.totals;
    const h = $demographics?.housing;
    if (!t) return null;
    const g = t.effective_growth_rate;
    const cdr = t.effective_cdr;
    if (g == null || cdr == null) return null;
    const mult = h?.growth_mult ?? 1.0;
    const delta = Math.round(t.pop * (g * mult - cdr));
    return delta;
  })();

  $: predictedGrowthDisplay = predictedGrowth == null
    ? null
    : (predictedGrowth >= 0 ? '+' : '') + predictedGrowth.toLocaleString() + ' / turn';

  // Workforce fill from derived store.
  $: workforceFill = $workforce?.fillRatio;
  $: workforceFillDisplay = workforceFill == null
    ? null
    : (workforceFill * 100).toFixed(1) + '%';
  $: workforceFillCritical = workforceFill != null && workforceFill < 0.85;
  $: workforceFillGood = workforceFill != null && workforceFill >= 1.0;
</script>
```

- [ ] **Step 2: Replace Band 01 markup with new five-tile layout**

Find this block (currently lines ~42-74 — the `<Band num="01"…>` plus the five `<KpiBlock>` tiles up to and including `Avg Satisfaction`):

```svelte
    <Band num="01" title="Pop Dynamics" meta="colony vital signs" />
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KpiBlock
        label="Total Pop"
        value={$demographics.totals.pop?.toLocaleString() ?? '—'}
      />
      <KpiBlock
        label="Effective CDR"
        value={$demographics.totals.effective_cdr?.toFixed(4) ?? '—'}
        history={$cdrHistory.length >= 2 ? $cdrHistory : null}
      />
      <KpiBlock
        label="Net Δ%"
        value={$demographics.totals.net_delta_pct != null
          ? ($demographics.totals.net_delta_pct >= 0 ? '+' : '')
            + $demographics.totals.net_delta_pct.toFixed(2) + '%'
          : '—'}
        history={$netDeltaHistory.length >= 2 ? $netDeltaHistory : null}
      />
      <KpiBlock
        label="Total Deaths"
        value={$demographics.totals.total_deaths != null
          ? Math.round($demographics.totals.total_deaths).toLocaleString()
          : '—'}
        history={$deathsHistory.length >= 2 ? $deathsHistory : null}
      />
      <KpiBlock
        label="Avg Satisfaction"
        value={$demographics.totals.avg_satisfaction?.toFixed(2) ?? '—'}
        history={$avgSatHistory.length >= 2 ? $avgSatHistory : null}
        good
      />
    </div>
```

Replace with:

```svelte
    <Band num="01" title="Pop Dynamics" meta="colony vital signs" />
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KpiBlock
        label="Total Pop"
        value={$demographics.totals.pop?.toLocaleString() ?? '—'}
      />
      <KpiBlock
        label="Avg Satisfaction"
        value={$demographics.totals.avg_satisfaction?.toFixed(2) ?? '—'}
        history={$avgSatHistory.length >= 2 ? $avgSatHistory : null}
        good
      />
      <KpiBlock
        label="Available Housing"
        value={availableHousing.value}
        subtitle={availableHousing.subtitle}
      />
      <KpiBlock
        label="Predicted Growth"
        value={predictedGrowthDisplay}
        history={$populationDeltaHistory.length >= 2 ? $populationDeltaHistory : null}
        critical={predictedGrowth != null && predictedGrowth < 0}
        good={predictedGrowth != null && predictedGrowth > 0}
      />
      <KpiBlock
        label="Workforce Fill"
        value={workforceFillDisplay}
        critical={workforceFillCritical}
        good={workforceFillGood}
      />
    </div>
```

- [ ] **Step 3: Manual verify — dev server**

Run:

```bash
npm run dev
```

Open `http://localhost:5173/#/demographics`. Confirm:
- Five tiles render: Total Pop, Avg Satisfaction, Available Housing (with `% free` subtitle), Predicted Growth (signed `−18 / turn` or similar), Workforce Fill (e.g. `90.7%`).
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/Demographics.svelte
git commit -m "feat(demographics): swap top KPIs to housing/growth/workforce"
```

---

## Task 6: Wire `Demographics.svelte` — Class Vitals new columns

**Files:**
- Modify: `src/routes/Demographics.svelte`

- [ ] **Step 1: Add Demand and Fill % columns to the Class Vitals table**

Find this block (the `<table class="tbl">` inside the Class Vitals s-card):

```svelte
        <thead>
          <tr>
            <th>Class</th>
            <th class="num">Pop</th>
            <th class="num">Mortality</th>
            <th class="num">Deaths/turn</th>
            <th class="num">Unemployed</th>
            <th class="num">Satisfaction</th>
          </tr>
        </thead>
        <tbody>
          {#each $pops.classes as c}
            <tr>
              <td>
                <span class="faction-bar" style="--bar-color: {classColor(c.name)}"></span>
                {c.name}
              </td>
              <td class="num">{c.pop?.toLocaleString() ?? '—'}</td>
              <td class="num">{c.mortality_rate != null ? (c.mortality_rate * 100).toFixed(2) + '%' : '—'}</td>
              <td class="num">{c.deaths_per_turn != null ? Math.round(c.deaths_per_turn).toLocaleString() : '—'}</td>
              <td class="num">{c.unemployed_count != null ? Math.round(c.unemployed_count).toLocaleString() : '—'}</td>
              <td class="num">{c.satisfaction?.toFixed(2) ?? '—'}</td>
            </tr>
          {/each}
        </tbody>
```

Replace with (note: column order is Pop, Mortality, Deaths/turn, **Demand**, **Fill %**, Unemployed, Satisfaction):

```svelte
        <thead>
          <tr>
            <th>Class</th>
            <th class="num">Pop</th>
            <th class="num">Mortality</th>
            <th class="num">Deaths/turn</th>
            <th class="num">Demand</th>
            <th class="num">Fill %</th>
            <th class="num">Unemployed</th>
            <th class="num">Satisfaction</th>
          </tr>
        </thead>
        <tbody>
          {#each $pops.classes as c}
            {@const fill = c.workforce?.fill_ratio}
            {@const fillDim = fill != null && fill < 0.85}
            <tr>
              <td>
                <span class="faction-bar" style="--bar-color: {classColor(c.name)}"></span>
                {c.name}
              </td>
              <td class="num">{c.pop?.toLocaleString() ?? '—'}</td>
              <td class="num">{c.mortality_rate != null ? (c.mortality_rate * 100).toFixed(2) + '%' : '—'}</td>
              <td class="num">{c.deaths_per_turn != null ? Math.round(c.deaths_per_turn).toLocaleString() : '—'}</td>
              <td class="num">{c.workforce?.demand != null ? Math.round(c.workforce.demand).toLocaleString() : '—'}</td>
              <td class="num" class:text-crit={fillDim}>{fill != null ? (fill * 100).toFixed(0) + '%' : '—'}</td>
              <td class="num">{c.unemployed_count != null ? Math.round(c.unemployed_count).toLocaleString() : '—'}</td>
              <td class="num">{c.satisfaction?.toFixed(2) ?? '—'}</td>
            </tr>
          {/each}
        </tbody>
```

Note: `{@const}` placement is inside `{#each}` — the immediate child is allowed (CLAUDE.md gotcha #7).

- [ ] **Step 2: Manual verify — dev server**

Open `http://localhost:5173/#/demographics`. Confirm:
- Class Vitals table has 8 columns; Demand and Fill % visible.
- Classes with `fill_ratio < 0.85` show their Fill % in `text-crit` colour.
- No console / Svelte warnings.

- [ ] **Step 3: Commit**

```bash
git add src/routes/Demographics.svelte
git commit -m "feat(demographics): add Demand and Fill % columns to Class Vitals"
```

---

## Task 7: Wire `Demographics.svelte` — insert `<WorkforceBand>` band

**Files:**
- Modify: `src/routes/Demographics.svelte`

- [ ] **Step 1: Insert `<WorkforceBand>` between Class Vitals and Housing; renumber Housing → 04, Food → 05**

Find this section:

```svelte
    <Band num="03" title="Housing" meta={housingCritical ? 'OVERCROWDED' : 'capacity'} />
```

Insert directly *before* it:

```svelte
    <WorkforceBand bandNum="03" />
```

Then change the Housing band's number from `"03"` to `"04"`:

```svelte
    <Band num="04" title="Housing" meta={housingCritical ? 'OVERCROWDED' : 'capacity'} />
```

And the Food Security band from `"04"` to `"05"`:

```svelte
    <Band num="05" title="Food Security" meta="cropsim signals" />
```

- [ ] **Step 2: Manual verify — dev server**

Open `http://localhost:5173/#/demographics`. Confirm:
- Bands appear in order: 01 Pop Dynamics, 02 Class Vitals, 03 Workforce, 04 Housing, 05 Food Security.
- Workforce band shows three KPI tiles, a Fill bar, and (with the live `pops.json`) the skill-mismatch callout.
- Total Demand ≈ 12,828; Total Supply ≈ 11,635; Total Unemployed = 505; Fill = ~90.7%.
- The callout text reads something like: "Skill mismatch: 505 idle (top: Industrial Workers (315), Service Workers (140)) while 1,697 jobs unfilled (top: Botanists (576), Engineers (297))."
- No console errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/Demographics.svelte
git commit -m "feat(demographics): insert Workforce band and renumber"
```

---

## Task 8: Playwright e2e — `tests-e2e/demographics.spec.js`

**Files:**
- Create: `tests-e2e/demographics.spec.js`

- [ ] **Step 1: Write the spec**

```js
import { test, expect } from '@playwright/test';

test.describe('Demographics page — workforce rework', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/demographics');
    // Wait for the loader to clear and the first band to render.
    await expect(page.locator('text=Pop Dynamics')).toBeVisible({ timeout: 10000 });
  });

  test('top KPIs show new tiles, not the old three', async ({ page }) => {
    // New tiles present.
    await expect(page.locator('text=Available Housing')).toBeVisible();
    await expect(page.locator('text=Predicted Growth')).toBeVisible();
    await expect(page.locator('text=Workforce Fill')).toBeVisible();

    // Removed tiles absent (effective CDR / Net Δ% / Total Deaths) from Pop Dynamics.
    // Note: these may still appear elsewhere if added later — scope to band 01.
    const band01 = page.locator('section').filter({ hasText: 'Pop Dynamics' }).first();
    await expect(band01.locator('text=Effective CDR')).toHaveCount(0);
    await expect(band01.locator('text=Net Δ%')).toHaveCount(0);
    await expect(band01.locator('text=Total Deaths')).toHaveCount(0);
  });

  test('Available Housing shows count and "% free" subtitle', async ({ page }) => {
    const tile = page.locator('.kpi-block').filter({ hasText: 'Available Housing' });
    await expect(tile).toBeVisible();
    // Subtitle should say "X% free".
    await expect(tile.locator('.kpi-subtitle')).toHaveText(/\d+% free/);
  });

  test('Predicted Growth shows signed "/ turn" value', async ({ page }) => {
    const tile = page.locator('.kpi-block').filter({ hasText: 'Predicted Growth' });
    await expect(tile).toBeVisible();
    // Should look like "+150 / turn", "-18 / turn", or "—".
    await expect(tile).toContainText(/(\+|−|-|—).*\/ turn|—/);
  });

  test('Class Vitals has Demand and Fill % columns', async ({ page }) => {
    await expect(page.locator('th', { hasText: 'Demand' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Fill %' })).toBeVisible();
    // Total expected column count: Class, Pop, Mortality, Deaths/turn, Demand, Fill %, Unemployed, Satisfaction = 8.
    const headers = await page.locator('table.tbl thead th').count();
    expect(headers).toBe(8);
  });

  test('Workforce band renders between Class Vitals and Housing', async ({ page }) => {
    const workforceBand = page.locator('text=Workforce').first();
    await expect(workforceBand).toBeVisible();

    // Three workforce tiles.
    await expect(page.locator('.kpi-block').filter({ hasText: 'Total Demand' })).toBeVisible();
    await expect(page.locator('.kpi-block').filter({ hasText: 'Total Supply' })).toBeVisible();
    await expect(page.locator('.kpi-block').filter({ hasText: 'Total Unemployed' })).toBeVisible();

    // Fill bar.
    await expect(page.locator('.bar-row').filter({ hasText: 'Colony-wide Fill' })).toBeVisible();
  });

  test('skill-mismatch callout appears when both shortage and unemployment exist (live data)', async ({ page }) => {
    // The current snapshot has skill mismatch (Industrial/Service unemployed; Botanists/Engineers short).
    // If a future snapshot lacks one side, this assertion can flip — adjust then.
    await expect(page.locator('text=Skill mismatch:')).toBeVisible();
  });

  test('band ordering — Pop Dynamics → Class Vitals → Workforce → Housing → Food Security', async ({ page }) => {
    const bandTitles = await page.locator('.band').allInnerTexts();
    // Each band string contains the title; check the sequence.
    const order = ['Pop Dynamics', 'Class Vitals', 'Workforce', 'Housing', 'Food Security'];
    for (let i = 0; i < order.length; i++) {
      expect(bandTitles[i]).toContain(order[i]);
    }
  });
});
```

- [ ] **Step 2: Run the e2e suite**

The dev server must be running (Playwright is configured to start it via `webServer` config; if not, run `npm run dev` in another terminal first).

```bash
npm run test:e2e -- tests-e2e/demographics.spec.js
```

Expected: all seven tests pass.

If the band-ordering assertion fails because of how `.band` text is rendered (titles may be split across child elements), adjust the selector to match the actual DOM. Common alternative:

```js
const titles = await page.locator('.band .title, .band-title, .band > div').allInnerTexts();
```

Inspect with:

```bash
npm run test:e2e -- tests-e2e/demographics.spec.js --debug
```

- [ ] **Step 3: Confirm a11y still passes**

```bash
npm run test:e2e -- tests-e2e/a11y.spec.js
```

Expected: green. If a new violation appears (e.g. callout has insufficient contrast), fix the styling rather than changing the threshold.

- [ ] **Step 4: Commit**

```bash
git add tests-e2e/demographics.spec.js
git commit -m "test(e2e): demographics workforce rework coverage"
```

---

## Task 9: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Note the new store in the Layout section**

Find this exact line in `CLAUDE.md`:

```md
- `src/lib/stores/history.js` — derived stores for treasury/stability/CF/population year-series
```

Add directly after it:

```md
- `src/lib/stores/workforce.js` — derived from `$pops`; aggregates colony-wide demand/supply/fill, top-2 unemployed and short classes, mismatch flag
```

- [ ] **Step 2: Add a Demographics-band-ordering gotcha as #16**

Find the last existing gotcha (currently #15 about filter ring colour priority) — it ends with this line:

```md
15. **Filter ring colour priority is fixed.** When multiple filters are active on the Map, the ring uses the *resource → feature → improvement* priority (resource always wins). This is deterministic by design — multiple highlight colours per match would smear into noise. If you reorder priorities, update `MapCanvas.svelte:ringColor` AND the spec at `docs/superpowers/specs/2026-05-06-map-overlays-and-filtering-design.md` Section 6.2 in lockstep.
```

Add a new line directly after it:

```md
16. **Demographics band ordering.** `01 Pop Dynamics → 02 Class Vitals → 03 Workforce → 04 Housing → 05 Food Security`. The Workforce band is rendered by `WorkforceBand.svelte` and is null-safe — it renders nothing when `$workforce` is null (i.e. before `pops.json` has loaded). If you renumber, update both `Demographics.svelte` and the spec at `docs/superpowers/specs/2026-05-06-demographics-workforce-rework-design.md`.
```

- [ ] **Step 3: Add the new spec/plan to "Where to read more"**

Find this block at the end of `CLAUDE.md`:

```md
- Spec (v3 demographics): `docs/superpowers/specs/2026-05-06-demographics-page-and-status-vitals-design.md`
- Plan: `docs/superpowers/plans/2026-05-01-scorp-dashboard-implementation.md`
- Plan (v3 demographics): `docs/superpowers/plans/2026-05-06-demographics-page-and-status-vitals.md`
- Backend: `../scorp_colony/CLAUDE.md`
```

Replace with:

```md
- Spec (v3 demographics): `docs/superpowers/specs/2026-05-06-demographics-page-and-status-vitals-design.md`
- Spec (workforce rework): `docs/superpowers/specs/2026-05-06-demographics-workforce-rework-design.md`
- Plan: `docs/superpowers/plans/2026-05-01-scorp-dashboard-implementation.md`
- Plan (v3 demographics): `docs/superpowers/plans/2026-05-06-demographics-page-and-status-vitals.md`
- Plan (workforce rework): `docs/superpowers/plans/2026-05-06-demographics-workforce-rework.md`
- Backend: `../scorp_colony/CLAUDE.md`
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note workforce store and demographics band ordering"
```

---

## Task 10: Final verification

- [ ] **Step 1: Run full unit test suite**

```bash
npm run test
```

Expected: all green, including the new `workforce.test.js`.

- [ ] **Step 2: Run full e2e suite**

```bash
npm run test:e2e
```

Expected: all green (`a11y.spec.js`, `map-overlays.spec.js`, `demographics.spec.js`).

- [ ] **Step 3: Manual browser walkthrough**

Run `npm run dev`. In the browser:

1. Visit `/#/demographics`. Verify five top tiles, eight-column Class Vitals table, Workforce band with mismatch callout, then Housing, then Food Security.
2. Toggle theme (light → dark → schematic). All three should render the new tiles and band cleanly. The `.kpi-subtitle` colour should remain readable in all three.
3. Sparkline on Predicted Growth: if `populationDeltaHistory` has ≥ 2 entries it should render; otherwise no sparkline (no error).
4. Hover the skill-mismatch callout — text should be readable.

If any of the above is wrong, return to the relevant task.

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: clean build, no Vite warnings about unresolved imports.

---

## Notes for the implementer

- **Don't touch the Housing band logic** (the `housingCritical` reactive). The user is fixing the meaning of `HousingRatio` in the backend separately. The new "Available Housing" tile is computed from `capacity − pop` directly and won't be affected by that fix.
- **CLAUDE.md gotcha #7** — `{@const}` must be the immediate child of `{#each}` in the Class Vitals table. The plan already places it correctly; if you refactor, keep that placement.
- **CLAUDE.md gotcha #11** — Sparklines need `data.length >= 2`. The plan guards `populationDeltaHistory` with the same check; don't drop it.
- **No backend changes.** `demographics.json` and `pops.json` shapes are unchanged. The CDR / Net Δ% / Deaths fields stay in `demographics.json.totals` because `history.js` and the year-snapshot pipeline still consume them.
