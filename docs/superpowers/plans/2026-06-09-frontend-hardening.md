# Frontend Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify page loading/error/stale states behind one `PageState` wrapper, surface `meta.partial_failures` to players, land the a11y baseline (landmark, skip link, focus, headings), and fix four screenshot-verified visual-consistency defects.

**Architecture:** Presentational-only `PageState.svelte` wrapper adopted by all nine routes (routes keep their own stores/loading logic); a warn state on `SyncChip`; app-shell a11y changes in `App.svelte`/`NavBar.svelte`/`Band.svelte`; shared `src/lib/format.js` formatters; CSS additions to `global.css` design vocabulary.

**Tech Stack:** Svelte 4, Vite, Tailwind (utilities only; design vocabulary in `global.css`), Vitest + @testing-library/svelte, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-06-09-frontend-hardening-design.md`

**Branch:** `feat/frontend-hardening` (already created; spec committed).

**Commit policy (user preference, overrides per-task commits):** Do NOT commit after each task. Execute all tasks, then ask the user how to structure the final commit(s). CLAUDE.md must be updated (Task 12) before any commit per user's global instructions.

**Before running any Playwright command:** kill any stray `vite preview` on port 4173 (one was started during the design review). `playwright.config.js` uses `--strictPort 4173` and starts its own server; a squatter on the port fails the run. Check with `netstat -ano | findstr :4173` and kill the PID if present.

---

### Task 1: Shared formatters `src/lib/format.js` (TDD)

**Files:**
- Create: `src/lib/format.js`
- Create: `src/lib/format.test.js`

Two families: **display formatters** return `'—'` for null/non-finite (KPI values); **chip formatters** return `null` (so `KpiBlock`/`StatTile` detail chips are omitted — both components filter `detail?.text`).

- [ ] **Step 1: Write the failing test**

```js
// src/lib/format.test.js
import { describe, expect, test } from 'vitest';
import {
  fmtInt, fmtNum, fmtSignedInt, fmtSigned, fmtPct,
  chipSignedFlow, chipUpkeepFlow,
} from './format.js';

describe('display formatters (null → —)', () => {
  test('fmtInt rounds and groups', () => {
    expect(fmtInt(93100.4)).toBe('93,100');
    expect(fmtInt(0)).toBe('0');
    expect(fmtInt(null)).toBe('—');
    expect(fmtInt(NaN)).toBe('—');
  });

  test('fmtNum fixes decimals', () => {
    expect(fmtNum(0.0099, 2)).toBe('0.01');
    expect(fmtNum(0.037, 2)).toBe('0.04');
    expect(fmtNum(833.3043, 1)).toBe('833.3');
    expect(fmtNum(0.769, 3)).toBe('0.769');
    expect(fmtNum(null)).toBe('—');
  });

  test('fmtSignedInt signs positives', () => {
    expect(fmtSignedInt(554)).toBe('+554');
    expect(fmtSignedInt(-12)).toBe('-12');
    expect(fmtSignedInt(0)).toBe('0');
    expect(fmtSignedInt(null)).toBe('—');
  });

  test('fmtSigned signs decimals', () => {
    expect(fmtSigned(-12.9456, 1)).toBe('-12.9');
    expect(fmtSigned(3.21, 1)).toBe('+3.2');
    expect(fmtSigned(0, 1)).toBe('0.0');
    expect(fmtSigned(null)).toBe('—');
  });

  test('fmtPct converts 0..1 ratios', () => {
    expect(fmtPct(0.9847)).toBe('98%');
    expect(fmtPct(0.23)).toBe('23%');
    expect(fmtPct(1.2)).toBe('120%');
    expect(fmtPct(0.125, 1)).toBe('12.5%');
    expect(fmtPct(null)).toBe('—');
  });
});

