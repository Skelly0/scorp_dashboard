# Demographics page + Status vitals expansion

**Date:** 2026-05-06
**Status:** Draft (awaiting user review)
**Schema bump:** v2 → v3

## Context

The dashboard is being pointed at a new GM workbook (Sheet ID
`1a602zL0X7HqUTpgr0lFxKfm5_tzDdQxbiv7Jw-hSoN0`) that exposes new game
systems: population mortality, housing dynamics, food security, and a
formal government-approval scalar. The frontend currently surfaces none
of this. This spec adds visibility for the new systems via two
complementary changes — top-line vitals on Status, plus a new
`/demographics` route for per-class drilldowns and housing/food detail.

The Sheet swap itself is operational (update `vars.SHEET_ID` in repo
settings); no code change owns the URL.

## Goals

- Surface the new colony-level systems on Status (gov approval,
  pop change rate, deaths, housing utilization) so the landing page
  reflects what the game models now.
- Provide a new Demographics page for per-class mortality, raw
  unemployment, housing detail, and food security.
- Track new metrics in year-over-year history so sparklines develop
  organically.
- Stay tolerant of the workbook losing tuning knobs — required ranges
  are split into hard (structural) vs soft (tuning) tiers.

## Non-goals

- No backfill of historical snapshots — sparklines start from
  deploy-day for new metrics.
- No refactor of pages beyond what the new data needs.
- No surfacing of GM tuning constants (`Var_*SatPer1k` etc.) in the
  player UI.
- No Cropsim food-split breakdown (Greens/Cereal/Vat Protein/Algal
  Paste) — deferred; can land as a follow-up once named ranges are
  added in the workbook or as direct sheet-cell reads.
