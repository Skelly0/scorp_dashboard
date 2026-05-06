# Demographics — Workforce Band + Top-KPI Rework — Design

**Date:** 2026-05-06
**Topic:** Surface job demand on Demographics (per-class + colony-aggregate), and replace three top KPIs (Effective CDR, Net Δ%, Total Deaths) with more decision-relevant readouts (Available Housing, Predicted Growth, Workforce Fill).
**Related work:** `2026-05-06-demographics-page-and-status-vitals-design.md` (the page this spec evolves).

---

## 1. Goal

Today, the Demographics page leads with five top-of-page KPI tiles: **Total Pop, Effective CDR, Net Δ%, Total Deaths, Avg Satisfaction**. Three of these (CDR, Net Δ%, Deaths) are intermediate quantities — the player has to do mental math to translate them into "are we growing? do we have room?" The page also has zero direct readout for **job demand**, despite `pops.json` carrying per-class `workforce.demand`, `workforce.supply`, `workforce.fill_ratio`, and `workforce.unemployment` for every class.

This design:

- swaps three top KPIs for **outcome-oriented** readouts the player can act on at a glance;
- adds a new **Workforce band** between Class Vitals and Housing that aggregates colony-wide labour numbers and surfaces a "skill mismatch" callout when both shortage and unemployment exist;
- extends the **Class Vitals** table with two columns (`Demand`, `Fill %`) so the per-class story is one scroll away from the aggregate.

The CDR / Net Δ% / Deaths fields remain in `demographics.json` (history series still consume them); they're just no longer top-of-page.

---

## 2. Brainstorm decisions (recap)

| Decision | Choice |
|---|---|
| Top KPI swap | **Layout A** — Total Pop · Avg Satisfaction · Available Housing · Predicted Growth · Workforce Fill |
| Job-demand surface | **Both** — per-class table columns *and* a new aggregate band |
| Workforce band shape | **Storyteller** — 3 tiles (Demand, Supply, Unemployed) + full-width Fill bar + skill-mismatch callout |
| Aggregation location | **Frontend** — derived store; backend already emits everything we need on `pops.json` |

---

## 3. Top-KPI rework

Band 01 stays a 5-up grid. Three tiles change:

| Slot | Before | After | Source / formula |
|---|---|---|---|
| 1 | Total Pop | *(unchanged)* | `demographics.totals.pop` |
| 2 | Effective CDR | **Available Housing** | `housing.capacity − housing.pop` (headline integer); subtitle: `((capacity − pop) / capacity × 100).toFixed(0) + '% free'` |
| 3 | Net Δ% | **Predicted Growth** | `Math.round(pop × (effective_growth_rate × housing_growth_mult − effective_cdr))` — signed integer, formatted `+150 / turn` or `−18 / turn` |
| 4 | Total Deaths | **Workforce Fill** | `total_supply / total_demand` (colony-wide, from derived store); formatted as `90.7%`; `crit` modifier when `< 0.85`, `good` when `≥ 1.0` |
| 5 | Avg Satisfaction | *(unchanged)* | `demographics.totals.avg_satisfaction` |

### 3.1 Sparkline behaviour

- **Available Housing** — no sparkline initially. (Adding a `housingFreeHistory` derived store is straightforward later — `capacity − pop` per snapshot — but not in scope.)
- **Predicted Growth** — derive from existing `populationHistory` (year-over-year delta) when length ≥ 2; else no sparkline. Note: this is *historical realised growth*, not historical predictions, but it's the closest faithful series. Caller passes `populationDeltaHistory` when available.
- **Workforce Fill** — no sparkline initially. (No history series exists for workforce; deferred.)

### 3.2 Edge cases

| Case | Behaviour |
|---|---|
| `capacity` is `None` or `0` | Available Housing renders `—`; subtitle hidden |
| `effective_growth_rate` or `effective_cdr` is `None` | Predicted Growth renders `—`; no sparkline |
| `housing_growth_mult` is `None` | Treat as `1.0` (no penalty) — matches the Sheet's IFERROR fallback |
| `total_demand` is `0` | Workforce Fill renders `—` (avoid div-by-zero) |

---

## 4. Class Vitals — two new columns

Existing columns: `Class | Pop | Mortality | Deaths/turn | Unemployed | Satisfaction`

After: `Class | Pop | Mortality | Deaths/turn | Demand | Fill % | Unemployed | Satisfaction`

| New column | Source | Format |
|---|---|---|
| Demand | `c.workforce.demand` | `Math.round(v).toLocaleString()` — `—` when `null` |
| Fill % | `c.workforce.fill_ratio` | `(v × 100).toFixed(0) + '%'` — `—` when `null`; cell uses `text-crit` colour when `< 0.85`, no colouring otherwise. No inline bar — too dense at 8 columns. |

---

## 5. Workforce band (NEW — Band 03)

Slots between **Class Vitals** (Band 02) and **Housing** (Band 04). Subsequent bands renumber: Housing → 04, Food → 05.

### 5.1 Tiles (3-up grid, identical to existing KpiBlock pattern)

| Tile | Source (derived) | Format |
|---|---|---|
| Total Demand | `Σ c.workforce.demand` | `Math.round(v).toLocaleString()` |
| Total Supply | `Σ c.workforce.supply` | `Math.round(v).toLocaleString()` |
| Total Unemployed | `Σ c.unemployed_count` | `Math.round(v).toLocaleString()` |

### 5.2 Fill bar