describe('chip formatters (null → null, chip omitted)', () => {
  test('chipSignedFlow', () => {
    expect(chipSignedFlow(833.3)).toBe('+833');
    expect(chipSignedFlow(-1272)).toBe('-1,272');
    expect(chipSignedFlow(null)).toBeNull();
  });

  test('chipUpkeepFlow renders positive upkeep as a cost', () => {
    expect(chipUpkeepFlow(846.25)).toBe('-846');
    expect(chipUpkeepFlow(-5)).toBe('+5');
    expect(chipUpkeepFlow(0)).toBe('0');
    expect(chipUpkeepFlow(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/format.test.js`
Expected: FAIL — `Cannot find module './format.js'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

```js
// src/lib/format.js
// Shared number formatters. Display formatters return '—' for null/non-finite
// (KpiBlock/StatTile render the dash directly); chip formatters return null so
// detail chips are omitted entirely (both components filter on detail?.text).
const DASH = '—';

function finite(value) {
  return value != null && Number.isFinite(Number(value));
}

export function fmtInt(value) {
  if (!finite(value)) return DASH;
  return Math.round(value).toLocaleString();
}

export function fmtNum(value, digits = 2) {
  if (!finite(value)) return DASH;
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtSignedInt(value) {
  if (!finite(value)) return DASH;
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString()}`;
}

export function fmtSigned(value, digits = 1) {
  if (!finite(value)) return DASH;
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return sign + fmtNum(Math.abs(value), digits);
}

export function fmtPct(value, digits = 0) {
  if (!finite(value)) return DASH;
  return `${(value * 100).toFixed(digits)}%`;
}

export function chipSignedFlow(value) {
  if (!finite(value)) return null;
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString()}`;
}

// Positive upkeep is a cost (rendered "-846"); negative upkeep is a refund.
export function chipUpkeepFlow(value) {
  if (!finite(value)) return null;
  const rounded = Math.round(value);
  if (rounded === 0) return '0';
  return rounded > 0
    ? `-${rounded.toLocaleString()}`
    : `+${Math.abs(rounded).toLocaleString()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/format.test.js`
Expected: PASS (7 tests).

---

### Task 2: Migrate routes to shared formatters

**Files:**
- Modify: `src/routes/Status.svelte` (delete `fmtMoney`, `fmtSignedFlow`, `fmtUpkeep`; keep `fmtDeltaInt` — it returns a number for `KpiBlock`'s `delta` prop, not a string)
- Modify: `src/routes/Cropsim.svelte` (delete `fmt`, `fmtInt`, `fmtSigned`, `fmtSignedFlow`, `fmtDemandFlow`, `fmtRatio`, `fmtPct` locals)
- Modify: `src/routes/Tech.svelte` (delete `fmtInt`, `fmtSignedInt` locals)
- Modify: `src/routes/Parties.svelte` (delete `fmtPct`, `fmtPop` locals)
- Modify: `src/routes/Senate.svelte` (replace inline `Math.round(x * 100) + '%'` ternaries)
- Modify: `src/routes/GoIs.svelte` (replace inline percent expressions; keep local `formatThreshold` — it returns `null` for use in `{#if}`)

No visual change in this task — replacements are output-identical (verified: all values are < 1000 so `toLocaleString` grouping vs `toFixed` makes no difference; `Math.round(x*100)+'%'` ≡ `fmtPct(x)` for these inputs).

- [ ] **Step 1: Status.svelte**

Add to imports:
```js
import { fmtInt, chipSignedFlow, chipUpkeepFlow } from '../lib/format.js';
```
Delete the local `fmtMoney`, `fmtSignedFlow`, `fmtUpkeep` function declarations (lines 46-49, 54-66). Replace every call site in the file: `fmtMoney(` → `fmtInt(`, `fmtSignedFlow(` → `chipSignedFlow(`, `fmtUpkeep(` → `chipUpkeepFlow(`. There are call sites both in `resourceFlowDetails()` (lines 67-85) and further down in the Resource Flows `StatTile` markup — replace all. Verify none remain:

Run: `grep -n "fmtMoney\|fmtSignedFlow\|fmtUpkeep" src/routes/Status.svelte`
Expected: no output.

- [ ] **Step 2: Cropsim.svelte**

Add to imports:
```js
import { fmtInt, fmtNum, fmtSigned, fmtPct, chipSignedFlow, chipUpkeepFlow } from '../lib/format.js';
```
Delete local `fmt`, `fmtInt`, `fmtSigned`, `fmtSignedFlow`, `fmtDemandFlow`, `fmtRatio`, `fmtPct` (lines 40-103, keeping `foodFlowDetails` which stays local). Replace call sites throughout the file: `fmt(` → `fmtNum(`, `fmtRatio(` → `fmtNum(` (keep each call's existing digits argument — `fmtRatio(metrics.security_ratio, 3)` → `fmtNum(metrics.security_ratio, 3)` for now; Task 10 changes the display), `fmtSignedFlow(` → `chipSignedFlow(`, `fmtDemandFlow(` → `chipUpkeepFlow(`. `fmtInt`/`fmtSigned`/`fmtPct` keep their names (now imported). Watch the word-boundary trap: replace `fmt(` only where it is the standalone helper, not part of `fmtInt(`/`fmtSigned(` etc. — do it with individual edits, not a blind regex.

Run: `grep -n "function fmt" src/routes/Cropsim.svelte`
Expected: only `function foodFlowDetails` remains (no `function fmt*`).

- [ ] **Step 3: Tech.svelte**

Add import:
```js
import { fmtInt, fmtSignedInt } from '../lib/format.js';
```
Delete local `fmtInt` and `fmtSignedInt` (lines 37-46). Behavioural note: local `fmtInt` returned `null` for null (KpiBlock turned it into `'—'`); shared returns `'—'` directly — same render.

- [ ] **Step 4: Parties.svelte**

Add import:
```js
import { fmtInt, fmtPct } from '../lib/format.js';
```
Delete local `fmtPct` and `fmtPop` (lines 36-42). Replace `fmtPop(` → `fmtInt(` at all call sites. (Local `fmtPop` pinned `'en-US'`; shared uses the default locale like every other page — acceptable unification.)

- [ ] **Step 5: Senate.svelte**

Add import:
```js
import { fmtPct } from '../lib/format.js';
```
Replace (lines 62-63):
```svelte
<td class="num">{c.total_establishment != null ? Math.round(c.total_establishment * 100) + '%' : '—'}</td>
<td class="num">{c.total_vote_share != null ? Math.round(c.total_vote_share * 100) + '%' : '—'}</td>
```
with:
```svelte
<td class="num">{fmtPct(c.total_establishment)}</td>
<td class="num">{fmtPct(c.total_vote_share)}</td>
```
Replace in the vote-share bar (lines 79-81): `title="{seg.name} {Math.round(seg.share * 100)}%"` → `title="{seg.name} {fmtPct(seg.share)}"` and the visible `{Math.round(seg.share * 100)}%` → `{fmtPct(seg.share)}`.

- [ ] **Step 6: GoIs.svelte**

Add import:
```js
import { fmtPct } from '../lib/format.js';
```
Replace the Influence/Approval cells (lines 120, 126):
```svelte
{g.derived_influence != null ? Math.round(g.derived_influence * 100) + '%' : '—'}
```
→ `{fmtPct(g.derived_influence)}` (and the same for `g.approval`). Replace the sub-faction row meta (lines 181-182):
```svelte
{s.influence != null ? Math.round(s.influence * 100) + '%' : '—'} ·
ap {s.approval != null ? Math.round(s.approval * 100) + '%' : '—'}
```
→
```svelte
{fmtPct(s.influence)} ·
ap {fmtPct(s.approval)}
```
Keep `formatThreshold` as-is.

- [ ] **Step 7: Verify**

Run: `npx vitest run` then `npm run build`
Expected: all unit tests pass; build succeeds.

---

### Task 3: Stores clear their error on load entry (Retry prerequisite)

**Files:**
- Modify: `src/lib/stores/status.js`, `parties.js`, `situations.js`, `cropsim.js`, `map.js`, `pops.js`, `population.js`, `demographics.js`, `gois.js`, `tech.js`, `senate.js`
- Create: `src/lib/stores/error-reset.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/stores/error-reset.test.js
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { gois, goisError, loadGois } from './gois.js';

describe('loadX clears its error store on entry', () => {
  beforeEach(() => {
    gois.set(null);
    goisError.set(null);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('a retry after a failure clears the stale error', async () => {
    goisError.set('gois.json fetch failed: 500');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ gois: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ));

    await loadGois('2026-06-09T00:00:00Z');

    expect(get(goisError)).toBeNull();
    expect(get(gois)).toEqual({ gois: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/stores/error-reset.test.js`
Expected: FAIL — `expected 'gois.json fetch failed: 500' to be null`.

- [ ] **Step 3: Add the reset line to every store**

Pattern (apply to each `loadX` listed above — first statement of the function, before `try`):

```js
export async function loadGois(syncedAt) {
  goisError.set(null);
  try {
    gois.set(await fetchPage('gois', syncedAt));
  } catch (err) {
    goisError.set(err.message);
  }
}
```

Same one-liner in: `loadStatus` (`statusError`), `loadParties` (`partiesError`), `loadSituations` (`situationsError`), `loadCropsim` (`cropsimError`), `loadMap` (`mapError`), `loadPops` (`popsError`), `loadPopulation` (`populationError`), `loadDemographics` (`demographicsError`), `loadTech` (`techError`). In `senate.js`, move the existing `senateError.set(null)` from after the fetch to the first line of `loadSenate` (same behaviour, consistent shape). Do NOT touch `meta.js` (schema-mismatch banner state is sticky by design) or `history.js` (no error store).

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS, including the existing `senate.test.js`.

---

### Task 4: `PageState.svelte` + stale-banner CSS + Tailwind warn/good aliases (TDD)

**Files:**
- Create: `src/lib/components/PageState.svelte`
- Create: `src/lib/components/PageStateTestHost.svelte` (test fixture — gives the slot real content)
- Create: `src/lib/components/MoonLoaderStub.svelte` (test stub — real MoonLoader calls `canvas.getContext('2d')` unguarded, which returns `null` in jsdom)
- Create: `src/lib/components/PageState.test.js`
- Modify: `src/styles/global.css` (add `.stale-banner` near the other banner/card vocabulary, after the `.kpi-block` rules ~line 245)
- Modify: `tailwind.config.js` (add `warn` and `good` color aliases)

- [ ] **Step 1: Tailwind aliases**

In `tailwind.config.js` `theme.extend.colors`, after `crit: 'var(--crit)',` add:
```js
        warn: 'var(--warn)',
        good: 'var(--good)',
```
(Side benefit: the pre-existing `text-warn` class in `WorkforceBand.svelte`'s mismatch list — currently a silent no-op because the alias never existed — starts working.)

- [ ] **Step 2: Test stub + host components**

```svelte
<!-- src/lib/components/MoonLoaderStub.svelte -->
<script>
  export let size = 0;
  export let label = '';
</script>
<div role="status" aria-label={label} data-testid="moon-loader-stub" data-size={size}></div>
```

```svelte
<!-- src/lib/components/PageStateTestHost.svelte -->
<script>
  import PageState from './PageState.svelte';
  export let label;
  export let page = [];
  export let error = null;
  export let loading = false;
  export let loadingText = 'Loading…';
  export let retry = null;
</script>

<PageState {label} {page} {error} {loading} {loadingText} {retry}>
  <p data-testid="page-content">content</p>
</PageState>
```

- [ ] **Step 3: Write the failing tests**

```js
// src/lib/components/PageState.test.js
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { meta } from '../stores/meta.js';
import Host from './PageStateTestHost.svelte';

vi.mock('./MoonLoader.svelte', async () => ({
  default: (await import('./MoonLoaderStub.svelte')).default,
}));

const BASE_META = { synced_at: 't', schema_version: 10, senate_visible: false, partial_failures: [] };

describe('PageState', () => {
  beforeEach(() => {
    meta.set({ ...BASE_META });
  });

  test('renders slot content and sr-only h1 when loaded', () => {
    const { container, getByTestId } = render(Host, { props: { label: 'GoIs', page: 'gois' } });
    expect(getByTestId('page-content')).toBeTruthy();
    const h1 = container.querySelector('h1.sr-only');
    expect(h1?.textContent).toBe('GoIs');
  });

  test('loading state shows MoonLoader + loadingText, hides content', () => {
    const { queryByTestId, getByText } = render(Host, {
      props: { label: 'GoIs', page: 'gois', loading: true, loadingText: 'Reading factions…' },
    });
    expect(queryByTestId('moon-loader-stub')).toBeTruthy();
    expect(getByText('Reading factions…')).toBeTruthy();
    expect(queryByTestId('page-content')).toBeNull();
  });

  test('error state wins over loading and fires retry', async () => {
    const retry = vi.fn();
    const { getByText, getByRole, queryByTestId } = render(Host, {
      props: { label: 'GoIs', page: 'gois', error: 'gois.json fetch failed: 500', loading: true, retry },
    });
    expect(getByText('Failed to load GoIs')).toBeTruthy();
    expect(getByText('gois.json fetch failed: 500')).toBeTruthy();
    expect(queryByTestId('moon-loader-stub')).toBeNull();
    await fireEvent.click(getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  test('stale banner shows when the page key is in partial_failures', () => {
    meta.set({ ...BASE_META, partial_failures: ['gois'] });
    const { container } = render(Host, { props: { label: 'GoIs', page: 'gois' } });
    expect(container.querySelector('.stale-banner')).toBeTruthy();
  });

  test('array page prop matches any failed key', () => {
    meta.set({ ...BASE_META, partial_failures: ['status'] });
    const { container } = render(Host, {
      props: { label: 'Cropsim', page: ['cropsim', 'status'] },
    });
    expect(container.querySelector('.stale-banner')).toBeTruthy();
  });

  test('no banner when the page did not fail', () => {
    meta.set({ ...BASE_META, partial_failures: ['gois'] });
    const { container } = render(Host, { props: { label: 'Parties', page: ['parties', 'pops'] } });
    expect(container.querySelector('.stale-banner')).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/lib/components/PageState.test.js`
Expected: FAIL — cannot resolve `./PageState.svelte`.

- [ ] **Step 5: Implement the component**

```svelte
<!-- src/lib/components/PageState.svelte -->
<script>
  // Presentational page chrome: sr-only h1, stale-sync banner, error card
  // with Retry, MoonLoader loading state, then the slot. Routes own their
  // stores and loading conditions — this component never fetches.
  import { meta } from '../stores/meta.js';
  import MoonLoader from './MoonLoader.svelte';

  export let label;
  /** @type {string | string[]} page key(s) checked against meta.partial_failures */
  export let page = [];
  export let error = null;
  export let loading = false;
  export let loadingText = 'Loading…';
  export let retry = null;

  $: pageKeys = Array.isArray(page) ? page : [page];
  $: stale = ($meta?.partial_failures ?? []).some((k) => pageKeys.includes(k));
</script>

<h1 class="sr-only">{label}</h1>

{#if stale}
  <div class="stale-banner" role="status">
    <span class="stale-banner-icon" aria-hidden="true">⚠</span>
    <span>This page failed to sync — showing data from the last successful update.</span>
  </div>
{/if}

{#if error}
  <div class="s-card s-card-pad">
    <strong class="uppercase tracking-widest text-[10px] text-crit">Failed to load {label}</strong>
    <p class="text-muted text-xs m-0 mt-1">{error}</p>
    {#if retry}
      <button
        type="button"
        class="mt-3 border-2 border-border px-3 py-2 text-xs uppercase tracking-widest hover:border-accent"
        on:click={retry}
      >Retry</button>
    {/if}
  </div>
{:else if loading}
  <div class="flex flex-col items-center justify-center py-12 gap-4">
    <MoonLoader size={220} label={`Loading ${label}`} />
    <p class="text-muted text-xs uppercase tracking-widest">{loadingText}</p>
  </div>
{:else}
  <slot />
{/if}
```

- [ ] **Step 6: Add `.stale-banner` to `global.css`**

Insert after the `.kpi-subtitle` rule block (~line 245), with the other card vocabulary:

```css
/* Stale-sync banner — PageState renders this when the route's page key is in
   meta.partial_failures. Body text stays --fg for small-text AA; the warn
   token carries the border + icon only. */
.stale-banner {
  display: flex;
  align-items: baseline;
  gap: 10px;
  border: 2px solid var(--warn);
  background: var(--bg-2);
  color: var(--fg);
  padding: 10px 14px;
  margin-bottom: 12px;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.stale-banner .stale-banner-icon {
  color: var(--warn);
  font-size: 14px;
}
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/lib/components/PageState.test.js`
Expected: PASS (6 tests).

---

### Task 5: Adopt PageState — GoIs, Parties, Tech, Senate, Situations, Map

**Files:**
- Modify: `src/routes/GoIs.svelte:89-94`, `src/routes/Parties.svelte:53-57`, `src/routes/Tech.svelte:49-53`, `src/routes/Senate.svelte:24-28`, `src/routes/Situations.svelte:35-39`, `src/routes/Map.svelte:162-166`

Mechanical pattern per route: add the import, replace the `{#if error}…{:else if !data}…{:else}` shell's first two branches with a `<PageState …>` opening tag, and replace the closing `{/if}` with `</PageState>`. Leave all slot content (the old `{:else}` body) untouched — Svelte does not care about its indentation. Each route keeps `onMount` exactly as is.

- [ ] **Step 1: GoIs.svelte**

Add import: `import PageState from '../lib/components/PageState.svelte';`

Replace:
```svelte
<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px] gois-page">
  {#if $goisError}
    <p class="text-crit">{$goisError}</p>
  {:else if !$gois}
    <p class="text-muted text-xs uppercase tracking-widest">Loading…</p>
  {:else}
```
with:
```svelte
<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px] gois-page">
  <PageState
    label="GoIs"
    page="gois"
    error={$goisError}
    loading={!$gois}
    retry={() => loadGois($meta.synced_at)}
  >
```
And the section's final `{/if}` (just before `</section>`) → `</PageState>`.

Then add the in-route empty state: immediately after the `<Band num="01" title="Groups of Interest" …/>` line, insert:
```svelte
    {#if $gois.gois.length === 0}
      <div class="s-card s-card-pad">
        <p class="text-muted text-sm">No GoIs recorded in this sync.</p>
      </div>
    {/if}
```

- [ ] **Step 2: Parties.svelte**

Import PageState. Replace lines 54-57 (`{#if errorMsg}` / error p / `{:else if !$parties || !$pops}` / loading p / up to `{:else}`) with:
```svelte
  <PageState
    label="Parties"
    page={['parties', 'pops']}
    error={errorMsg}
    loading={!$parties || !$pops}
    retry={() => { loadParties($meta.synced_at); loadPops($meta.synced_at); }}
  >
```
Final `{/if}` → `</PageState>`. Note the page keys include `pops` — this route joins two JSON files.

- [ ] **Step 3: Tech.svelte**

Import PageState. Replace the first two branches (lines 50-53):
```svelte
  <PageState
    label="Tech"
    page="tech"
    error={$techError}
    loading={!$tech}
    retry={() => loadTech($meta.synced_at)}
  >
    {#if empty}
      …existing empty card unchanged…
    {:else}
      …existing tree unchanged…
    {/if}
  </PageState>
```
Concretely: the existing `{#if $techError}…{:else if !$tech}…{:else if empty}` becomes `<PageState …>` followed by `{#if empty}`; the existing `{:else}` and body stay; final `{/if}` → `{/if}\n  </PageState>`.

- [ ] **Step 4: Senate.svelte**

Import PageState. Same transformation of lines 25-28; the `{:else if $senate.placeholder_note}` branch becomes the slot's leading `{#if $senate.placeholder_note}`:
```svelte
  <PageState
    label="Senate"
    page="senate"
    error={$senateError}
    loading={!$senate}
    retry={() => loadSenate($meta.synced_at)}
  >
    {#if $senate.placeholder_note}
      …placeholder card unchanged…
    {:else}
      …coalitions content unchanged…
    {/if}
  </PageState>
```

- [ ] **Step 5: Situations.svelte**

Import PageState. Replace lines 36-39's two branches; the `{:else if empty}` branch becomes `{#if empty}…{:else}…{/if}` inside the slot (same shape as Tech):
```svelte
  <PageState
    label="Situations"
    page="situations"
    error={$situationsError}
    loading={!$situations}
    retry={() => loadSituations($meta.synced_at)}
  >
```

- [ ] **Step 6: Map.svelte**

Import PageState. Replace lines 163-166:
```svelte
  <PageState
    label="Map"
    page="map"
    error={$mapError}
    loading={!$map}
    retry={() => loadMap($meta.synced_at)}
  >
```
Final `{/if}` before `</section>` → `</PageState>`. (Map's `$meta` import already exists; verify `loadMap` is imported — it is, via the onMount.)

- [ ] **Step 7: Verify**

Run: `npx vitest run && npm run build`
Expected: PASS / build success. Then a quick smoke: `npx playwright test tests-e2e/tech.spec.js`
Expected: PASS (Tech renders through PageState; mocked tree unaffected).

---

### Task 6: Adopt PageState — Status, Demographics, Cropsim

**Files:**
- Modify: `src/routes/Status.svelte:88-95`, `src/routes/Demographics.svelte:121-128`, `src/routes/Cropsim.svelte:106-113`

These three currently render MoonLoader inline — after this task the `MoonLoader` import is unused in each; remove it.

- [ ] **Step 1: Status.svelte**

Import PageState; remove the `MoonLoader` import. Replace lines 89-95:
```svelte
  <PageState
    label="Status"
    page="status"
    error={$statusError}
    loading={!$status}
    loadingText="Reading status panel…"
    retry={() => { loadStatus($meta.synced_at); loadHistory($meta.synced_at); }}
  >
```
Note the old error line included a prefix ("Failed to load status: …") — PageState's error card supersedes it. Final `{/if}` → `</PageState>`.

- [ ] **Step 2: Demographics.svelte**

Import PageState; remove the `MoonLoader` import. Replace lines 122-128:
```svelte
  <PageState
    label="Demographics"
    page={['demographics', 'pops', 'population']}
    error={errorMsg}
    loading={!ready}
    loadingText="Reading vital signs…"
    retry={() => {
      loadPops($meta.synced_at);
      loadPopulation($meta.synced_at);
      loadDemographics($meta.synced_at);
      loadHistory($meta.synced_at);
    }}
  >
```

- [ ] **Step 3: Cropsim.svelte**

Import PageState; remove the `MoonLoader` import. Replace lines 107-113 (keep the `{:else if empty}` branch as the slot's leading `{#if empty}…{:else}…{/if}`, same shape as Tech):
```svelte
  <PageState
    label="Cropsim"
    page={['cropsim', 'status']}
    error={$cropsimError}
    loading={!ready}
    loadingText="Reading food economy..."
    retry={() => { loadCropsim($meta.synced_at); loadStatus($meta.synced_at); }}
  >
```

- [ ] **Step 4: Verify**

Run: `npx vitest run && npm run build`
Expected: `src/routes/Status.test.js` still passes (it renders the loaded state; PageState renders the slot when not loading/error). Then `npx playwright test tests-e2e/cropsim.spec.js` — Expected: PASS.

---

### Task 7: SyncChip warn state

**Files:**
- Modify: `src/lib/components/SyncChip.svelte` (full replacement below)
- Create: `src/lib/components/SyncChip.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/components/SyncChip.test.js
import { describe, expect, test, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { meta } from '../stores/meta.js';
import SyncChip from './SyncChip.svelte';

describe('SyncChip', () => {
  beforeEach(() => {
    meta.set(null);
  });

  test('partial failures render the warn state with ⚠ and failed pages in title', () => {
    meta.set({ synced_at: new Date().toISOString(), partial_failures: ['gois', 'tech'] });
    const { container } = render(SyncChip);
    const chip = container.querySelector('span.border-warn');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('⚠');
    expect(chip.getAttribute('title')).toContain('gois');
    expect(chip.getAttribute('title')).toContain('tech');
  });

  test('stale beats partial', () => {
    meta.set({ synced_at: '2020-01-01T00:00:00Z', partial_failures: ['gois'] });
    const { container } = render(SyncChip);
    expect(container.querySelector('span.border-crit')).toBeTruthy();
    expect(container.querySelector('span.border-warn')).toBeNull();
  });

  test('clean sync renders the normal state', () => {
    meta.set({ synced_at: new Date().toISOString(), partial_failures: [] });
    const { container } = render(SyncChip);
    expect(container.querySelector('span.border-border')).toBeTruthy();
    expect(container.textContent).not.toContain('⚠');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/components/SyncChip.test.js`
Expected: FAIL — no `.border-warn` element.

- [ ] **Step 3: Implement**

Replace `src/lib/components/SyncChip.svelte` with:

```svelte
<script>
  import { meta } from '../stores/meta.js';
  import { isStale, formatSyncedAt } from '../sync-chip-utils.js';

  $: synced = $meta?.synced_at ?? null;
  $: stale = isStale(synced);
  $: failedPages = $meta?.partial_failures ?? [];
  $: partial = !stale && failedPages.length > 0;
  $: label = formatSyncedAt(synced);
  $: title = stale
    ? 'Sync is stale (> 3h old)'
    : partial
      ? `Partial sync — failed: ${failedPages.join(', ')}`
      : 'Last sync time';
</script>

<span
  class="px-3 py-1 border-2 font-mono text-xs uppercase tracking-widest"
  class:border-border={!stale && !partial}
  class:text-fg={!stale && !partial}
  class:border-crit={stale}
  class:text-crit={stale}
  class:border-warn={partial}
  class:text-warn={partial}
  {title}
>
  {#if partial}<span aria-hidden="true">⚠ </span><span class="sr-only">Partial sync failure — </span>{/if}Synced {label}
</span>
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/components/SyncChip.test.js`
Expected: PASS (3 tests).

---

### Task 8: E2E — partial failures end to end

**Files:**
- Create: `tests-e2e/partial-failures.spec.js`

- [ ] **Step 1: Write the spec**

```js
// tests-e2e/partial-failures.spec.js
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const MOCK_META = {
  synced_at: 'playwright-partial',
  schema_version: 10,
  senate_visible: false,
  partial_failures: ['gois'],
};

async function mockPartialFailure(page) {
  await page.route('**/data/meta.json?*', (route) => route.fulfill({ json: MOCK_META }));
  await page.route('**/data/gois.json?*', (route) =>
    route.fulfill({ json: { gois: [], pop_capture_matrix: { classes: [], gois: [], values: [] } } }));
  await page.route('**/data/parties.json?*', (route) =>
    route.fulfill({ json: { parties: [], class_compat_matrix: null, party_capture_pct_matrix: null, party_capture_pop_matrix: null } }));
  await page.route('**/data/pops.json?*', (route) => route.fulfill({ json: { classes: [] } }));
}

test('failed page shows the stale banner and the nav warn chip', async ({ page }) => {
  await mockPartialFailure(page);
  await page.goto('/#/gois');
  await expect(page.locator('.stale-banner')).toBeVisible();
  await expect(page.locator('.stale-banner')).toContainText('failed to sync');
  await expect(page.locator('nav .border-warn')).toBeVisible();
  await expect(page.locator('nav .border-warn')).toContainText('⚠');

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('unaffected page has no banner but keeps the nav warn chip', async ({ page }) => {
  await mockPartialFailure(page);
  await page.goto('/#/parties');
  await expect(page.locator('.band-title', { hasText: 'Founded Parties' })).toBeVisible();
  await expect(page.locator('.stale-banner')).toHaveCount(0);
  await expect(page.locator('nav .border-warn')).toBeVisible();
});
```

(`situations.json` is deliberately not mocked — the real file may put the app in crisis mode, which must coexist with the stale banner; the assertions above don't conflict with `CrisisBanner` because they target `.stale-banner` specifically.)

- [ ] **Step 2: Run it**

Run: `npx playwright test tests-e2e/partial-failures.spec.js`
Expected: PASS (2 tests). The axe scan with the banner + warn chip visible is the contrast gate for the new warn treatments in the default (schematic) theme.

---

### Task 9: A11y baseline — skip link, landmark, focus, aria-current, real headings

**Files:**
- Modify: `src/App.svelte`
- Modify: `src/lib/components/NavBar.svelte`
- Modify: `src/lib/components/Band.svelte`
- Modify: `src/styles/global.css` (`.skip-link`)

- [ ] **Step 1: App.svelte — skip link, `<main>`, focus management**

Script changes — replace the `import Router from 'svelte-spa-router';` line with:
```js
import Router, { location } from 'svelte-spa-router';
```
Add after the `routes` map:
```js
  let mainEl;
  let routeInitialized = false;
  // Route change → move focus to the main landmark + scroll to top.
  // Skips the initial value so page load doesn't steal focus.
  $: handleRouteChange($location);
  function handleRouteChange(_loc) {
    if (!routeInitialized) {
      routeInitialized = true;
      return;
    }
    requestAnimationFrame(() => {
      mainEl?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    });
  }
```
(`handleRouteChange` deliberately takes `$location` as an argument so the reactive statement depends only on the location store, not on `mainEl`.)

Markup: insert the skip link as the first child of the outer div, and wrap the Router in `<main>`:
```svelte
<div class="relative min-h-screen bg-bg text-fg font-mono">
  <a href="#main" class="skip-link" on:click|preventDefault={() => mainEl?.focus()}>Skip to content</a>
  {#if !$metaError}
    <MoonBackdrop />
  {/if}
  <div class="relative z-10">
    {#if $metaError}
      <MaintenanceBanner metaError={$metaError} />
    {:else if !$meta}
      <div class="min-h-screen flex flex-col items-center justify-center gap-6">
        <MoonLoader size={320} label="Loading colony data" />
        <p class="text-muted text-xs uppercase tracking-widest">Synchronising colony record…</p>
      </div>
    {:else}
      <NavBar />
      <CrisisBanner />
      <main id="main" tabindex="-1" bind:this={mainEl} class="outline-none">
        <Router {routes} />
      </main>
    {/if}
  </div>
  <CrisisFrame />
</div>
```
The `href="#main"` is for semantics only — the click handler `preventDefault()`s so the hash router never sees it (a bare hash change would be parsed as a route).

- [ ] **Step 2: `.skip-link` CSS**

Add to `global.css` near the top-level layout rules (after the theme blocks):
```css
/* Skip-to-content link: visually hidden until keyboard focus. */
.skip-link {
  position: fixed;
  top: -100px;
  left: 12px;
  z-index: 100;
  padding: 10px 16px;
  background: var(--bg);
  color: var(--fg);
  border: 2px solid var(--accent);
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.skip-link:focus {
  top: 12px;
}
```

- [ ] **Step 3: NavBar `aria-current`**

In both the desktop `<ul>` (line ~48) and mobile menu `<ul>` (line ~71) anchors, add:
```svelte
aria-current={$location === p.path ? 'page' : undefined}
```

- [ ] **Step 4: Band heading**

In `src/lib/components/Band.svelte`, replace:
```svelte
<span class="band-title">{title}</span>
```
with:
```svelte
<h2 class="band-title">{title}</h2>
```
(Tailwind preflight zeroes heading margins and font sizing, and `.band-title` sets size/weight explicitly — no CSS change needed. Verify visually in Step 6.)

- [ ] **Step 5: Unit + e2e checks**

Run: `npx vitest run && npm run build && npx playwright test tests-e2e/a11y.spec.js`
Expected: all pass. The a11y suite (38 scans + drilldown states) is the gate for the new `<main>`/skip-link/heading structure across all three themes and both viewports.

- [ ] **Step 6: Visual check of bands**

Run: `node output/design-review/shoot.cjs` against a fresh preview (or `npx vite preview --port 4173` + manual look) and compare band headers on Status/Demographics with the pre-change screenshots in `output/design-review/` — title size/tracking must be unchanged.

---

### Task 10: Visual consistency — percents, precision, growth subtitle, KPI scale

**Files:**
- Modify: `src/routes/Demographics.svelte`
- Modify: `src/routes/Cropsim.svelte`
- Modify: `src/lib/components/WorkforceBand.svelte`
- Modify: `src/styles/global.css` (`.kpi-row-secondary`)
- Modify: `tests-e2e/cropsim.spec.js` (expectation updates)

- [ ] **Step 1: Demographics — Avg Satisfaction as percent, Predicted Growth subtitle**

Add import: `import { fmtPct, fmtSignedInt } from '../lib/format.js';`

Replace the Avg Satisfaction KPI value (line 138):
```svelte
value={$demographics.totals.avg_satisfaction?.toFixed(2) ?? '—'}
```
→
```svelte
value={fmtPct($demographics.totals.avg_satisfaction)}
```

Delete the `predictedGrowthDisplay` reactive block (lines 60-62) and change the Predicted Growth KPI (lines 147-153) to:
```svelte
      <KpiBlock
        label="Predicted Growth"
        value={predictedGrowth == null ? null : fmtSignedInt(predictedGrowth)}
        subtitle={predictedGrowth == null ? null : 'per year'}
        history={$populationDeltaHistory.length >= 2 ? $populationDeltaHistory : null}
        critical={predictedGrowth != null && predictedGrowth < 0}
        good={predictedGrowth != null && predictedGrowth > 0}
      />
```

Also migrate the workforce fill display (lines 68-70) to the shared helper for consistency:
```js
$: workforceFillDisplay = workforceFill == null ? null : fmtPct(workforceFill, 1);
```

- [ ] **Step 2: Cropsim — Security Ratio percent, two-decimal indices**

In the KPI row (lines 126-130), change three values:
```svelte
      <KpiBlock label="Security Ratio" value={fmtPct(metrics.security_ratio)} tone={securityTone} />
      <KpiBlock label="Food / Cap" value={fmtNum(metrics.per_cap, 2)} />
      <KpiBlock label="Variety Index" value={fmtNum(metrics.variety_index, 2)} />
```
**Keep `securityTone` exactly as is** — its domain thresholds (`< 0.95` crit, `< 1` warn, else good) are correct for food security, where ~1.0 is the target. Do NOT swap in `statusMetricTone` (0.33/0.66 cutoffs) — that would paint a starving colony green. (The spec's §4.1 wording is amended in Task 12.)

- [ ] **Step 3: Workforce band scale cap**

Root cause: `.kpi-num` is `clamp(1.25rem, 18cqi, 56px)` (container-query scaled). The Workforce band's 3-up grid yields ~470px tiles → the numbers hit the 56px cap, out-shouting the 5-up headline KPI row (~48px). Cropsim already established the wrapper-override precedent (`.cropsim-kpis … { font-size: 42px }`).

In `WorkforceBand.svelte` line 21, add the wrapper class:
```svelte
  <div class="grid grid-cols-2 md:grid-cols-3 gap-3 kpi-row-secondary">
```

In `global.css`, after the `.kpi-block .kpi-num.muted` rule (~line 236), add:
```css
/* Secondary KPI rows: cap the container-query auto-fit below the headline
   56px so support bands (e.g. Demographics Workforce) never out-shout the
   page's vital signs. */
.kpi-row-secondary .kpi-block .kpi-num {
  font-size: clamp(1.25rem, 18cqi, 42px);
}
```

- [ ] **Step 4: Update e2e expectations that pinned the old formats**

In `tests-e2e/cropsim.spec.js` line 65, change:
```js
await expect(page.locator('.kpi-block', { hasText: 'Security Ratio' })).toContainText('0.985');
```
→
```js
await expect(page.locator('.kpi-block', { hasText: 'Security Ratio' })).toContainText('98%');
```
Then sweep for any other assertions pinning the old displays:

Run: `grep -rn "0\.985\|0\.23\|/ year\|toFixed(2)" tests-e2e/ src/routes/*.test.js src/lib/components/*.test.js`
Expected: no remaining assertion expects the decimal Avg Satisfaction, the old Security Ratio decimal, or the `+N / year` single-string value. Update any hit the same way (decimal → percent / value + subtitle).

- [ ] **Step 5: Verify**

Run: `npx vitest run && npx playwright test tests-e2e/cropsim.spec.js tests-e2e/mobile-flow.spec.js`
Expected: PASS. Re-shoot `schematic-demographics.png` via `output/design-review/shoot.cjs` and confirm: Avg Satisfaction shows `23%`-style percent, Predicted Growth shows `+554` with a small `per year` subtitle on one line, Workforce numbers no longer dwarf the Pop Dynamics row.

---

### Task 11: GoIs rail empty state + Cropsim padding + dead-code removal

**Files:**
- Modify: `src/lib/components/SubFactionPanel.svelte:37-41`
- Modify: `src/styles/global.css` (`.s-rail-empty`, ~line 1266)
- Modify: `src/routes/Cropsim.svelte:106`
- Modify: `src/App.svelte` (remove EmptyPage import)
- Delete: `src/routes/EmptyPage.svelte`

- [ ] **Step 1: SubFactionPanel empty state → inspector pattern**

Replace the empty branch (lines 37-41):
```svelte
{#if subfaction == null}
  <div class="s-rail-empty" role="region" aria-label="Sub-faction detail">
    <div class="s-rail-empty-icon" aria-hidden="true">◇</div>
    <p>Select a sub-faction to inspect</p>
  </div>
{:else}
```
with (reuses the Map inspector's empty-state classes — `.inspector-empty-head/-hints/-key` already exist in `global.css:882-905`):
```svelte
{#if subfaction == null}
  <div class="s-rail-empty" role="region" aria-label="Sub-faction detail">
    <p class="inspector-empty-head">Inspect a sub-faction</p>
    <ul class="inspector-empty-hints">
      <li><span class="inspector-empty-key">click</span> a sub-faction row on a GoI card</li>
      <li><span class="inspector-empty-key">esc</span> to close the panel</li>
    </ul>
  </div>
{:else}
```

- [ ] **Step 2: Restyle `.s-rail-empty` for left-aligned hint content**

In `global.css` (block starts at line 1266; Read lines 1260-1290 first to see the full block), change exactly three properties of `.s-rail-empty` — `align-items: center;` → `align-items: stretch;`, `justify-content: center;` → `justify-content: flex-start;`, `text-align: center;` → `text-align: left;` — preserving every other declaration in the block (border/padding/min-height etc.). Delete the now-orphaned `.s-rail-empty-icon` rule (line 1279).

- [ ] **Step 3: Cropsim mobile padding**

`src/routes/Cropsim.svelte` line 106:
```svelte
<section class="px-6 py-5 max-w-[1600px]">
```
→
```svelte
<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px]">
```

- [ ] **Step 4: Delete the dead EmptyPage route**

Remove from `src/App.svelte`: `import EmptyPage from './routes/EmptyPage.svelte';` (line 26 — it is absent from the `routes` map, pure dead code). Delete the file `src/routes/EmptyPage.svelte`.

- [ ] **Step 5: Verify**

Run: `npx vitest run && npm run build && npx playwright test tests-e2e/a11y.spec.js tests-e2e/mobile-flow.spec.js`
Expected: PASS (the GoIs a11y scans cover the restyled rail; mobile-flow covers the Cropsim padding change).

---

### Task 12: Docs — CLAUDE.md + spec amendments

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-06-09-frontend-hardening-design.md`

- [ ] **Step 1: CLAUDE.md gotcha #6 (partial_failures — now implemented)**

Replace the gotcha #6 entry with:
```markdown
6. **`partial_failures` in meta.json.** When an extractor crashes, sync continues without that page and records the page key. The frontend surfaces it: `PageState.svelte` renders a warn-toned `.stale-banner` ("this page failed to sync — showing data from the last successful update") on affected routes, and `SyncChip` switches to a warn state (⚠ prefix, failed pages in the title); the stale-sync crit state (> 3h) outranks it. Page keys match the extractor registry in `sync_sheet.py` plus `senate`; multi-source routes pass arrays (Demographics `['demographics','pops','population']`, Cropsim `['cropsim','status']`, Parties `['parties','pops']`).
```

- [ ] **Step 2: CLAUDE.md gotcha #14 (MoonLoader theme staleness — stale claim)**

In gotcha #14, replace the sentence:
```
`MoonLoader` does NOT yet — if you flip themes during a long load, the loader colours stale until the next data/layer change.
```
with:
```
`MoonLoader` also redraws on theme flips via its reactive `currentTheme` guard, so both canvases stay theme-correct.
```

- [ ] **Step 3: CLAUDE.md convention #34 (Avg Satisfaction percent)**

In convention #34, replace:
```
Demographics' Avg Satisfaction KPI also uses `statusMetricTone()` on `totals.avg_satisfaction` while keeping its decimal display,
```
with:
```
Demographics' Avg Satisfaction KPI also uses `statusMetricTone()` on `totals.avg_satisfaction` and renders it as a percent via the shared `fmtPct`,
```
And append to the end of #34:
```
Cropsim's Security Ratio also displays as a percent but keeps its own domain thresholds (< 0.95 crit, < 1 warn, ≥ 1 good) — do NOT replace them with `statusMetricTone`'s 0.33/0.66 cutoffs; food security targets ~1.0.
```

- [ ] **Step 4: CLAUDE.md gotcha #49 (Predicted Growth example)**

In convention #49, replace `Demographics \`Predicted Growth\` at \`+241 / year\`` with `Demographics \`Predicted Growth\` at \`+241\``.

- [ ] **Step 5: CLAUDE.md convention #12 (design vocabulary additions)**

In convention #12's class enumeration, extend the `.inspector-empty-*` entry to:
```
`.inspector-empty-head`/`.inspector-empty-hints`/`.inspector-empty-key` (empty-state with keyboard hints — Map right rail and the GoIs sub-faction rail), `.stale-banner` (PageState partial-sync warning strip), `.skip-link` (App-level skip-to-content, visible on focus), `.kpi-row-secondary` (caps secondary KPI rows at 42px so they don't out-shout headline KPIs)
```

- [ ] **Step 6: CLAUDE.md new convention #55 (PageState)**

Append after convention #54:
```markdown
55. **Page chrome is `PageState.svelte`.** Every route wraps its content in `src/lib/components/PageState.svelte` (`label`, `page` key(s) for `meta.partial_failures`, `error`, `loading`, optional `loadingText`/`retry`): it renders an sr-only `<h1>`, the `.stale-banner`, an error card with Retry, the canonical `MoonLoader` loading state, then the slot. It is presentational only — routes own their stores and loading conditions (Demographics joins three stores, Tech resolves 404 → empty sentinel, Cropsim borrows the status store). All `loadX()` store functions clear their error store on entry so Retry works; keep that invariant for new stores. Don't reintroduce per-route `<p>Loading…</p>` shells or raw `{$xError}` dumps. The skip link + `<main id="main" tabindex="-1">` landmark live in `App.svelte`; route changes focus `main` and scroll to top (initial load skipped). `Band` titles are real `<h2>`s.
```

- [ ] **Step 7: Spec amendments**

In `docs/superpowers/specs/2026-06-09-frontend-hardening-design.md`:
1. Mapping table: change the Parties row from `'parties'` to `['parties', 'pops']` (the route also loads pops.json).
2. §4.1: replace `**Cropsim · Security Ratio**: \`0.769\` → \`77%\`, toned via \`statusMetricTone()\`.` with `**Cropsim · Security Ratio**: \`0.769\` → \`77%\`; keeps Cropsim's domain \`securityTone\` thresholds (< 0.95 crit, < 1 warn, ≥ 1 good) — \`statusMetricTone\`'s generic 0.33/0.66 cutoffs would mistone food security.`

---

### Task 13: Full verification

- [ ] **Step 1: Unit suite**

Run: `npm run test -- run`
Expected: all Vitest suites pass (format, error-reset, PageState, SyncChip, plus all pre-existing).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 3: Full Playwright suite**

Ensure no stray preview server is on port 4173, then:
Run: `npx playwright test`
Expected: all specs pass — a11y (×38 + drilldowns), mobile-flow, map, map-zoom, tech, cropsim, partial-failures. Known Windows quirk (CLAUDE.md gotcha #30): late connection-refused noise after otherwise-green specs can occur; rerun the affected spec to confirm.

- [ ] **Step 4: Visual regression pass**

Re-run `node output/design-review/shoot.cjs` against a fresh build+preview and eyeball against the originals in `output/design-review/`: bands unchanged, Demographics hierarchy fixed, Cropsim percents, GoIs rail hints, all three themes via the dark/light shots.

- [ ] **Step 5: Ask the user how to structure the commit(s)**

Per the user's standing preference: no commits were made during execution. Present the changed-file list grouped by concern (formatters/PageState+stores/SyncChip/a11y/visual/docs) and ask whether they want one commit, or a small series (e.g. `feat: shared formatters`, `feat: PageState + partial_failures surfacing`, `feat: a11y baseline`, `fix: visual consistency`, `docs: CLAUDE.md updates`).
