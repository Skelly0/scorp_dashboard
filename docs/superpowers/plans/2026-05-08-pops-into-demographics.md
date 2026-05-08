# Pops → Demographics merge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the standalone `/pops` page into `/demographics` so each Class Vitals row pins a per-class detail band beneath the table; drop the old `/pops` route; replace the misleading Living Standards bars with a key-value list.

**Architecture:** Frontend-only. New `ClassDetail.svelte` component owns the per-class card grid (six cards). `Demographics.svelte` owns selection state, row-as-button affordance, Esc-to-collapse, and conditional rendering of the detail band between Class Vitals and Workforce. Detail band is unnumbered to avoid renumbering downstream bands when toggled. No backend / extractor / schema-version change; `pops.json` shape and `pops.js` store are untouched.

**Tech Stack:** Svelte 4, Vite, Playwright + axe-core for e2e a11y, vitest for unit tests (not used here), `svelte-spa-router` for hash routing.

**Spec:** `docs/superpowers/specs/2026-05-08-pops-into-demographics-design.md`

**Worktree:** This plan is to be executed in an isolated worktree. The executor invokes `superpowers:using-git-worktrees` before Task 1. The user's standing memory defers commits to the end — there are NO per-task commits in this plan; the final commit step is in Task 7 and asks the user how to structure it.

---

## File structure

**Create:**
- `src/lib/components/ClassDetail.svelte` — per-class card grid (six cards). Read-only. Props: `{ cls }`.

**Modify:**
- `src/routes/Demographics.svelte` — add selection state, click/keyboard handlers on Class Vitals rows, Esc handler, conditional detail band, scrollIntoView, scoped `.selected-row` style.
- `src/App.svelte` — drop `Pops` import + `'/pops'` route entry.
- `src/lib/components/NavBar.svelte` — drop `/pops` entry from `ALL_PAGES`.
- `tests-e2e/a11y.spec.js` — drop `/#/pops` from `PAGES`; add interactive a11y case for `/#/demographics` with detail open.
- `tests-e2e/demographics.spec.js` — add a `describe` block of class-drilldown interaction cases.
- `CLAUDE.md` — Layout list adds `ClassDetail`; gotcha #16 rewritten.

**Delete:**
- `src/routes/Pops.svelte`

**Untouched:**
- `src/lib/stores/pops.js`, `pops.json`, every extractor, schema validator, `meta.js`, `WorkforceBand.svelte`, `Band.svelte`, all CSS in `src/styles/global.css`.

---

### Task 0: Set up worktree

**Files:** none.

- [ ] **Step 1: Invoke the worktree skill.**

The executor must call `superpowers:using-git-worktrees` before any code change. The skill creates an isolated worktree branched from `origin/main` and switches the session into it.

- [ ] **Step 2: Sanity-check.**

Run: `git status`
Expected: clean working tree on a new branch (e.g. `pops-into-demographics` or generated name).

Run: `npm install` (if `node_modules` is empty in the new worktree)
Expected: dependencies install successfully.

---

### Task 1: Add failing e2e tests for the merge

**Why first:** Pin behaviour before implementing. The new tests fail until Task 3 wires Demographics; the dropped `/#/pops` from a11y matches Task 4's deletion.

**Files:**
- Modify: `tests-e2e/a11y.spec.js`
- Modify: `tests-e2e/demographics.spec.js`

- [ ] **Step 1: Drop `/#/pops` from the a11y route list and add the interactive case.**

Open `tests-e2e/a11y.spec.js`. Replace the `PAGES` constant on line 4:

```js
const PAGES = ['/', '/#/map', '/#/population', '/#/pops', '/#/demographics', '/#/gois', '/#/parties', '/#/situations'];
```

with:

```js
const PAGES = ['/', '/#/map', '/#/population', '/#/demographics', '/#/gois', '/#/parties', '/#/situations'];
```

At the bottom of the file (after the existing GoIs rail loops), append:

