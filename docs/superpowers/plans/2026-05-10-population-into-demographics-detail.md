# Population Into Demographics Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the standalone Population page into the Demographics class drilldown so each clicked class shows population share, tier, political weight, and worldview radar in context.

**Architecture:** Keep `population.json` and its extractor/store as the source for tier/share/worldview data. Demographics loads the existing population store, finds the selected class by name, passes that profile into `ClassDetail`, and removes Population from the router/nav/mobile/a11y route lists.

**Tech Stack:** Svelte 4, svelte-spa-router, existing `RadarChart`, Playwright e2e, Vitest, pytest.

---

### Task 1: Lock Merged Detail Behavior

**Files:**
- Modify: `tests-e2e/demographics.spec.js`

- [ ] **Step 1: Write failing e2e assertions**

Add assertions after opening a class detail:

```js
await expect(page.locator('.s-card', { hasText: 'Population Profile' })).toBeVisible();
await expect(page.locator('.s-card', { hasText: 'Worldview Chart' })).toBeVisible();
await expect(page.locator('.s-card', { hasText: 'Population Profile' }).locator('dt', { hasText: 'Pop Share' })).toBeVisible();
```

- [ ] **Step 2: Run and verify red**

Run: `npx playwright test tests-e2e/demographics.spec.js --project=chromium -g "Population profile"`

Expected: fail because `Population Profile` and `Worldview Chart` are not rendered yet.

### Task 2: Merge Data and UI

**Files:**
- Modify: `src/routes/Demographics.svelte`
- Modify: `src/lib/components/ClassDetail.svelte`

- [ ] **Step 1: Load population data in Demographics**

Import `population`, `populationError`, and `loadPopulation`; call `loadPopulation($meta.synced_at)` beside `loadPops`; include `$population` in readiness and error handling.

- [ ] **Step 2: Pass selected population profile**

Find `currentPopulation` by selected class name and pass it as `populationProfile={currentPopulation}` to `ClassDetail`.

- [ ] **Step 3: Render profile in ClassDetail**

Import `RadarChart` and worldview labels. Add a `Population Profile` card and `Worldview Chart` card to the detail grid. Render missing values as `—`.

- [ ] **Step 4: Run and verify green**

Run: `npx playwright test tests-e2e/demographics.spec.js --project=chromium -g "Population profile"`

Expected: pass.

### Task 3: Remove Standalone Population Page Surface

**Files:**
- Modify: `src/App.svelte`
- Modify: `src/lib/components/NavBar.svelte`
- Modify: `tests-e2e/a11y.spec.js`
- Modify: `tests-e2e/mobile-flow.spec.js`
- Modify: `tests-e2e/demographics.spec.js`
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write failing nav/route expectations**

Add e2e assertions that the nav does not show `Population` and `/#/population` renders the 404 page.

- [ ] **Step 2: Remove route and nav item**

Remove the `Population` import and `'/population'` route from `App.svelte`. Remove `{ path: '/population', label: 'Population' }` from `NavBar.svelte`.

- [ ] **Step 3: Update route smoke lists**

Remove `/#/population` from `PAGES` in a11y tests and `ROUTES` in mobile route smoke tests.

- [ ] **Step 4: Update docs**

Update README route table so Demographics mentions merged class share/worldview detail. Add a CLAUDE note documenting that `population.json` remains as backing data for Demographics.

### Task 4: Full Verification

Run:

```powershell
uv run pytest
npx vitest run --reporter=verbose
npm run build
npx playwright test tests-e2e/demographics.spec.js --project=chromium
npx playwright test tests-e2e/mobile-flow.spec.js --project=chromium
```

Expected: all commands exit 0. Build may still print the existing Map/MapCanvas Svelte a11y warnings.