- No fix to pre-existing test-fixture drift on GoI/treasury layouts
  (gotcha #10 in CLAUDE.md remains).

## Architecture overview

```
GitHub Action (cron)
  └─ scripts/sync_sheet.py
       ├─ download xlsx (vars.SHEET_ID points at new workbook)
       ├─ validate_schema.validate          ← +11 hard required ranges
       ├─ extractors/status.py              ← +gov_approval, +demographics block
       ├─ extractors/pops.py                ← +per-class mortality, deaths/turn, unemployed_count
       ├─ extractors/demographics.py        ← NEW: totals + housing + food
       ├─ extractors/{population,gois,parties,map,situations,senate}.py  ← unchanged
       ├─ history.write_snapshot            ← +6 new fields from status.demographics
       └─ write meta.json (schema_version: 3)

public/data/
  ├─ status.json          ← +gov_approval, +demographics{...}
  ├─ pops.json            ← +per-class mortality_rate, deaths_per_turn, unemployed_count
  ├─ demographics.json    ← NEW
  └─ history/year-NNN.json ← +6 new fields from this year on

src/
  ├─ App.svelte                            ← +'/demographics' route
  ├─ lib/components/NavBar.svelte          ← +Demographics nav link (between Pops and GoIs)
  ├─ lib/stores/
  │    ├─ meta.js                          ← EXPECTED_SCHEMA_VERSION: 3
  │    ├─ status.js                        ← unchanged shape, fuller payload
  │    ├─ pops.js                          ← unchanged shape, fuller payload
  │    ├─ history.js                       ← +derived stores for new metrics
  │    └─ demographics.js                  ← NEW
  ├─ routes/
  │    ├─ Status.svelte                    ← +Gov Approval KpiBlock, +Pulse tile-row
  │    └─ Demographics.svelte              ← NEW
  └─ styles/global.css                     ← +.bar.overflow, +.kpi-block.critical
```

## Detailed design

### Section 1: Status page additions

**Vital Signs band — column rebalance** (single row, 12 columns):

| Slot | Existing → New | Cols |
| --- | --- | --- |
| Treasury | `md:col-span-5` → `md:col-span-4` | 4 |
| Stability | `md:col-span-3` → `md:col-span-2` | 2 |
| Crisis Factor | unchanged | 2 |
| Population | unchanged size; `delta` slot now shows net Δpop/turn | 2 |
| **Gov Approval** | NEW | 2 |

Total: 12. All five carry sparklines when ≥2 history samples exist.
Population and Crisis-Factor styling preserved from current page.

**Pulse tile-row — NEW**, placed between Vital Signs and Resource
Flows:

| Tile | Source | Notes |
| --- | --- | --- |
| Growth Rate % | `Var_BaseGrowthRate × Var_GrowthSatElasticity` (Python-side) | Renders `—` if either input missing |
| Deaths / turn | `TotalDeathsPerTurn` | Direct |
| Est. Net Δ% | Computed in extractor: `(growth_rate − effective_cdr) × 100` | "Est." prefix flags it as derived |
| Housing util % | `pop / HousingCapacity × 100` | Crit-coloured when > 100 |

Resource Flows / Overton / Active Situations bands: unchanged.

### Section 2: Demographics page (`/demographics`)

NavBar position: between Pops and GoIs. Page loads BOTH the `pops`
store and the new `demographics` store on mount.

**Band 01 — Pop Dynamics** (5 KpiBlocks):
- Total Pop · Effective CDR · Net Δ% · Total Deaths · Avg Satisfaction
- Sparklines from `history.js` derived stores (≥2 samples gate).

**Band 02 — Class Vitals** (per-class table):
- Reads from `$pops.classes` (NOT `$demographics.classes`).
- Columns: Class · Pop · Mortality Rate · Deaths/turn · Unemployed · Satisfaction
- `faction-bar` accent on class names, matching Population page.
- Order: ClassTable order (consistent with every other class table).

**Band 03 — Housing** (two-card row):
- *Housing Utilization card*: a wide `.bar` showing `pop / capacity`,
  width capped at 100%. When actual ratio > 1.0, also applies
  `.bar.overflow` (diagonal-stripe pattern) and a crit-tinted KpiBlock
  border via `.kpi-block.critical`. Numeric % overlay.
- *Housing Modifiers card*: kv block with `housing_ratio`,
  `housing_growth_mult`, `overcrowding_exp`. Renders `—` for missing
  soft-optional ranges.

**Band 04 — Food Security** (3 KPIs):
- Food Security Ratio · Food per Cap · Variety Index.
- Cropsim food split deferred (non-goal).

### Section 3: Backend extraction & schema

**Schema validator — 2-tier requirements.** Edit
`scripts/validate_schema.py`:

```python
BASE_REQUIRED_RANGES.extend([
    # Status — colony vitals
    "EffectiveGovApproval", "TotalDeathsPerTurn", "EffectiveCDR",
    # Demographics — per-class mortality (already on the route via pops.json)
    "MortalityRates", "DeathsPerTurn", "PopsimUnemployed",
    # Housing
    "HousingCapacity", "HousingRatio",
    # Food
    "FoodSecurityRatio", "FoodPerCap", "FoodVarietyIndex",
])

# Soft-optional tuning knobs — the extractor handles missing-ness gracefully.
# Mirrors the Var_Year pattern in extractors/status.py.
SOFT_OPTIONAL_RANGES = [
    "Var_BaseGrowthRate", "Var_GrowthSatElasticity",
    "Var_BaseDeathRate",
    "HousingGrowthMult", "Var_HousingOvercrowdingExp",
]
```

`SOFT_OPTIONAL_RANGES` is documentation-only — the validator does not
require them. Extractors read them via the existing `_scalar_named`
helper, which already returns `None` for missing names (see
`extractors/_common.py:read_named_range`, which returns `[]` when
`name not in wb.defined_names`, and `extractors/status.py:_scalar_named`,
which short-circuits on empty rows). No new helper needed.

**`extractors/status.py`** — extend the returned dict. `population_total`
is computed within `extract()` (it already is — `_population_total(wb)`),
then passed to the new helpers:

```python
def extract(wb):
    population_total = _population_total(wb)
    return {
        # ... existing keys ...
        "population_total": population_total,
        "gov_approval": _scalar_named(wb, "EffectiveGovApproval"),
        "demographics": _demographics_block(wb, population_total),
    }

def _demographics_block(wb, pop):
    base = _scalar_named(wb, "Var_BaseGrowthRate")
    elasticity = _scalar_named(wb, "Var_GrowthSatElasticity")
    cdr = _scalar_named(wb, "EffectiveCDR")
    capacity = _scalar_named(wb, "HousingCapacity")
    effective_growth = base * elasticity if (base is not None and elasticity is not None) else None
    return {
        "base_growth_rate": base,
        "sat_elasticity": elasticity,
        "effective_growth_rate": effective_growth,
        "effective_cdr": cdr,
        "total_deaths": _scalar_named(wb, "TotalDeathsPerTurn"),
        "net_delta_pct": _net_delta_pct(effective_growth, cdr),
        "housing_capacity": capacity,
        "housing_util": _housing_util(pop, capacity),
        "avg_satisfaction": _avg_satisfaction(wb),
    }
```

**Helper specifications** (all guard against div-by-zero / None inputs):

- `_net_delta_pct(growth, cdr)`: returns `(growth - cdr) * 100` if both
  are not None, else `None`. Stored as a percentage (already × 100) —
  frontend renders the value with a `%` suffix and no further math.
- `_housing_util(pop, capacity)`: returns `pop / capacity` (a ratio, 0–1+
  range) if `capacity not in (None, 0)`, else `None`. Frontend formats
  as `× 100` to show as %.
- `_avg_satisfaction(wb)`: reads `PopsimSatisfaction` and `PopsimPop` per
  class, returns `sum(sat[i] * pop[i]) / sum(pop[i])` if `sum(pop) > 0`,
  else `None`. Skips rows where either value is `None`. Lives on the
  status block (not just demographics.json) so history.py can pick it
  up.

**`extractors/pops.py`** — extend per-class block. New keys:
- `mortality_rate` — from `MortalityRates[i]`
- `deaths_per_turn` — from `DeathsPerTurn[i]`
- `unemployed_count` — from `PopsimUnemployed[i]` (raw count; the
  existing `workforce.unemployment` ratio stays as-is)

All three reads MUST follow the existing length-guard pattern already
used throughout `pops.py` (`coerce_number(rng[i][0]) if i < len(rng) else None`)
so a workbook with fewer rows in `MortalityRates` than in `ClassTable`
doesn't index-error. `satisfaction` is already exposed — no change.

**NEW `extractors/demographics.py`** — colony totals + housing + food
only. Output:
```python
{
    "totals": {
        "pop": <int>,
        "effective_cdr": <float|None>,
        "total_deaths": <float|None>,
        "effective_growth_rate": <float|None>,  # base × elasticity, derived
        "net_delta_pct": <float|None>,
        "avg_satisfaction": <float|None>,  # mirrors status.demographics.avg_satisfaction
    },
    "housing": {
        "capacity": <float|None>,
        "pop": <int>,
        "ratio": <float|None>,
        "overcrowding_exp": <float|None>,  # soft-optional
        "growth_mult": <float|None>,  # soft-optional
    },
    "food": {
        "security_ratio": <float|None>,
        "per_cap": <float|None>,
        "variety_index": <float|None>,
    },
}
```

**Sync orchestrator** — `scripts/sync_sheet.py` registers the new
extractor in the `extractors` list. Order doesn't matter operationally
but place after `pops` for readability.

**Schema version lockstep:**
- `SCHEMA_VERSION = 3` in `scripts/sync_sheet.py`.
- `EXPECTED_SCHEMA_VERSION = 3` in `src/lib/stores/meta.js`.

Mismatch in either direction triggers the existing maintenance banner.

### Section 4: History sparklines

Edit `scripts/history.py:write_snapshot`. The function only sees
`status_data`, so any sparklined metric must surface on `status.json`.
Status.demographics already carries the needed fields — **ADD** new keys
to the existing snapshot dict; do NOT modify the shape of existing keys
(critical: `treasury` is currently stored as the full dict so
`treasuryHistory` can read `s?.treasury?.money`; flattening would
silently break that derived store):

```python
snapshot = {
    # Existing keys — preserve shapes verbatim:
    "year": year,
    "synced_at": synced_at,
    "treasury": status_data.get("treasury"),   # full dict, NOT flattened
    "stability": status_data.get("stability"),
    "crisis_factor": status_data.get("crisis_factor"),
    "population_total": status_data.get("population_total"),
    "resources": status_data.get("resources", []),
    "overton": status_data.get("overton", {}),
    # NEW v3 keys — null when status didn't supply them (old workbooks):
    "gov_approval": status_data.get("gov_approval"),
    "total_deaths": status_data.get("demographics", {}).get("total_deaths"),
    "effective_cdr": status_data.get("demographics", {}).get("effective_cdr"),
    "net_delta_pct": status_data.get("demographics", {}).get("net_delta_pct"),
    "housing_util": status_data.get("demographics", {}).get("housing_util"),
    "avg_satisfaction": status_data.get("demographics", {}).get("avg_satisfaction"),
}
```

`src/lib/stores/history.js` gets six matching derived stores. Each
follows the existing null-filter pattern verbatim — without it, a single
null value mid-series will crash `Sparkline.svelte`'s polyline:

```js
export const govApprovalHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.gov_approval).filter((v) => v != null) : []
);
// repeat for deathsHistory, cdrHistory, netDeltaHistory,
// housingUtilHistory, avgSatHistory
```

Existing year files predate these keys — `?.` returns `undefined` →
`!= null` filter drops it. Old years just don't contribute. Sparklines
develop from this deploy onward (no backfill).

### Section 5: Frontend plumbing

**New store** `src/lib/stores/demographics.js`:
- Mirrors `pops.js` shape: writable `demographics` + writable
  `demographicsError` + `loadDemographics(syncedAt)` async loader that
  fetches `data/demographics.json?v=${syncedAt}`.

**New route** `src/routes/Demographics.svelte`:
- Import both `pops` and `demographics` stores; call both loaders on
  mount.
- Class Vitals table reads `$pops.classes`; totals/housing/food read
  `$demographics`.
- Loading state uses `MoonLoader` + same "Reading… panel" text style as
  Status.
- All KpiBlocks gate sparklines on `history.length >= 2`.

**App.svelte** — add `'/demographics': Demographics` to routes table.

**NavBar.svelte** — add Demographics link between Pops and GoIs. Same
visual treatment as existing nav items.

**`src/lib/components/KpiBlock.svelte` — 1-line edit.** The component
currently accepts a `critical` prop but only applies the class to the
inner `.kpi-num` (line 16: `numClass = critical ? 'kpi-num crit' : ...`).
For `.kpi-block.critical { border-color }` to work, the wrapper needs
the class too:

```svelte
<div class="kpi-block" class:critical>
```

This is additive — no existing usage breaks (the prop is already opt-in
via `critical={...}`).

**`src/styles/global.css`** — two new utility classes, defined for
ALL THREE themes (light, dark, schematic) per the "all themes must
define every variable" rule. Verify `--crit` and `--crit-soft` already
resolve in all three themes before deploying (they should — used by
existing crit treatments — but worth a grep on `:root[data-theme=…]`):

```css
.bar.overflow span {
  /* diagonal stripe pattern overlaid on the existing fill.
     Width is still capped at 100% — stripes signal "overflow exists"
     without conveying magnitude. Magnitude is shown numerically next
     to the bar. */
  background-image: repeating-linear-gradient(
    45deg,
    var(--crit-soft) 0,
    var(--crit-soft) 6px,
    var(--crit) 6px,
    var(--crit) 12px
  );
}

.kpi-block.critical {
  border-color: var(--crit);
}
```

`.kpi-block.critical` is set by Demographics.svelte when
`housing_util > 1.0`, mirroring the existing `critical` flag pattern in
KpiBlock.

### Section 6: Tests

**Fixture extension** — `tests/fixtures/build_test_workbook.py` gets:
- The 11 new hard-required named ranges, each backed by a small block
  on its named sheet (Mortality, Housing, etc.).
- A minimal `MortalityRates` and `DeathsPerTurn` populated for at least
  3 classes, plus one trailing blank row to exercise length-guards.
- Pre-existing GoI/treasury fixture drift stays as-is per CLAUDE.md
  gotcha #10.

**Python (pytest):**
- `test_demographics_extractor_happy_path` — fixture provides all
  required ranges, asserts shape and the exact population-weighted
  `avg_satisfaction` value.
- `test_status_demographics_block` — asserts the new `gov_approval` and
  `demographics` block on status output (exact field-name list).
- `test_pops_per_class_mortality` — asserts `mortality_rate`,
  `deaths_per_turn`, `unemployed_count` appear on per-class entries.
- `test_pops_handles_short_mortality_range` — fixture's `MortalityRates`
  has fewer rows than `ClassTable`; assert no IndexError and missing
  rows surface as `None`.
- `test_schema_validator_rejects_missing_hard_range` — drop one of the
  11 new hard-required ranges, assert `SchemaValidationError`.
- **Soft-optional fan-out** (5 separate cases, parameterized):
  - drop `Var_BaseGrowthRate` → assert `effective_growth_rate is None`,
    `net_delta_pct is None`
  - drop `Var_GrowthSatElasticity` → same expectations (verify the AND
    short-circuit, not just one side)
  - drop `HousingGrowthMult` → assert `housing.growth_mult is None`,
    other housing fields unaffected
  - drop `Var_HousingOvercrowdingExp` → assert
    `housing.overcrowding_exp is None`
  - drop `Var_BaseDeathRate` → assert sync still completes (no consumer
    fails)
- `test_housing_util_div_zero_guard` — `HousingCapacity = 0` →
  `housing_util is None`, no ZeroDivisionError.
- `test_avg_satisfaction_zero_pop_guard` — every `PopsimPop` cell is 0
  → `avg_satisfaction is None`.

**Playwright (a11y):**
- Add `/demographics` to `THEMES`-iterated route list in
  `tests-e2e/a11y.spec.js`. axe must pass on all three themes.

**Playwright (a11y):**
- Add `/demographics` to `THEMES`-iterated route list in
  `tests-e2e/a11y.spec.js`. axe must pass on all three themes.

## Risks and open questions

- **Growth-rate semantics.** `effective_growth_rate = base × elasticity`
  is a guess at what the GM workbook actually computes. If the live
  Sheet has its own effective-rate cell we should source it directly;
  worth a quick GM check before implementation. If found, swap the
  computation for a direct named-range read.
- **`avg_satisfaction` duplication.** Same value lives on
  `status.demographics.avg_satisfaction` and
  `demographics.totals.avg_satisfaction`. Necessary because history
  only sees status — but the duplication is a small drift hazard.
  Mitigation: compute once in a shared helper (`extractors/_common.py`)
  and have both extractors call it.
- **Soft-optional drift.** If the GM later adds the `Var_*` ranges back
  with different semantics, the dashboard silently picks them up.
  Acceptable — the alternative (whitelisting specific value ranges) is
  over-engineered.
- **Old year snapshots lack new fields.** Sparklines for new metrics
  start at the deploy-day's year. Players may notice "history starts
  later" for the new tiles. Acceptable trade-off vs. a backfill that
  would need to re-derive values that may not have existed in past
  workbook states.
- **Mid-sync mixed-version `public/data/`.** A failure in one v3
  extractor leaves `meta.json` (written last) with `schema_version: 3`
  and `partial_failures: [<page>]`, but on-disk data may be a mix of
  v3-shaped pages (succeeded) and v2-shaped pages (last successful sync,
  not overwritten). The frontend reads `schema_version` from `meta.json`
  and shows the maintenance banner only on FULL mismatch — partial-shape
  pages would not currently trigger it. CLAUDE.md gotcha #6 already
  notes the `partial_failures` UI is not implemented. Mitigation: keep
  this spec's per-page extractors defensive (the `_scalar_named` /
  guard helpers ensure even partial data renders without crashing the
  page), and treat building out a per-page partial-failure UI as a
  follow-up. Not blocking for v3.

## Implementation order (high-level — full plan in plans/)

1. Backend: schema validator, extractor edits (status + pops +
   demographics), schema bump, fixture + pytest. Workbook gets sync'd
   locally with `--xlsx` flag against the new sheet to verify.
2. History: extend `scripts/history.py` snapshot dict, add derived
   stores in `src/lib/stores/history.js`. (Must precede §3 — Status's
   new sparklines consume these stores.)
3. Status page: column rebalance, Gov Approval KpiBlock, Pulse row,
   sparkline wiring on the new KPIs.
4. Frontend plumbing: new `demographics` store, new
   `Demographics.svelte` route, App.svelte routing, NavBar link,
   `KpiBlock.svelte` 1-line edit, `global.css` additions across all
   three themes.
5. Demographics page itself: 4 bands per §2.
6. Playwright a11y across all three themes.
7. Manual verification: run sync against new SHEET_ID locally, smoke
   test in dev server, exercise housing >100% case if reachable in
   live data.
8. Operational handoff: user updates `vars.SHEET_ID` in repo settings.