```js
// Demographics with class detail open — not reachable from a default page-load
// scan, so we sweep it explicitly per theme.
for (const theme of THEMES) {
  test(`a11y: ${theme} theme — /#/demographics with class detail open`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate((t) => {
      localStorage.setItem('theme', t);
    }, theme);
    await page.goto('/#/demographics');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('table.tbl tbody tr', { timeout: 10_000 });
    await page.locator('table.tbl tbody tr').first().click();
    await page.waitForSelector('text=per-class drilldown');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
```

- [ ] **Step 2: Add the class-drilldown describe block to demographics.spec.js.**

Open `tests-e2e/demographics.spec.js`. After the existing `test.describe('Demographics page — workforce rework', …)` block (line 75), append:

```js
test.describe('Demographics — class drilldown', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/demographics');
    await expect(page.locator('text=Pop Dynamics')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table.tbl tbody tr').first()).toBeVisible();
  });

  test('clicking a class row opens the detail band with that class name', async ({ page }) => {
    const firstRow = page.locator('table.tbl tbody tr').first();
    const className = (await firstRow.locator('td').first().innerText()).trim();
    await firstRow.click();
    await expect(page.locator('.band-title', { hasText: className })).toBeVisible();
    await expect(page.locator('text=per-class drilldown')).toBeVisible();
  });

  test('clicking the same row a second time collapses the detail band', async ({ page }) => {
    const firstRow = page.locator('table.tbl tbody tr').first();
    await firstRow.click();
    await expect(page.locator('text=per-class drilldown')).toBeVisible();
    await firstRow.click();
    await expect(page.locator('text=per-class drilldown')).toHaveCount(0);
  });

  test('Escape collapses the detail band', async ({ page }) => {
    const firstRow = page.locator('table.tbl tbody tr').first();
    await firstRow.click();
    await expect(page.locator('text=per-class drilldown')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('text=per-class drilldown')).toHaveCount(0);
  });

  test('Living Standards card uses KV not bars', async ({ page }) => {
    await page.locator('table.tbl tbody tr').first().click();
    const card = page.locator('.s-card', { hasText: 'Living Standards' });
    await expect(card).toBeVisible();
    await expect(card.locator('dt', { hasText: 'SoL' })).toBeVisible();
    await expect(card.locator('dt', { hasText: 'Expected' })).toBeVisible();
    await expect(card.locator('dt', { hasText: 'Privilege' })).toBeVisible();
    await expect(card.locator('.bar-row')).toHaveCount(0);
  });

  test('Status and per-class Workforce cards present in detail', async ({ page }) => {
    await page.locator('table.tbl tbody tr').first().click();
    await expect(page.locator('.s-card', { hasText: 'Status' })).toBeVisible();
    await expect(
      page.locator('.s-card', { hasText: 'Workforce' }).filter({ hasText: 'Fill Ratio' })
    ).toBeVisible();
  });

  test('row aria-pressed reflects selection', async ({ page }) => {
    const firstRow = page.locator('table.tbl tbody tr').first();
    await expect(firstRow).toHaveAttribute('aria-pressed', 'false');
    await firstRow.click();
    await expect(firstRow).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 3: Run the new tests to verify they fail.**

Run: `npm run test:e2e -- tests-e2e/demographics.spec.js`
Expected: the existing `workforce rework` cases PASS; every new `class drilldown` case FAILS (rows aren't clickable, no detail band exists yet, no `aria-pressed` attribute).

Run: `npm run test:e2e -- tests-e2e/a11y.spec.js`
Expected: existing per-page sweeps PASS for every theme except possibly stale `/pops` which is now gone. The new "with class detail open" cases FAIL because the row click does nothing.

The failures are the desired red state. Move to Task 2.

---

### Task 2: Create `ClassDetail.svelte`

**Files:**
- Create: `src/lib/components/ClassDetail.svelte`

- [ ] **Step 1: Write the component.**

Create `src/lib/components/ClassDetail.svelte` with this exact content:

```svelte
<script>
  import Bar from './Bar.svelte';
  import Tag from './Tag.svelte';

  /** @type {{
   *   name: string,
   *   standard_of_living: number|null,
   *   expected_sol: number|null,
   *   social_privileges: number|null,
   *   income: object|null,
   *   wealth: object|null,
   *   additional_income: object|null,
   *   status: object|null,
   *   workforce: object|null,
   * }} */
  export let cls;

  $: critRad = cls?.status?.radicalisation > 0.5;

  function num(v, decimals = 2) {
    return v == null ? '—' : v.toFixed(decimals);
  }
  function pct(v, decimals = 0) {
    return v == null ? '—' : (v * 100).toFixed(decimals) + '%';
  }
  function int(v) {
    return v == null ? '—' : Math.round(v).toLocaleString();
  }
  function whole(v) {
    return v == null ? '—' : v.toFixed(0);
  }
</script>

<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
  <div class="s-card">
    <div class="s-card-header"><h3>Living Standards</h3></div>
    <div class="s-card-pad">
      <dl class="kv">
        <dt>SoL</dt><dd>{num(cls.standard_of_living)}</dd>
        <dt>Expected</dt><dd>{num(cls.expected_sol)}</dd>
        <dt>Privilege</dt><dd>{pct(cls.social_privileges)}</dd>
      </dl>
    </div>
  </div>

  <div class="s-card">
    <div class="s-card-header"><h3>Income · per cap</h3></div>
    <div class="s-card-pad">
      <dl class="kv">
        <dt>Gross</dt><dd>{num(cls.income?.gross_per_cap)}</dd>
        <dt>Income tax</dt><dd>{num(cls.income?.income_tax_per_cap)}</dd>
        <dt>Wealth tax</dt><dd>{num(cls.income?.wealth_tax_per_cap)}</dd>
        <dt>Effective rate</dt>
        <dd>
          {cls.income?.effective_tax_rate != null
            ? (cls.income.effective_tax_rate * 100).toFixed(1) + '%'
            : '—'}
        </dd>
        <dt>Disposable</dt><dd>{num(cls.income?.disposable_per_cap)}</dd>
      </dl>
    </div>
  </div>

  <div class="s-card">
    <div class="s-card-header"><h3>Income · totals</h3></div>
    <div class="s-card-pad">
      <dl class="kv">
        <dt>Pre-tax</dt><dd>{whole(cls.income?.total_gross)}</dd>
        <dt>Post-tax</dt><dd>{whole(cls.income?.total_disposable)}</dd>
        <dt>Class wealth</dt><dd>{whole(cls.wealth?.total)}</dd>
        <dt>Wealth/cap</dt><dd>{num(cls.wealth?.per_cap)}</dd>
      </dl>
    </div>
  </div>

  <div class="s-card">
    <div class="s-card-header"><h3>Additional Income</h3></div>
    <div class="s-card-pad">
      <dl class="kv">
        <dt>Welfare</dt><dd>{num(cls.additional_income?.welfare)}</dd>
        <dt>Dividends</dt><dd>{num(cls.additional_income?.dividends)}</dd>
        <dt>Subsidies</dt><dd>{num(cls.additional_income?.subsidies)}</dd>
        <dt>Other</dt><dd>{num(cls.additional_income?.other)}</dd>
        <dt><strong>Total</strong></dt>
        <dd><strong>{num(cls.additional_income?.total)}</strong></dd>
      </dl>
    </div>
  </div>

  <div class="s-card md:col-span-2" class:critical={critRad}>
    <div class="s-card-header">
      <h3>Status</h3>
      {#if critRad}<Tag variant="crit">⚠ Radicalised</Tag>{/if}
    </div>
    <div class="s-card-pad grid grid-cols-1 md:grid-cols-2 gap-x-6">
      <div>
        <Bar
          label="Radicalisation"
          value={cls.status?.radicalisation}
          max={1}
          variant={critRad ? 'crit' : ''}
        />
        <Bar label="Abject Poverty" value={cls.status?.abject_poverty} max={1} variant="crit" />
        <Bar label="Organisation" value={cls.status?.organisation} max={1} />
      </div>
      <div>
        <Bar label="Education" value={cls.status?.literacy} max={1} variant="good" />
        <Bar label="Vote Share" value={cls.status?.vote_share} max={1} />
      </div>
    </div>
  </div>

  <div class="s-card md:col-span-2 xl:col-span-3">
    <div class="s-card-header"><h3>Workforce</h3></div>
    <div class="s-card-pad grid grid-cols-1 md:grid-cols-2 gap-x-6">
      <dl class="kv">
        <dt>Supply</dt><dd>{int(cls.workforce?.supply)}</dd>
        <dt>Demand</dt><dd>{int(cls.workforce?.demand)}</dd>
      </dl>
      <div>
        <Bar label="Fill Ratio" value={cls.workforce?.fill_ratio} max={1} variant="good" />
        <Bar
          label="Unemployment"
          value={cls.workforce?.unemployment}
          max={1}
          variant={cls.workforce?.unemployment != null && cls.workforce.unemployment > 0.15
            ? 'crit'
            : ''}
        />
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Sanity-build.**

Run: `npm run build`
Expected: build completes without errors. The component is not yet imported anywhere, so this just verifies the file parses.

---

### Task 3: Wire `Demographics.svelte`

**Files:**
- Modify: `src/routes/Demographics.svelte`

- [ ] **Step 1: Add the ClassDetail import.**

In `src/routes/Demographics.svelte`, in the import block at the top of the `<script>` (around line 14-19, after the other component imports), add:

```js
import ClassDetail from '../lib/components/ClassDetail.svelte';
```

- [ ] **Step 2: Add selection state, derived current class, sync-guard, handlers, and scrollIntoView.**

After the existing reactive declarations in the `<script>` block (after the `workforceFillGood` line around 68), append:

```js
// Per-class drilldown selection.
let selected = null; // class name string | null
let detailWrapper;

$: current = selected
  ? $pops?.classes.find((c) => c.name === selected) ?? null
  : null;

// Clear stale selection when the class disappears across a sync.
$: if (selected && $pops && !$pops.classes.some((c) => c.name === selected)) {
  selected = null;
}

// Pull the detail band into view when it opens.
$: if (current && detailWrapper) {
  Promise.resolve().then(() => {
    detailWrapper?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function toggleSelected(name) {
  selected = selected === name ? null : name;
}

function handleRowKeydown(e, name) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggleSelected(name);
  }
}

function handleWindowKeydown(e) {
  if (e.key === 'Escape' && selected != null) {
    selected = null;
  }
}
```

- [ ] **Step 3: Add the window keydown listener at the top of the template.**

Just inside the opening `<section>` tag (line 71), before the `{#if errorMsg}` block, add:

```svelte
<svelte:window on:keydown={handleWindowKeydown} />
```

- [ ] **Step 4: Convert each Class Vitals `<tr>` into a button-row.**

Replace the current `<tr>` in the each-block (around line 133-148):

```svelte
            <tr>
              <td>
                <span class="faction-bar" style="--bar-color: {classColor(c.name)}"></span>
                {c.name}
              </td>
              <td class="num">{c.pop?.toLocaleString() ?? '—'}</td>
              <td class="num">{c.mortality_rate != null ? (c.mortality_rate * 100).toFixed(2) + '%' : '—'}</td>
              <td class="num">{c.births_per_turn != null ? Math.round(c.births_per_turn).toLocaleString() : '—'}</td>
              <td class="num">{c.deaths_per_turn != null ? Math.round(c.deaths_per_turn).toLocaleString() : '—'}</td>
              <td class="num">{c.mobility_in != null ? Math.round(c.mobility_in).toLocaleString() : '—'}</td>
              <td class="num">{c.mobility_out != null ? Math.round(c.mobility_out).toLocaleString() : '—'}</td>
              <td class="num">{c.workforce?.demand != null ? Math.round(c.workforce.demand).toLocaleString() : '—'}</td>
              <td class="num" class:text-crit={fillDim}>{fill != null ? (fill * 100).toFixed(0) + '%' : '—'}</td>
              <td class="num">{c.unemployed_count != null ? Math.round(c.unemployed_count).toLocaleString() : '—'}</td>
              <td class="num">{c.satisfaction?.toFixed(2) ?? '—'}</td>
            </tr>
```

with:

```svelte
            <tr
              role="button"
              tabindex="0"
              aria-pressed={selected === c.name}
              class:selected-row={selected === c.name}
              style={selected === c.name ? `--row-accent: ${classColor(c.name)};` : ''}
              on:click={() => toggleSelected(c.name)}
              on:keydown={(e) => handleRowKeydown(e, c.name)}
            >
              <td>
                <span class="faction-bar" style="--bar-color: {classColor(c.name)}"></span>
                {c.name}
              </td>
              <td class="num">{c.pop?.toLocaleString() ?? '—'}</td>
              <td class="num">{c.mortality_rate != null ? (c.mortality_rate * 100).toFixed(2) + '%' : '—'}</td>
              <td class="num">{c.births_per_turn != null ? Math.round(c.births_per_turn).toLocaleString() : '—'}</td>
              <td class="num">{c.deaths_per_turn != null ? Math.round(c.deaths_per_turn).toLocaleString() : '—'}</td>
              <td class="num">{c.mobility_in != null ? Math.round(c.mobility_in).toLocaleString() : '—'}</td>
              <td class="num">{c.mobility_out != null ? Math.round(c.mobility_out).toLocaleString() : '—'}</td>
              <td class="num">{c.workforce?.demand != null ? Math.round(c.workforce.demand).toLocaleString() : '—'}</td>
              <td class="num" class:text-crit={fillDim}>{fill != null ? (fill * 100).toFixed(0) + '%' : '—'}</td>
              <td class="num">{c.unemployed_count != null ? Math.round(c.unemployed_count).toLocaleString() : '—'}</td>
              <td class="num">{c.satisfaction?.toFixed(2) ?? '—'}</td>
            </tr>
```

- [ ] **Step 5: Insert the conditional detail band before the WorkforceBand.**

Find the `<WorkforceBand bandNum="03" />` line (around line 153). Replace this:

```svelte
    <WorkforceBand bandNum="03" />
```

with:

```svelte
    {#if current}
      <Band title={`${current.name} · Detail`} meta="per-class drilldown" />
      <div bind:this={detailWrapper} aria-live="polite">
        <ClassDetail cls={current} />
      </div>
    {/if}
    <WorkforceBand bandNum="03" />
```

- [ ] **Step 6: Add scoped CSS for the selected row.**

At the end of `Demographics.svelte` (after the closing `</section>` and the closing `{/if}` for the ready check), append a new `<style>` block:

```svelte
<style>
  tr[role='button'] {
    cursor: pointer;
  }
  tr[role='button']:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .selected-row {
    background: var(--accent-soft);
    box-shadow: inset 4px 0 0 var(--row-accent, var(--accent));
    outline: 1px solid var(--accent);
    outline-offset: -1px;
  }
</style>
```

- [ ] **Step 7: Re-run the demographics e2e tests.**

Run: `npm run test:e2e -- tests-e2e/demographics.spec.js`
Expected: every test in BOTH describe blocks PASSES, including the new `Demographics — class drilldown` cases.

If any of the new cases fail:
- "row aria-pressed reflects selection" failing → check that the `aria-pressed` attribute is bound correctly (note: bound `aria-pressed={selected === c.name}` produces `"true"` / `"false"` strings).
- "Escape collapses" failing → confirm `<svelte:window on:keydown={handleWindowKeydown} />` is inside the section (or at the top level); Svelte requires it at the top of the template, not inside conditional blocks.
- "Living Standards card uses KV not bars" failing → confirm `ClassDetail.svelte` is the version from Task 2 (no `<Bar>` in the Living Standards card).

Run: `npm run test:e2e -- tests-e2e/a11y.spec.js`
Expected: all per-page sweeps PASS, all three new "with class detail open" cases (one per theme) PASS.

---

### Task 4: Delete `/pops` route + nav entry

**Files:**
- Delete: `src/routes/Pops.svelte`
- Modify: `src/App.svelte`
- Modify: `src/lib/components/NavBar.svelte`

- [ ] **Step 1: Delete the Pops route file.**

Run: `git rm src/routes/Pops.svelte`
Expected: file removed and staged.

- [ ] **Step 2: Drop the Pops import and route from App.svelte.**

In `src/App.svelte`, remove this line from the imports (line 14):

```js
import Pops from './routes/Pops.svelte';
```

In the `routes` map (lines 33-44), remove this entry:

```js
    '/pops': Pops,
```

- [ ] **Step 3: Drop the /pops entry from NavBar.**

In `src/lib/components/NavBar.svelte`, in the `ALL_PAGES` array (lines 8-18), remove this entry:

```js
    { path: '/pops', label: 'Pops' },
```

- [ ] **Step 4: Build and verify.**

Run: `npm run build`
Expected: build succeeds; no "Pops is not defined" error.

Run: `npm run test:e2e`
Expected: every test passes — both demographics describe blocks, the new a11y interactive cases, and every per-page a11y sweep. No reference to `/#/pops` lingers.

---

### Task 5: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add ClassDetail to the Layout components list.**

Find the line in `CLAUDE.md` Layout section (around line 13) that lists `src/lib/components/`:

```
- `src/lib/components/` — Mission-Brutalist primitives: `Band`, `KpiBlock`, `Sparkline`, `OvertonRow`, `Bar`, `Tag`. Plus updated `StatTile`, `SituationCard`, `TierLadder`, `Heatmap`. Existing: `RadarChart`, `MoonBackdrop`, `MoonLoader`, `MapCanvas`, `LayerMenu`, `NavBar`, `SyncChip`, `ThemeToggle`. Catalog UI: `CatalogModal`, `ImprovementCard`.
```

Replace it with:

```
- `src/lib/components/` — Mission-Brutalist primitives: `Band`, `KpiBlock`, `Sparkline`, `OvertonRow`, `Bar`, `Tag`. Plus updated `StatTile`, `SituationCard`, `TierLadder`, `Heatmap`. Existing: `RadarChart`, `MoonBackdrop`, `MoonLoader`, `MapCanvas`, `LayerMenu`, `NavBar`, `SyncChip`, `ThemeToggle`. Catalog UI: `CatalogModal`, `ImprovementCard`. Route-specific composites: `WorkforceBand`, `ClassDetail`, `SubFactionPanel`.
```

(If `WorkforceBand` and `SubFactionPanel` are already listed elsewhere in the file under a different rubric, reuse that grouping for `ClassDetail` instead and skip this exact wording. Use Grep to find: `grep -n "WorkforceBand\|SubFactionPanel" CLAUDE.md` and place `ClassDetail` next to them.)

- [ ] **Step 2: Rewrite gotcha #16 (Demographics band ordering).**

Find gotcha #16 in `CLAUDE.md` (currently begins with "Demographics band ordering"). Replace its body with:

```
16. **Demographics band ordering.** `01 Pop Dynamics → 02 Class Vitals → (Class Detail · unnumbered, conditional on row click) → 03 Workforce → 04 Housing → 05 Food Security`. The detail band is rendered by `ClassDetail.svelte` between the Class Vitals table and the Workforce band, gated on a row-click selection state owned by `Demographics.svelte`. It is deliberately unnumbered (the `Band` component supports omitting `num`) so toggling a row never renumbers the three downstream bands. The Workforce band is rendered by `WorkforceBand.svelte` and is null-safe — it renders nothing when `$workforce` is null (i.e. before `pops.json` has loaded). Selection state is local to `Demographics.svelte` (no store); a reactive guard clears `selected` if the class disappears across a sync. If you renumber, update both `Demographics.svelte` and the spec at `docs/superpowers/specs/2026-05-08-pops-into-demographics-design.md`.
```

- [ ] **Step 3: Verify CLAUDE.md still reads coherently.**

Run: `grep -n "Pops\b\|/pops" CLAUDE.md`
Expected: no remaining mentions of the deleted route. (References to "pops" lowercase as a domain term — e.g. "pops.json" — are fine and should stay.)

---

### Task 6: Manual smoke test

**Files:** none.

- [ ] **Step 1: Start the dev server.**

Run: `npm run dev`
Expected: Vite serves on `http://localhost:5173/`.

- [ ] **Step 2: Smoke each theme + keyboard interaction.**

For each theme in {schematic, light, dark} (toggle via the segmented pill in the nav):
1. Visit `/#/demographics`.
2. Click the first row in Class Vitals — confirm the detail band appears beneath, scrolled into view, with the class name in the band title.
3. Confirm Living Standards card shows three KV rows (SoL, Expected, Privilege) with NO bars.
4. Confirm Status card has bars and the radicalisation visual treatment if the live snapshot has a class above 0.5.
5. Click the same row again — detail band collapses.
6. Click a different row — detail switches to the new class.
7. Press Escape — detail collapses.
8. Tab through the table from the page top — focus reaches the rows, Enter activates a row, Space activates a row.

- [ ] **Step 3: Check `/pops` 404s gracefully.**

Visit `/#/pops` directly. Expected: NotFound route renders (no console errors, no broken layout).

- [ ] **Step 4: Stop the dev server.**

Ctrl-C in the terminal running `npm run dev`.

---

### Task 7: Final verification + commit

**Files:** all modified files staged.

- [ ] **Step 1: Run the full e2e suite once more.**

Run: `npm run test:e2e`
Expected: every test passes across all themes.

- [ ] **Step 2: Show the diff for review.**

Run: `git status`
Run: `git diff --stat`
Run: `git diff`

The executor reports the file list and stat to the user.

- [ ] **Step 3: Ask the user how to structure the commit(s).**

Per the user's standing memory ("defer commits until plan execution finishes; ask at the end how to structure the final commit(s)"), DO NOT commit yet. Ask the user whether they want:
- a single commit covering the whole merge (recommended given the slice is tight);
- two commits (one for the merge + tests, one for the deletes + docs);
- some other split.

After the user replies, create the commit(s) with messages following the existing convention (`feat(demographics): …`, `chore(routes): …`, etc. — sample recent commits with `git log --oneline -10`).

- [ ] **Step 4: Exit the worktree (or leave it open for further work).**

The executor asks the user whether to exit the worktree (`keep` to preserve the branch, `remove` to delete) or leave it open if there's follow-up work expected.

---

## Self-Review

**Spec coverage check:**

- [x] One landing page for population views → Tasks 3 (wire detail band) + 4 (delete /pops).
- [x] Click any class row to inspect → Task 3 step 4 (button-row), step 5 (detail band).
- [x] Replace Living Standards bars with KV → Task 2 (ClassDetail.svelte Living Standards card).
- [x] Remove standalone /pops route + nav link → Task 4.
- [x] Detail band unnumbered → Task 3 step 5 (`<Band title meta />` with no num).
- [x] Esc collapses → Task 3 step 2 (`handleWindowKeydown`) + step 3 (window listener).
- [x] Same-row toggle → Task 3 step 2 (`toggleSelected`).
- [x] Reactive guard for stale selection → Task 3 step 2.
- [x] scrollIntoView on open → Task 3 step 2.
- [x] aria-live on detail band → Task 3 step 5.
- [x] Visible focus ring on row → Task 3 step 6 (`:focus-visible` outline).
- [x] Selection ring on selected row → Task 3 step 6 (.selected-row outline + box-shadow).
- [x] CLAUDE.md gotcha #16 rewrite → Task 5 step 2.
- [x] CLAUDE.md Layout list adds ClassDetail → Task 5 step 1.
- [x] e2e a11y test for detail-open state → Task 1 step 1.
- [x] Interactive demographics e2e tests → Task 1 step 2.
- [x] No backend / schema / fixture change → respected throughout (no extractor or schema_version touches).
- [x] /pops → NotFound (no redirect) → Task 4 (no redirect added).

**Placeholder scan:** none. Every step has an exact path and exact code or command.

**Type/name consistency:**
- `selected` (string | null), `current` (object | null), `toggleSelected(name)`, `handleRowKeydown(e, name)`, `handleWindowKeydown(e)`, `detailWrapper` — used consistently across Task 3 steps 2-6.
- ClassDetail prop `cls` — set in Task 2, consumed in Task 3 step 5.
- CSS `.selected-row`, `--row-accent`, `var(--accent-soft)`, `var(--accent)` — Task 3 step 4 sets the inline `--row-accent`, Task 3 step 6 reads it.
- The existing `WorkforceBand bandNum="03"` is unchanged — confirmed in Task 3 step 5.