Full-width, label "Colony-wide Fill", value = `total_supply / total_demand`, max = 1, format = `pct`. Variant logic (single source of truth — no overlapping conditions):

| `fillRatio` range | Modifier(s) | Meaning |
|---|---|---|
| `< 0.85` | `crit` | Labour shortage |
| `0.85 ≤ x ≤ 1.0` | *(none)* | Healthy fill |
| `> 1.0` | `overflow` | Over 100 % — surplus labour shown via the existing diagonal-stripe overlay (cosmetic only; no `crit` colour, since oversupply is socially loaded but not the same emergency as shortage) |

`good` is not used. The bar renders at full when `fillRatio ≥ 1.0`; the `overflow` overlay communicates "above 100 %".

### 5.3 Skill-mismatch callout

A `.s-card.sev-warn` band (reusing the situation-card severity vocabulary from `global.css`) appears **only when** `total_unemployed > 0 AND shortage > 0`.

`shortage` is defined as **per-class summed shortage** — `Σ max(0, c.workforce.demand − c.workforce.supply)`. This is *not* the colony-level net (`max(0, totalDemand − totalSupply)`), because the whole point of the callout is to flag the case where *both* sides exist simultaneously: the colony might net out, but specific classes are still short while others have idle workers. Use this same `shortage` definition wherever the callout's "M jobs unfilled" number is shown.

**Content:**
> "Skill mismatch: **N idle** (top: *X (n)*, *Y (n)*) while **M jobs unfilled** (top: *A (a)*, *B (b)*)."

- "idle" = `total_unemployed` (sum of `c.unemployed_count`).
- "jobs unfilled" = `shortage` as defined above.
- "top: …" — top-2 classes by absolute count on each side.

When the trigger fails (e.g., zero unemployment, or zero per-class summed shortage), the callout is suppressed entirely.

---

## 6. Data flow

### 6.1 Backend — no changes

Everything needed already lives on:
- `demographics.json` — `housing.capacity`, `housing.pop`, `housing.growth_mult`, `totals.effective_growth_rate`, `totals.effective_cdr`
- `pops.json` — `classes[].workforce.{demand, supply, fill_ratio}`, `classes[].unemployed_count`, `classes[].pop`

The CDR / Net Δ% / Deaths fields remain in `demographics.json.totals` — they're still consumed by `src/lib/stores/history.js` (cdrHistory, deathsHistory, netDeltaHistory) and the year-snapshot pipeline. We're only stopping their *display* on Band 01, not their *emission*.

### 6.2 Frontend — new derived store

Add `src/lib/stores/workforce.js` (sibling to existing pops/demographics stores). Exports a single derived store:

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

  // Per-class summed shortage (NOT the colony-level net) — see § 5.3 for why.
  const perClassShortage = classes.map((c) => ({
    name: c.name,
    count: Math.max(0, (c.workforce?.demand ?? 0) - (c.workforce?.supply ?? 0)),
  }));
  const shortage = perClassShortage.reduce((s, x) => s + x.count, 0);

  // Top-2 by absolute count on each side.
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

### 6.3 Frontend — Demographics.svelte

- Import `workforce` store and the new tile/band markup.
- Drop the Effective CDR / Net Δ% / Total Deaths tiles from Band 01; insert the three new tiles.
- Compute `predictedGrowth` reactively: `$: predictedGrowth = …` using `demographics.totals` and `housing.growth_mult` (default 1.0 when null).
- Compute `availableHousing` reactively from `housing.capacity` and `housing.pop`.
- Add Band 03 markup with the three workforce tiles, the Fill Bar, and the conditional callout.
- Renumber Housing → 04, Food → 05.

---

## 7. Tests

### 7.1 New: `src/lib/stores/workforce.test.js` (Vitest, sibling pattern to existing store tests if any)

If no Vitest harness exists yet, defer to manual testing for store math and rely on Playwright for the UI. (No JS unit-test infra was set up in the spec/plan we're evolving — confirm during implementation, don't introduce a new test stack as part of this spec.)

### 7.2 Playwright (`tests-e2e/`) — extend existing demographics test

- Top KPIs render: Total Pop, Avg Satisfaction, Available Housing, Predicted Growth, Workforce Fill (assert presence by label, not by exact value).
- Class Vitals table has 8 columns; `Demand` and `Fill %` headers present.
- Workforce band renders three KPI tiles, a Fill bar, and (with the live data which contains skill mismatch) the callout.
- Predicted Growth renders signed (`+` or `−` prefix or just `−`).
- a11y: no new violations on Demographics route (existing axe job continues to gate).

### 7.3 Edge-case workbook fixtures

The existing fixture in `tests/fixtures/build_test_workbook.py` is mostly used by the Python extractors; this is a frontend-only change so no fixture additions are required. The Python tests (`tests/extractors/test_demographics.py`) continue to pass unchanged.

---

## 8. Out of scope

- Sparkline series for Available Housing and Workforce Fill (would need a new history field; punt to a follow-up).
- Backend aggregation of workforce totals into `demographics.json` (frontend derivation suffices for now).
- Surfacing the per-tile housing-bar fix in the Housing band — user is handling that separately.
- Cross-route "workforce" page if the band grows beyond what fits.

---

## 9. Rollout

1. Implement frontend changes (store + page) on a branch.
2. Manually verify on the dev server with the live `public/data/*.json`.
3. Update Playwright tests; run a11y job.
4. Update `CLAUDE.md` if any new conventions are introduced (likely just a one-liner about the new store).
5. PR + merge.
