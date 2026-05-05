# Demographics Page + Status Vitals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the new GM workbook's mortality, housing, food security, and gov-approval systems by extending Status with new top-line vitals and adding a new `/demographics` route, while bumping the data schema from v2 to v3.

**Architecture:** Three-tier change. Backend: new `demographics.py` extractor, plus extensions to `status.py` and `pops.py`; schema validator splits required ranges into hard (structural) vs soft (tuning knobs); history snapshot dict gains six new fields. Frontend: new store + route + NavBar link; Status page rebalances Vital Signs and adds a Pulse tile-row; new CSS for overflow-bar and critical-KpiBlock treatments across all three themes. Tests: pytest (TDD per change) + Playwright a11y.

**Tech Stack:** Python 3.11 / openpyxl / pytest (sync pipeline); Svelte 4 / Vite / svelte-spa-router (frontend); Playwright + axe-core (a11y).

**Spec:** `docs/superpowers/specs/2026-05-06-demographics-page-and-status-vitals-design.md`

---

## File Structure

### Files to create

| Path | Purpose |
| --- | --- |
| `scripts/extractors/demographics.py` | Reads totals/housing/food blocks → writes `demographics.json`. |
| `tests/extractors/test_demographics.py` | Tests for the new extractor. |
| `src/lib/stores/demographics.js` | Frontend store mirroring `pops.js` shape. |
| `src/routes/Demographics.svelte` | New `/demographics` route. |

### Files to modify

| Path | Change |
| --- | --- |
| `scripts/sync_sheet.py` | Bump `SCHEMA_VERSION 2 → 3`; register `demographics` extractor. |
| `scripts/validate_schema.py` | Add 11 hard-required ranges; document 5 soft-optional. |
| `scripts/extractors/status.py` | Add `gov_approval` + `demographics` block with helpers. |
| `scripts/extractors/pops.py` | Add `mortality_rate` / `deaths_per_turn` / `unemployed_count` per class. |
| `scripts/history.py` | Extend snapshot dict with 6 new fields (PRESERVING existing key shapes). |
| `tests/fixtures/build_test_workbook.py` | Add Mortality / Housing / Cropsim sheets + new ranges. |
| `tests/extractors/test_status.py` | Add tests for gov_approval, demographics block, helpers. |
| `tests/extractors/test_pops.py` | Add tests for new per-class fields + length-guard. |
| `tests/test_history.py` | Add test verifying treasury shape preserved + new fields appear. |
| `tests/test_validate_schema.py` | Add test for the 11 new hard-required ranges. |
| `src/lib/stores/meta.js` | Bump `EXPECTED_SCHEMA_VERSION 2 → 3`. |
| `src/lib/stores/history.js` | Add 6 new derived stores. |
| `src/lib/components/KpiBlock.svelte` | Add `class:critical` to wrapper div (1-line edit). |
| `src/lib/components/NavBar.svelte` | Insert "Demographics" link between Pops and GoIs. |
| `src/App.svelte` | Add `/demographics` route binding. |
| `src/routes/Status.svelte` | Vital Signs column rebalance, Gov Approval, Pulse row. |
| `src/styles/global.css` | Add `.bar.overflow` + `.kpi-block.critical` for all 3 themes. |
| `tests-e2e/a11y.spec.js` | Add `/demographics` to themes-iterated route list. |

---

## Phase 1 — Schema groundwork

### Task 1: Bump schema version constants

**Files:**
- Modify: `scripts/sync_sheet.py:36`
- Modify: `src/lib/stores/meta.js:7`

- [ ] **Step 1: Bump backend constant**

In `scripts/sync_sheet.py`, change line 36:

```python
SCHEMA_VERSION = 3
```

- [ ] **Step 2: Bump frontend constant**

In `src/lib/stores/meta.js`, change line 7:

```js
const EXPECTED_SCHEMA_VERSION = 3;
```

- [ ] **Step 3: Verify lockstep visually**

Run:
```bash
grep -n "SCHEMA_VERSION" scripts/sync_sheet.py src/lib/stores/meta.js
```

Expected output: both files show `3`. Mismatch is a hard CLAUDE.md violation.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync_sheet.py src/lib/stores/meta.js
git commit -m "chore(schema): bump SCHEMA_VERSION 2 → 3 (lockstep)"
```

---

### Task 2: Extend schema validator with hard-required ranges

**Files:**
- Modify: `scripts/validate_schema.py`
- Modify: `tests/test_validate_schema.py`

- [ ] **Step 1: Write failing test for new required ranges**

Append to `tests/test_validate_schema.py` (read the existing file first to see its conftest patterns):

```python
import pytest

from validate_schema import SchemaValidationError, validate

NEW_HARD_REQUIRED = [
    "EffectiveGovApproval", "TotalDeathsPerTurn", "EffectiveCDR",
    "MortalityRates", "DeathsPerTurn", "PopsimUnemployed",
    "HousingCapacity", "HousingRatio",
    "FoodSecurityRatio", "FoodPerCap", "FoodVarietyIndex",
]


@pytest.mark.parametrize("missing_name", NEW_HARD_REQUIRED)
def test_validator_rejects_missing_v3_range(wb, missing_name):
    """Each new hard-required range must be present; removing one fails validation."""
    del wb.defined_names[missing_name]
    with pytest.raises(SchemaValidationError) as excinfo:
        validate(wb, senate_enabled=False)
    assert missing_name in str(excinfo.value)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest tests/test_validate_schema.py::test_validator_rejects_missing_v3_range -v
```

Expected: 11 parametrized cases all FAIL with `KeyError` from `del wb.defined_names[<name>]` (because the fixture doesn't have these names yet — that's added in Task 3).

- [ ] **Step 3: Extend `BASE_REQUIRED_RANGES`**

In `scripts/validate_schema.py`, append to the `BASE_REQUIRED_RANGES` list (just before the closing `]`, after the existing `# Note: …` comment):

```python
    # v3 — Status colony vitals
    "EffectiveGovApproval",
    "TotalDeathsPerTurn",
    "EffectiveCDR",
    # v3 — Per-class mortality (consumed by pops.py + demographics.py)
    "MortalityRates",
    "DeathsPerTurn",
    "PopsimUnemployed",
    # v3 — Housing
    "HousingCapacity",
    "HousingRatio",
    # v3 — Food security
    "FoodSecurityRatio",
    "FoodPerCap",
    "FoodVarietyIndex",
```

Then BELOW `SENATE_REQUIRED_RANGES` (before `def validate`), add the documentation list:

```python
# Soft-optional v3 ranges. Validator does NOT require these — extractors
# read them via _scalar_named (which returns None for missing names) so
# the dashboard degrades gracefully if the GM removes a tuning knob.
SOFT_OPTIONAL_V3_RANGES: list[str] = [
    "Var_BaseGrowthRate",
    "Var_GrowthSatElasticity",
    "Var_BaseDeathRate",
    "HousingGrowthMult",
    "Var_HousingOvercrowdingExp",
]
```

- [ ] **Step 4: Run test — still fails until fixture adds the ranges**

```bash
uv run pytest tests/test_validate_schema.py::test_validator_rejects_missing_v3_range -v
```

Expected: still FAILing — fixture doesn't define these names yet. Will pass after Task 3.

- [ ] **Step 5: Commit (test red, validator green)**

```bash
git add scripts/validate_schema.py tests/test_validate_schema.py
git commit -m "feat(schema): require v3 ranges in validator (test red until fixture lands)"
```

---

### Task 3: Extend test fixture with v3 sheets and ranges

**Files:**
- Modify: `tests/fixtures/build_test_workbook.py`

- [ ] **Step 1: Add Variable sheet rows for tuning knobs**

In `build_test_workbook.py`, find the `# ---- Variable sheet ----` block (around line 44). After the existing `Var_Year` line, append:

```python
    # v3 tuning knobs (soft-optional in validator; extractors check presence).
    var["A3"], var["B3"] = "Var_BaseDeathRate", 0.012
    _add_name(wb, "Var_BaseDeathRate", "Variable!$B$3")
    var["A4"], var["B4"] = "Var_HousingOvercrowdingExp", 1.5
    _add_name(wb, "Var_HousingOvercrowdingExp", "Variable!$B$4")
    var["A5"], var["B5"] = "Var_BaseGrowthRate", 0.020
    _add_name(wb, "Var_BaseGrowthRate", "Variable!$B$5")
    var["A6"], var["B6"] = "Var_GrowthSatElasticity", 0.95
    _add_name(wb, "Var_GrowthSatElasticity", "Variable!$B$6")
```

- [ ] **Step 2: Add EffectiveGovApproval to Politics sheet**

Still in the Politics sheet block (after the Overton additions, around line 67), append:

```python
    pol["B2"] = 0.62  # Effective Gov Approval
    _add_name(wb, "EffectiveGovApproval", "Politics!$B$2")
```

- [ ] **Step 3: Add Housing scalars to Colony sheet**

After the existing `_add_name(wb, "ResourceFlows", ...)` line in the Colony block, append:

```python
    col["A12"], col["B12"], col["C12"], col["I12"] = "Housing", "capacity", 16500, 0.96
    _add_name(wb, "HousingCapacity", "Colony!$C$12")
    _add_name(wb, "HousingRatio", "Colony!$I$12")
```

- [ ] **Step 4: Add Mortality sheet**

After the Wages & Welfare block (around line 195, before `# Politics GoI block`), insert:

```python
    # ---- Mortality sheet (v3) ----
    mort = wb.create_sheet("Mortality")
    # Per-class mortality rates and deaths/turn; rows 13-23 (11 classes).
    # Live workbook spans 13-27 (15 slots); fixture only fills 11.
    for i, (name, _, p, _w) in enumerate(classes, start=13):
        mort.cell(row=i, column=1, value=name)
        rate = 0.010 + (i - 13) * 0.001  # 0.010 .. 0.020
        mort.cell(row=i, column=6, value=rate)         # F mortality rate
        mort.cell(row=i, column=7, value=int(p * rate))  # G deaths/turn
    mort["A30"], mort["B30"] = "Total deaths/turn", 280  # round figure
    mort["A31"], mort["B31"] = "Effective CDR", 0.0125
    _add_name(wb, "MortalityRates", "Mortality!$F$13:$F$27")
    _add_name(wb, "DeathsPerTurn", "Mortality!$G$13:$G$27")
    _add_name(wb, "TotalDeathsPerTurn", "Mortality!$B$30")
    _add_name(wb, "EffectiveCDR", "Mortality!$B$31")
```

- [ ] **Step 5: Add Housing sheet (HousingGrowthMult only — others on Colony already)**

After the Mortality block:

```python
    # ---- Housing sheet (v3, just for HousingGrowthMult) ----
    hou = wb.create_sheet("Housing")
    hou["A12"], hou["B12"] = "Housing growth mult", 0.92
    _add_name(wb, "HousingGrowthMult", "Housing!$B$12")
```

- [ ] **Step 6: Add Cropsim sheet (food security)**

After the Housing block:

```python
    # ---- Cropsim sheet (v3 food security) ----
    cs = wb.create_sheet("Cropsim")
    cs["A26"], cs["B26"] = "Food security ratio", 1.05
    cs["A27"], cs["B27"] = "Food per cap", 1.20
    cs["A28"], cs["B28"] = "Food variety index", 0.78
    _add_name(wb, "FoodSecurityRatio", "Cropsim!$B$26")
    _add_name(wb, "FoodPerCap", "Cropsim!$B$27")
    _add_name(wb, "FoodVarietyIndex", "Cropsim!$B$28")
```

- [ ] **Step 7: Add PopsimUnemployed range**

In the Popsim block (around line 140 where `WorkforceSupplyDemand` is added), AFTER that named-range line, append:

```python
    # PopsimUnemployed: raw count (separate from WorkforceSupplyDemand col E ratio).
    # Live wb places at E25:E39; fixture uses col K to avoid overlap.
    for i, (name, _, p, _w) in enumerate(classes, start=24):
        pop.cell(row=i, column=11, value=int(p * (0.05 + (i - 24) * 0.005)))
    _add_name(wb, "PopsimUnemployed", "Popsim!$K$24:$K$37")
```

- [ ] **Step 8: Run validator test — should now pass**

```bash
uv run pytest tests/test_validate_schema.py::test_validator_rejects_missing_v3_range -v
```

Expected: all 11 parametrized cases PASS (each finds the named range, deletes it, validation raises).

- [ ] **Step 9: Run full test suite — confirm fixture changes haven't broken anything**

```bash
uv run pytest tests/ -x
```

Expected: pre-existing GoI/treasury drift failures unchanged in count (per CLAUDE.md gotcha #10); no new failures from fixture additions. If a previously-passing test now fails, the fixture additions broke something — fix before committing.

- [ ] **Step 10: Commit**

```bash
git add tests/fixtures/build_test_workbook.py
git commit -m "test(fixture): add v3 sheets (Mortality, Housing, Cropsim) + ranges"
```

---

## Phase 2 — Status extractor extension

### Task 4: Add `gov_approval` to status.py

**Files:**
- Modify: `scripts/extractors/status.py`
- Modify: `tests/extractors/test_status.py`

- [ ] **Step 1: Write failing test**

Append to `tests/extractors/test_status.py`:

```python
def test_extract_returns_gov_approval(wb):
    result = extract(wb)
    assert result["gov_approval"] == 0.62


def test_extract_gov_approval_none_when_range_missing(wb):
    del wb.defined_names["EffectiveGovApproval"]
    result = extract(wb)
    assert result["gov_approval"] is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest tests/extractors/test_status.py::test_extract_returns_gov_approval tests/extractors/test_status.py::test_extract_gov_approval_none_when_range_missing -v
```

Expected: both FAIL with `KeyError: 'gov_approval'`.

- [ ] **Step 3: Implement**

In `scripts/extractors/status.py`, add to the dict returned by `extract` (just below `"overton": _overton(wb),`):

```python
        "gov_approval": _scalar_named(wb, "EffectiveGovApproval"),
```

- [ ] **Step 4: Run test to verify it passes**

```bash
uv run pytest tests/extractors/test_status.py::test_extract_returns_gov_approval tests/extractors/test_status.py::test_extract_gov_approval_none_when_range_missing -v
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/extractors/status.py tests/extractors/test_status.py
git commit -m "feat(status): expose gov_approval scalar"
```

---

### Task 5: Add `_avg_satisfaction` helper to status.py

**Files:**
- Modify: `scripts/extractors/status.py`
- Modify: `tests/extractors/test_status.py`

- [ ] **Step 1: Write failing test**

Append to `tests/extractors/test_status.py`:

```python
def test_avg_satisfaction_population_weighted(wb):
    """Weighted mean across PopsimSatisfaction × PopsimPop."""
    from extractors.status import _avg_satisfaction
    # Fixture: all sat = 0.40, all pops varied. Weighted mean = 0.40.
    assert _avg_satisfaction(wb) == 0.40


def test_avg_satisfaction_returns_none_when_total_pop_zero(wb):
    """Guard against division by zero when every pop cell is zero/None."""
    from extractors.status import _avg_satisfaction
    pop_sheet = wb["Popsim"]
    for row in range(5, 20):  # PopsimPop range B5:B19
        pop_sheet.cell(row=row, column=2, value=0)
    assert _avg_satisfaction(wb) is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest tests/extractors/test_status.py::test_avg_satisfaction_population_weighted tests/extractors/test_status.py::test_avg_satisfaction_returns_none_when_total_pop_zero -v
```

Expected: FAIL with `ImportError: cannot import name '_avg_satisfaction'`.

- [ ] **Step 3: Implement**

In `scripts/extractors/status.py`, add a helper after `_active_situations` (end of file):

```python
def _avg_satisfaction(wb) -> float | None:
    """Population-weighted mean of PopsimSatisfaction.

    Returns None when total population is zero or both ranges are
    missing — guards against div-by-zero on early-game / depopulated
    workbooks. Skips rows where either value is None.
    """
    sats = read_named_range(wb, "PopsimSatisfaction")
    pops = read_named_range(wb, "PopsimPop")
    weighted_sum = 0.0
    total_pop = 0.0
    for i in range(min(len(sats), len(pops))):
        sat = coerce_number(sats[i][0]) if sats[i] else None
        pop = coerce_number(pops[i][0]) if pops[i] else None
        if sat is None or pop is None:
            continue
        weighted_sum += sat * pop
        total_pop += pop
    return weighted_sum / total_pop if total_pop > 0 else None
```

Add to imports at the top:

```python
from extractors._common import coerce_number, read_named_range
```

(only add `read_named_range` if not already imported — `_common` already exports both).

- [ ] **Step 4: Run test to verify it passes**

```bash
uv run pytest tests/extractors/test_status.py::test_avg_satisfaction_population_weighted tests/extractors/test_status.py::test_avg_satisfaction_returns_none_when_total_pop_zero -v
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/extractors/status.py tests/extractors/test_status.py
git commit -m "feat(status): add _avg_satisfaction helper with zero-pop guard"
```

---

### Task 6: Add `_housing_util` helper

**Files:**
- Modify: `scripts/extractors/status.py`
- Modify: `tests/extractors/test_status.py`

- [ ] **Step 1: Write failing test**

Append to `tests/extractors/test_status.py`:

```python
def test_housing_util_normal_case():
    """pop / capacity returns ratio in 0..∞ range."""
    from extractors.status import _housing_util
    assert _housing_util(15870, 16500) == 15870 / 16500


def test_housing_util_returns_none_when_capacity_zero():
    """Div-by-zero guard."""
    from extractors.status import _housing_util
    assert _housing_util(15870, 0) is None
    assert _housing_util(15870, None) is None
    assert _housing_util(0, 16500) == 0.0  # zero pop OK; zero capacity not.
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest tests/extractors/test_status.py::test_housing_util_normal_case tests/extractors/test_status.py::test_housing_util_returns_none_when_capacity_zero -v
```

Expected: FAIL with `ImportError`.

- [ ] **Step 3: Implement**

In `scripts/extractors/status.py`, add helper:

```python
def _housing_util(pop: float | None, capacity: float | None) -> float | None:
    """Returns pop/capacity ratio (0..∞). None when capacity is missing or 0."""
    if capacity in (None, 0):
        return None
    if pop is None:
        return None
    return pop / capacity
```

- [ ] **Step 4: Run test to verify it passes**

```bash
uv run pytest tests/extractors/test_status.py::test_housing_util_normal_case tests/extractors/test_status.py::test_housing_util_returns_none_when_capacity_zero -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/extractors/status.py tests/extractors/test_status.py
git commit -m "feat(status): add _housing_util helper with capacity guard"
```

---

### Task 7: Add `_net_delta_pct` helper

**Files:**
- Modify: `scripts/extractors/status.py`
- Modify: `tests/extractors/test_status.py`

- [ ] **Step 1: Write failing test**

Append to `tests/extractors/test_status.py`:

```python
def test_net_delta_pct_normal():
    from extractors.status import _net_delta_pct
    # growth=0.02, cdr=0.012 → (0.02 - 0.012) * 100 = 0.8
    assert _net_delta_pct(0.020, 0.012) == pytest.approx(0.8)


def test_net_delta_pct_none_when_either_input_missing():
    from extractors.status import _net_delta_pct
    assert _net_delta_pct(None, 0.012) is None
    assert _net_delta_pct(0.020, None) is None
    assert _net_delta_pct(None, None) is None
```

Add `import pytest` at the top of `test_status.py` if not already present.

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest tests/extractors/test_status.py::test_net_delta_pct_normal tests/extractors/test_status.py::test_net_delta_pct_none_when_either_input_missing -v
```

Expected: FAIL with `ImportError`.

- [ ] **Step 3: Implement**

In `scripts/extractors/status.py`:

```python
def _net_delta_pct(effective_growth: float | None, cdr: float | None) -> float | None:
    """Net population change as a percentage. None when either input is missing."""
    if effective_growth is None or cdr is None:
        return None
    return (effective_growth - cdr) * 100
```

- [ ] **Step 4: Run test to verify it passes**

```bash
uv run pytest tests/extractors/test_status.py::test_net_delta_pct_normal tests/extractors/test_status.py::test_net_delta_pct_none_when_either_input_missing -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/extractors/status.py tests/extractors/test_status.py
git commit -m "feat(status): add _net_delta_pct helper"
```

---

### Task 8: Wire `demographics` block into status.extract()

**Files:**
- Modify: `scripts/extractors/status.py`
- Modify: `tests/extractors/test_status.py`

- [ ] **Step 1: Write failing test**

Append to `tests/extractors/test_status.py`:

```python
def test_extract_demographics_block_shape(wb):
    result = extract(wb)
    demo = result["demographics"]
    assert set(demo.keys()) == {
        "base_growth_rate", "sat_elasticity", "effective_growth_rate",
        "effective_cdr", "total_deaths", "net_delta_pct",
        "housing_capacity", "housing_util", "avg_satisfaction",
    }


def test_extract_demographics_values_from_fixture(wb):
    result = extract(wb)
    demo = result["demographics"]
    assert demo["base_growth_rate"] == 0.020
    assert demo["sat_elasticity"] == 0.95
    assert demo["effective_growth_rate"] == pytest.approx(0.020 * 0.95)
    assert demo["effective_cdr"] == 0.0125
    assert demo["total_deaths"] == 280
    assert demo["housing_capacity"] == 16500
    assert demo["avg_satisfaction"] == 0.40


def test_extract_demographics_effective_growth_none_when_base_missing(wb):
    del wb.defined_names["Var_BaseGrowthRate"]
    result = extract(wb)
    demo = result["demographics"]
    assert demo["base_growth_rate"] is None
    assert demo["effective_growth_rate"] is None
    assert demo["net_delta_pct"] is None  # chains through
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest tests/extractors/test_status.py::test_extract_demographics_block_shape -v
```

Expected: FAIL with `KeyError: 'demographics'`.

- [ ] **Step 3: Implement `_demographics_block` and wire into extract()**

In `scripts/extractors/status.py`, add helper:

```python
def _demographics_block(wb, population_total: int) -> dict:
    """Aggregate demographics scalars consumed by Status's Pulse row.

    Soft-optional Var_* ranges return None when missing — _scalar_named
    handles that (read_named_range returns [] for unknown names, so
    _scalar_named short-circuits to None).
    """
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
        "housing_util": _housing_util(population_total, capacity),
        "avg_satisfaction": _avg_satisfaction(wb),
    }
```

Then modify `extract()` — replace its return statement so it builds `population_total` first, then includes the demographics block:

```python
def extract(wb) -> dict[str, Any]:
    population_total = _population_total(wb)
    return {
        "year": _year(wb),
        "treasury": _treasury(wb),
        "stability": _scalar_named(wb, "Stability"),
        "crisis_factor": _scalar_named(wb, "CrisisFactor"),
        "population_total": population_total,
        "resources": _resources(wb),
        "overton": _overton(wb),
        "active_situations": _active_situations(wb),
        "gov_approval": _scalar_named(wb, "EffectiveGovApproval"),
        "demographics": _demographics_block(wb, population_total),
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
uv run pytest tests/extractors/test_status.py -v
```

Expected: ALL status tests PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add scripts/extractors/status.py tests/extractors/test_status.py
git commit -m "feat(status): emit demographics block (Pulse row data + sparkline source)"
```

---

## Phase 3 — Pops extractor extension

### Task 9: Add per-class mortality / deaths / unemployed_count to pops.py

**Files:**
- Modify: `scripts/extractors/pops.py`
- Modify: `tests/extractors/test_pops.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/extractors/test_pops.py` (read existing file first to get import patterns):

```python
def test_pops_per_class_mortality_present(wb):
    from extractors.pops import extract
    result = extract(wb)
    assert len(result["classes"]) > 0
    first = result["classes"][0]
    assert "mortality_rate" in first
    assert "deaths_per_turn" in first
    assert "unemployed_count" in first


def test_pops_mortality_values_from_fixture(wb):
    from extractors.pops import extract
    result = extract(wb)
    # First class: mortality 0.010, pop 970 → deaths ~ 9 (int)
    first = result["classes"][0]
    assert first["mortality_rate"] == pytest.approx(0.010)
    assert first["deaths_per_turn"] == 9  # int(970 * 0.010)


def test_pops_handles_short_mortality_range(wb):
    """If MortalityRates has fewer rows than ClassTable, missing rows surface as None — no IndexError."""
    from openpyxl.workbook.defined_name import DefinedName
    # Override MortalityRates to point at 5 rows of empty cells far away
    wb.defined_names["MortalityRates"] = DefinedName(
        "MortalityRates", attr_text="Popsim!$X$200:$X$204"
    )
    from extractors.pops import extract
    result = extract(wb)
    # All classes should still extract; mortality_rate is None for all
    # (the 5 cells are empty by default)
    for cls in result["classes"]:
        assert cls["mortality_rate"] is None
```

Add `import pytest` at the top if not already present.

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/extractors/test_pops.py::test_pops_per_class_mortality_present tests/extractors/test_pops.py::test_pops_mortality_values_from_fixture tests/extractors/test_pops.py::test_pops_handles_short_mortality_range -v
```

Expected: all FAIL with `KeyError`.

- [ ] **Step 3: Implement — extend `pops.py:extract()`**

In `scripts/extractors/pops.py`, ADD reads alongside the existing per-class reads (in `extract` function, after the `sat = read_named_range(wb, "PopsimSatisfaction")` line):

```python
    mortality_rates = read_named_range(wb, "MortalityRates")
    deaths_per_turn = read_named_range(wb, "DeathsPerTurn")
    unemployed_count = read_named_range(wb, "PopsimUnemployed")
```

Then in the per-class dict construction (the `out.append({...})` block), add three keys (place them next to `"satisfaction"` for grouping):

```python
            "satisfaction": coerce_number(sat[i][0]) if i < len(sat) else None,
            "mortality_rate": coerce_number(mortality_rates[i][0]) if i < len(mortality_rates) else None,
            "deaths_per_turn": coerce_number(deaths_per_turn[i][0]) if i < len(deaths_per_turn) else None,
            "unemployed_count": coerce_number(unemployed_count[i][0]) if i < len(unemployed_count) else None,
```

The existing `if i < len(rng) else None` length-guard pattern is what protects against shorter ranges.

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/extractors/test_pops.py -v
```

Expected: ALL pops tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/extractors/pops.py tests/extractors/test_pops.py
git commit -m "feat(pops): add per-class mortality_rate, deaths_per_turn, unemployed_count"
```

---

## Phase 4 — Demographics extractor

### Task 10: Create demographics.py extractor

**Files:**
- Create: `scripts/extractors/demographics.py`
- Create: `tests/extractors/test_demographics.py`

- [ ] **Step 1: Write failing tests**

Create `tests/extractors/test_demographics.py`:

```python
"""Tests for the new Demographics page extractor."""
from __future__ import annotations

import pytest

from extractors.demographics import extract


def test_extract_returns_top_level_blocks(wb):
    result = extract(wb)
    assert set(result.keys()) == {"totals", "housing", "food"}


def test_totals_block_shape(wb):
    result = extract(wb)
    totals = result["totals"]
    assert set(totals.keys()) == {
        "pop", "effective_cdr", "total_deaths",
        "effective_growth_rate", "net_delta_pct", "avg_satisfaction",
    }


def test_totals_values(wb):
    result = extract(wb)
    totals = result["totals"]
    assert totals["pop"] == 15870  # sum of fixture's class populations
    assert totals["effective_cdr"] == 0.0125
    assert totals["total_deaths"] == 280
    assert totals["effective_growth_rate"] == pytest.approx(0.020 * 0.95)
    assert totals["avg_satisfaction"] == 0.40


def test_housing_block_shape(wb):
    result = extract(wb)
    housing = result["housing"]
    assert set(housing.keys()) == {"capacity", "pop", "ratio", "overcrowding_exp", "growth_mult"}
    assert housing["capacity"] == 16500
    assert housing["pop"] == 15870
    assert housing["ratio"] == 0.96
    assert housing["overcrowding_exp"] == 1.5
    assert housing["growth_mult"] == 0.92


def test_housing_soft_optional_growth_mult_missing(wb):
    """Removing HousingGrowthMult should make it None, not crash."""
    del wb.defined_names["HousingGrowthMult"]
    result = extract(wb)
    assert result["housing"]["growth_mult"] is None
    assert result["housing"]["capacity"] == 16500  # other fields unaffected


def test_housing_soft_optional_overcrowding_missing(wb):
    del wb.defined_names["Var_HousingOvercrowdingExp"]
    result = extract(wb)
    assert result["housing"]["overcrowding_exp"] is None


def test_food_block_shape(wb):
    result = extract(wb)
    food = result["food"]
    assert set(food.keys()) == {"security_ratio", "per_cap", "variety_index"}
    assert food["security_ratio"] == 1.05
    assert food["per_cap"] == 1.20
    assert food["variety_index"] == 0.78


def test_avg_satisfaction_zero_pop_guard(wb):
    """All-zero PopsimPop → avg_satisfaction is None (no div-by-zero)."""
    pop_sheet = wb["Popsim"]
    for row in range(5, 20):
        pop_sheet.cell(row=row, column=2, value=0)
    result = extract(wb)
    assert result["totals"]["avg_satisfaction"] is None
    assert result["totals"]["pop"] == 0


def test_housing_capacity_zero_means_ratio_passthrough(wb):
    """When capacity is 0 in the workbook, ratio is whatever the workbook says (we
    don't second-guess HousingRatio); pop is still emitted unchanged."""
    wb["Colony"]["C12"] = 0
    result = extract(wb)
    assert result["housing"]["capacity"] == 0
    # ratio comes straight from HousingRatio cell — we don't recompute on the fly.
    assert result["housing"]["ratio"] == 0.96
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/extractors/test_demographics.py -v
```

Expected: ALL FAIL with `ModuleNotFoundError: No module named 'extractors.demographics'`.

- [ ] **Step 3: Implement extractor**

Create `scripts/extractors/demographics.py`:

```python
"""Extract data for the Demographics page.

Colony-wide totals + housing + food security. Per-class mortality data
lives on pops.json (see extractors/pops.py) — Demographics route reads
$pops.classes for its Class Vitals table.
"""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, read_named_range
from extractors.status import _avg_satisfaction, _net_delta_pct


def extract(wb) -> dict[str, Any]:
    pop_total = _population_total(wb)
    base = _scalar(wb, "Var_BaseGrowthRate")
    elasticity = _scalar(wb, "Var_GrowthSatElasticity")
    cdr = _scalar(wb, "EffectiveCDR")
    effective_growth = base * elasticity if (base is not None and elasticity is not None) else None
    return {
        "totals": {
            "pop": pop_total,
            "effective_cdr": cdr,
            "total_deaths": _scalar(wb, "TotalDeathsPerTurn"),
            "effective_growth_rate": effective_growth,
            "net_delta_pct": _net_delta_pct(effective_growth, cdr),
            "avg_satisfaction": _avg_satisfaction(wb),
        },
        "housing": {
            "capacity": _scalar(wb, "HousingCapacity"),
            "pop": pop_total,
            "ratio": _scalar(wb, "HousingRatio"),
            "overcrowding_exp": _scalar(wb, "Var_HousingOvercrowdingExp"),
            "growth_mult": _scalar(wb, "HousingGrowthMult"),
        },
        "food": {
            "security_ratio": _scalar(wb, "FoodSecurityRatio"),
            "per_cap": _scalar(wb, "FoodPerCap"),
            "variety_index": _scalar(wb, "FoodVarietyIndex"),
        },
    }


def _scalar(wb, name: str) -> float | None:
    rows = read_named_range(wb, name)
    if not rows or not rows[0]:
        return None
    return coerce_number(rows[0][0])


def _population_total(wb) -> int:
    rows = read_named_range(wb, "PopsimPop")
    total = 0.0
    for row in rows:
        v = coerce_number(row[0])
        if v is not None:
            total += v
    return int(total)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/extractors/test_demographics.py -v
```

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/extractors/demographics.py tests/extractors/test_demographics.py
git commit -m "feat(extractors): add demographics extractor (totals + housing + food)"
```

---

## Phase 5 — Sync orchestration

### Task 11: Register demographics in sync_sheet.py

**Files:**
- Modify: `scripts/sync_sheet.py`
- Modify: `tests/test_sync_sheet.py` (add an integration assertion)

- [ ] **Step 1: Write failing test**

Append to `tests/test_sync_sheet.py` (read existing file first to get fixture/test patterns):

```python
def test_run_sync_writes_demographics_json(fixture_workbook_path, tmp_path):
    from sync_sheet import run_sync
    out_dir = tmp_path / "data"
    out_dir.mkdir()
    run_sync(fixture_workbook_path, out_dir)
    assert (out_dir / "demographics.json").exists()
    import json
    payload = json.loads((out_dir / "demographics.json").read_text())
    assert "totals" in payload
    assert "housing" in payload
    assert "food" in payload
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest tests/test_sync_sheet.py::test_run_sync_writes_demographics_json -v
```

Expected: FAIL — `demographics.json` does not exist (extractor not registered).

- [ ] **Step 3: Register extractor in sync_sheet.py**

In `scripts/sync_sheet.py`, add an import (alphabetised among existing extractor imports, around line 22):

```python
from extractors import demographics as ex_demographics
```

Then in `run_sync`'s `extractors` list, add the new entry after `pops`:

```python
        ("status", ex_status.extract),
        ("population", ex_population.extract),
        ("pops", ex_pops.extract),
        ("demographics", ex_demographics.extract),  # NEW
        ("gois", ex_gois.extract),
        ("parties", ex_parties.extract),
        ("map", ex_map.extract),
        ("situations", ex_situations.extract),
```

- [ ] **Step 4: Run test to verify it passes**

```bash
uv run pytest tests/test_sync_sheet.py -v
```

Expected: PASS.

- [ ] **Step 5: Smoke-run the full pytest suite**

```bash
uv run pytest tests/ -x -q
```

Expected: all NEW tests pass; pre-existing GoI/treasury fixture-drift failures unchanged in count and identity (per CLAUDE.md gotcha #10). The `test_run_sync_writes_demographics_json` test exercises the full pipeline end-to-end against the fixture.

- [ ] **Step 6: Commit**

```bash
git add scripts/sync_sheet.py tests/test_sync_sheet.py
git commit -m "feat(sync): register demographics extractor"
```

---

## Phase 6 — History pipeline

### Task 12: Extend history.py snapshot dict (preserving existing key shapes)

**Files:**
- Modify: `scripts/history.py`
- Modify: `tests/test_history.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/test_history.py` (read existing file first to confirm fixture patterns):

```python
def test_snapshot_preserves_treasury_dict_shape(tmp_path):
    """Critical regression guard: treasury must remain a dict, not be flattened
    to a scalar — frontend treasuryHistory store reads s?.treasury?.money."""
    from history import write_snapshot
    status_data = {
        "treasury": {"money": 487, "delta": -12},
        "stability": 0.42,
        "crisis_factor": 0.38,
        "population_total": 15870,
        "resources": [],
        "overton": {},
        "gov_approval": 0.62,
        "demographics": {
            "total_deaths": 280,
            "effective_cdr": 0.0125,
            "net_delta_pct": 0.8,
            "housing_util": 0.96,
            "avg_satisfaction": 0.40,
        },
    }
    write_snapshot(tmp_path, year=12, status_data=status_data, synced_at="2026-05-06T00:00:00Z")
    import json
    snap = json.loads((tmp_path / "history" / "year-012.json").read_text())
    assert snap["treasury"] == {"money": 487, "delta": -12}, "treasury must stay as dict"


def test_snapshot_includes_v3_demographics_fields(tmp_path):
    from history import write_snapshot
    status_data = {
        "treasury": {"money": 0, "delta": 0},
        "stability": 0.5, "crisis_factor": 0.0,
        "population_total": 100, "resources": [], "overton": {},
        "gov_approval": 0.62,
        "demographics": {
            "total_deaths": 280,
            "effective_cdr": 0.0125,
            "net_delta_pct": 0.8,
            "housing_util": 0.96,
            "avg_satisfaction": 0.40,
        },
    }
    write_snapshot(tmp_path, year=12, status_data=status_data, synced_at="2026-05-06T00:00:00Z")
    import json
    snap = json.loads((tmp_path / "history" / "year-012.json").read_text())
    assert snap["gov_approval"] == 0.62
    assert snap["total_deaths"] == 280
    assert snap["effective_cdr"] == 0.0125
    assert snap["net_delta_pct"] == 0.8
    assert snap["housing_util"] == 0.96
    assert snap["avg_satisfaction"] == 0.40


def test_snapshot_v3_fields_default_none_when_absent(tmp_path):
    """When status_data lacks the v3 demographics block (old workbook),
    snapshot writes None — derived stores filter on != null."""
    from history import write_snapshot
    status_data = {
        "treasury": {"money": 0, "delta": 0},
        "stability": 0.5, "crisis_factor": 0.0,
        "population_total": 100, "resources": [], "overton": {},
    }
    write_snapshot(tmp_path, year=12, status_data=status_data, synced_at="2026-05-06T00:00:00Z")
    import json
    snap = json.loads((tmp_path / "history" / "year-012.json").read_text())
    assert snap["gov_approval"] is None
    assert snap["total_deaths"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/test_history.py::test_snapshot_preserves_treasury_dict_shape tests/test_history.py::test_snapshot_includes_v3_demographics_fields tests/test_history.py::test_snapshot_v3_fields_default_none_when_absent -v
```

Expected: the v3-fields tests FAIL (`KeyError: 'gov_approval'`); the treasury-shape test PASSES already (we haven't changed history.py yet).

- [ ] **Step 3: Extend snapshot dict**

In `scripts/history.py`, replace the `snapshot = {...}` block (lines 29-38) with:

```python
    snapshot = {
        "year": year,
        "synced_at": synced_at,
        # Existing v2 keys — shapes preserved verbatim:
        "treasury": status_data.get("treasury"),
        "stability": status_data.get("stability"),
        "crisis_factor": status_data.get("crisis_factor"),
        "population_total": status_data.get("population_total"),
        "resources": status_data.get("resources", []),
        "overton": status_data.get("overton", {}),
        # v3 additions — None when status didn't provide them:
        "gov_approval": status_data.get("gov_approval"),
        "total_deaths": status_data.get("demographics", {}).get("total_deaths"),
        "effective_cdr": status_data.get("demographics", {}).get("effective_cdr"),
        "net_delta_pct": status_data.get("demographics", {}).get("net_delta_pct"),
        "housing_util": status_data.get("demographics", {}).get("housing_util"),
        "avg_satisfaction": status_data.get("demographics", {}).get("avg_satisfaction"),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/test_history.py -v
```

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/history.py tests/test_history.py
git commit -m "feat(history): extend snapshot with v3 demographics fields (treasury shape preserved)"
```

---

### Task 13: Add 6 derived stores to history.js

**Files:**
- Modify: `src/lib/stores/history.js`

- [ ] **Step 1: Append derived stores**

In `src/lib/stores/history.js`, after the existing `populationHistory` derived store, append:

```js
export const govApprovalHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.gov_approval).filter((v) => v != null) : []
);

export const deathsHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.total_deaths).filter((v) => v != null) : []
);

export const cdrHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.effective_cdr).filter((v) => v != null) : []
);

export const netDeltaHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.net_delta_pct).filter((v) => v != null) : []
);

export const housingUtilHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.housing_util).filter((v) => v != null) : []
);

export const avgSatHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.avg_satisfaction).filter((v) => v != null) : []
);
```

- [ ] **Step 2: Verify the file parses (no test framework for store wiring; rely on Vite)**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds. (Other parts of the build may complain about unrelated things; just check there's no import error from `history.js`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/history.js
git commit -m "feat(stores): add v3 history derived stores for sparklines"
```

---

## Phase 7 — Frontend plumbing

### Task 14: KpiBlock — add `class:critical` on wrapper

**Files:**
- Modify: `src/lib/components/KpiBlock.svelte`

- [ ] **Step 1: Add the class binding**

In `src/lib/components/KpiBlock.svelte`, change line 20 from:

```svelte
<div class="kpi-block">
```

to:

```svelte
<div class="kpi-block" class:critical>
```

- [ ] **Step 2: Verify build still passes**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/KpiBlock.svelte
git commit -m "feat(kpi-block): expose .critical class on wrapper for border treatment"
```

---

### Task 15: Add `.bar.overflow` and `.kpi-block.critical` CSS for all 3 themes

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Verify `--crit` and `--crit-soft` exist in all themes**

```bash
grep -n "\-\-crit" src/styles/global.css
```

Expected: at least 3 hits per variable (one per theme block: `:root[data-theme=light]`, `:root[data-theme=dark]`, `:root[data-theme=schematic]`). If a theme is missing one, you'll need to add it BEFORE the new utility classes — bar-overflow stripes won't render.

- [ ] **Step 2: Add the new utility classes**

Append to `src/styles/global.css` (after the existing `.bar` rules — find them with `grep -n "^\.bar" src/styles/global.css` and add immediately below):

```css
/* v3 — bar overflow indicator (housing util > 100%). Width still capped
   at 100% so layout is stable; stripes signal "overflow exists" without
   conveying magnitude (the numeric percentage label does that). */
.bar.overflow span {
  background-image: repeating-linear-gradient(
    45deg,
    var(--crit-soft) 0,
    var(--crit-soft) 6px,
    var(--crit) 6px,
    var(--crit) 12px
  );
}

/* v3 — KpiBlock critical border treatment. Set by routes (e.g.
   Demographics.svelte when housing_util > 1.0). Mirrors the existing
   `critical` prop pattern but applies to the wrapper border, not just
   the number colour. */
.kpi-block.critical {
  border-color: var(--crit);
}
```

- [ ] **Step 3: Verify the build still passes**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css
git commit -m "feat(css): add .bar.overflow + .kpi-block.critical utilities"
```

---

### Task 16: Create demographics store

**Files:**
- Create: `src/lib/stores/demographics.js`

- [ ] **Step 1: Create the store**

Create `src/lib/stores/demographics.js`:

```js
import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const demographics = writable(null);
export const demographicsError = writable(null);

export async function loadDemographics(syncedAt) {
  try {
    const data = await fetchPage('demographics', syncedAt);
    demographics.set(data);
  } catch (err) {
    demographicsError.set(err.message);
  }
}
```

- [ ] **Step 2: Verify it builds**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/demographics.js
git commit -m "feat(stores): add demographics store"
```

---

### Task 17: Create Demographics.svelte route shell (loading + error states)

**Files:**
- Create: `src/routes/Demographics.svelte`

- [ ] **Step 1: Scaffold the component with loading/error/loaded shell only**

Create `src/routes/Demographics.svelte`:

```svelte
<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { pops, popsError, loadPops } from '../lib/stores/pops.js';
  import {
    demographics, demographicsError, loadDemographics,
  } from '../lib/stores/demographics.js';
  import { pageTitle } from '../lib/page-title.js';
  import MoonLoader from '../lib/components/MoonLoader.svelte';

  onMount(() => {
    pageTitle.set('Demographics');
    if ($meta?.synced_at) {
      loadPops($meta.synced_at);
      loadDemographics($meta.synced_at);
    }
  });

  $: errorMsg = $demographicsError ?? $popsError;
  $: ready = $demographics && $pops;
</script>

<section class="px-6 py-5 max-w-[1600px]">
  {#if errorMsg}
    <p class="text-crit">Failed to load demographics: {errorMsg}</p>
  {:else if !ready}
    <div class="flex flex-col items-center justify-center py-12 gap-4">
      <MoonLoader size={220} label="Loading demographics" />
      <p class="text-muted text-xs uppercase tracking-widest">Reading vital signs…</p>
    </div>
  {:else}
    <!-- Bands populated in subsequent tasks -->
    <p class="text-muted text-xs uppercase tracking-widest">Demographics page (bands coming)</p>
  {/if}
</section>
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/Demographics.svelte
git commit -m "feat(route): scaffold Demographics route (loading/error states)"
```

---

### Task 18: Wire Demographics into routing + NavBar

**Files:**
- Modify: `src/App.svelte`
- Modify: `src/lib/components/NavBar.svelte`

- [ ] **Step 1: Add route binding to App.svelte**

In `src/App.svelte`, add to the imports (after line 18 `import Situations from ...`):

```svelte
  import Demographics from './routes/Demographics.svelte';
```

Add to the `routes` object (after `'/pops': Pops,`):

```js
    '/demographics': Demographics,
```

- [ ] **Step 2: Add NavBar entry**

In `src/lib/components/NavBar.svelte`, edit the `ALL_PAGES` array (lines 8-17) — insert the new entry between Pops and GoIs:

```js
  const ALL_PAGES = [
    { path: '/', label: 'Status' },
    { path: '/map', label: 'Map' },
    { path: '/population', label: 'Population' },
    { path: '/pops', label: 'Pops' },
    { path: '/demographics', label: 'Demographics' },
    { path: '/gois', label: 'GoIs' },
    { path: '/parties', label: 'Parties' },
    { path: '/senate', label: 'Senate', requiresSenate: true },
    { path: '/situations', label: 'Situations' },
  ];
```

- [ ] **Step 3: Smoke-test in dev server**

```bash
npm run dev
```

In a browser, visit `http://localhost:5173/#/demographics`. Expect to see the placeholder text "Demographics page (bands coming)". Click NavBar items — Demographics should be present and active when on that route.

Stop the dev server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add src/App.svelte src/lib/components/NavBar.svelte
git commit -m "feat(nav): wire Demographics route into App and NavBar"
```

---

## Phase 8 — Status page UI updates

### Task 19: Status — Vital Signs column rebalance + Gov Approval KpiBlock

**Files:**
- Modify: `src/routes/Status.svelte`

- [ ] **Step 1: Update Vital Signs column spans + add Gov Approval block**

In `src/routes/Status.svelte`, replace the entire `Vital Signs` block (currently lines 53-85, the `<div class="grid grid-cols-12 gap-3">…</div>` for vital signs):

```svelte
    <div class="grid grid-cols-12 gap-3">
      <div class="col-span-12 md:col-span-4">
        <KpiBlock
          label="Treasury"
          value={fmtMoney($status.treasury?.money)}
          prefix="₡ "
          delta={fmtDeltaInt($status.treasury?.delta)}
          history={$treasuryHistory.length >= 2 ? $treasuryHistory : null}
        />
      </div>
      <div class="col-span-6 md:col-span-2">
        <KpiBlock
          label="Stability"
          value={$status.stability?.toFixed(2) ?? '—'}
          history={$stabilityHistory.length >= 2 ? $stabilityHistory : null}
          good
        />
      </div>
      <div class="col-span-6 md:col-span-2">
        <KpiBlock
          label="Crisis Factor"
          value={$status.crisis_factor?.toFixed(2) ?? '—'}
          history={$crisisFactorHistory.length >= 2 ? $crisisFactorHistory : null}
          critical={critical}
        />
      </div>
      <div class="col-span-6 md:col-span-2">
        <KpiBlock
          label="Population"
          value={$status.population_total?.toLocaleString() ?? '—'}
          delta={fmtDeltaInt(netDeltaPop)}
        />
      </div>
      <div class="col-span-6 md:col-span-2">
        <KpiBlock
          label="Gov Approval"
          value={$status.gov_approval?.toFixed(2) ?? '—'}
          history={$govApprovalHistory.length >= 2 ? $govApprovalHistory : null}
          good
        />
      </div>
    </div>
```

- [ ] **Step 2: Add `govApprovalHistory` to imports and compute `netDeltaPop`**

In `Status.svelte`, update the history imports block (currently lines 5-11). The `import` line needs `govApprovalHistory` added:

```svelte
  import {
    history,
    loadHistory,
    treasuryHistory,
    stabilityHistory,
    crisisFactorHistory,
    govApprovalHistory,
  } from '../lib/stores/history.js';
```

In the `<script>` block, add a reactive `netDeltaPop` (place after the existing `$: critical = ...` line):

```js
  // net Δpop / turn — derived from extractor's net_delta_pct (% per year).
  // Frontend converts back to absolute count for the KpiBlock delta slot.
  $: netDeltaPop = (() => {
    const pct = $status?.demographics?.net_delta_pct;
    const pop = $status?.population_total;
    if (pct == null || pop == null) return null;
    return Math.round((pct / 100) * pop);
  })();
```

- [ ] **Step 3: Smoke-test in dev server**

```bash
npm run dev
```

Visit `http://localhost:5173/`. Verify:
- 5 KpiBlocks in the Vital Signs band, all rendering values.
- Gov Approval shows `0.62` from the live data (or `—` if missing).
- Population shows the total + a delta value.
- Layout fits 12 cols on desktop without overflow.
- Toggle between three themes (☀ ☾ ⊞) — all three render legibly.

- [ ] **Step 4: Commit**

```bash
git add src/routes/Status.svelte
git commit -m "feat(status): vital signs col rebalance + gov approval kpi"
```

---

### Task 20: Status — Pulse tile-row

**Files:**
- Modify: `src/routes/Status.svelte`

- [ ] **Step 1: Add Pulse band**

In `src/routes/Status.svelte`, INSERT a new band between the Vital Signs band's closing `</div>` and the existing `<Band num="02" title="Resource Flows" .../>` line:

```svelte
    <Band num="02" title="Pulse" meta="population vitals" />
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatTile
        label="Growth Rate %"
        value={$status.demographics?.effective_growth_rate != null
          ? ($status.demographics.effective_growth_rate * 100).toFixed(2) + '%'
          : '—'}
      />
      <StatTile
        label="Deaths / turn"
        value={$status.demographics?.total_deaths != null
          ? Math.round($status.demographics.total_deaths).toLocaleString()
          : '—'}
      />
      <StatTile
        label="Est. Net Δ%"
        value={$status.demographics?.net_delta_pct != null
          ? ($status.demographics.net_delta_pct >= 0 ? '+' : '')
            + $status.demographics.net_delta_pct.toFixed(2) + '%'
          : '—'}
      />
      <StatTile
        label="Housing util"
        value={$status.demographics?.housing_util != null
          ? ($status.demographics.housing_util * 100).toFixed(1) + '%'
          : '—'}
      />
    </div>
```

- [ ] **Step 2: Renumber subsequent bands**

The Resource Flows band must shift from `num="02"` to `num="03"`, Overton from `num="03"` to `num="04"`, Active Situations from `num="04"` to `num="05"`. Find the existing `<Band num="..." />` lines and bump each by one.

- [ ] **Step 3: Smoke-test**

```bash
npm run dev
```

Visit `http://localhost:5173/`. Verify the Pulse row appears between Vital Signs and Resource Flows with 4 StatTiles. Band numbers should now read 01-05.

- [ ] **Step 4: Commit**

```bash
git add src/routes/Status.svelte
git commit -m "feat(status): pulse tile-row + renumber subsequent bands"
```

---

## Phase 9 — Demographics page bands

### Task 21: Demographics — Band 01 Pop Dynamics (5 KpiBlocks)

**Files:**
- Modify: `src/routes/Demographics.svelte`

- [ ] **Step 1: Replace the placeholder with the band 01 markup**

In `src/routes/Demographics.svelte`, update the imports block to include all components needed for all bands (we'll add band-by-band markup, but importing once now saves churn):

```svelte
<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { pops, popsError, loadPops } from '../lib/stores/pops.js';
  import {
    demographics, demographicsError, loadDemographics,
  } from '../lib/stores/demographics.js';
  import {
    deathsHistory, cdrHistory, netDeltaHistory,
    housingUtilHistory, avgSatHistory,
  } from '../lib/stores/history.js';
  import { pageTitle } from '../lib/page-title.js';
  import { classColor } from '../lib/faction-colors.js';
  import Band from '../lib/components/Band.svelte';
  import KpiBlock from '../lib/components/KpiBlock.svelte';
  import Bar from '../lib/components/Bar.svelte';
  import MoonLoader from '../lib/components/MoonLoader.svelte';

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
</script>
```

Then replace the placeholder paragraph (the `<p class="text-muted ..."` inside `{:else}`) with the Band 01 block:

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

- [ ] **Step 2: Smoke-test**

```bash
npm run dev
```

Visit `/#/demographics`. 5 KpiBlocks render. Sparklines appear if there's ≥2 years of history; otherwise just the values.

- [ ] **Step 3: Commit**

```bash
git add src/routes/Demographics.svelte
git commit -m "feat(demographics): band 01 pop dynamics"
```

---

### Task 22: Demographics — Band 02 Class Vitals (table reads $pops.classes)

**Files:**
- Modify: `src/routes/Demographics.svelte`

- [ ] **Step 1: Append Band 02**

After Band 01's closing `</div>` (still inside the `{:else}` branch), append:

```svelte
    <Band num="02" title="Class Vitals" meta={`${$pops.classes.length} classes`} />
    <div class="s-card">
      <table class="tbl">
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
      </table>
    </div>
```

- [ ] **Step 2: Smoke-test**

```bash
npm run dev
```

Visit `/#/demographics`. Class Vitals table renders with one row per class, faction-bar accent on names, all 6 columns populated.

- [ ] **Step 3: Commit**

```bash
git add src/routes/Demographics.svelte
git commit -m "feat(demographics): band 02 class vitals table"
```

---

### Task 23: Demographics — Band 03 Housing (utilization + modifiers)

**Files:**
- Modify: `src/routes/Demographics.svelte`

- [ ] **Step 1: Append Band 03**

After Band 02's closing `</div>`:

```svelte
    <Band num="03" title="Housing" meta={housingCritical ? 'OVERCROWDED' : 'capacity'} />
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="s-card">
        <div class="s-card-header">
          <h3>Utilization</h3>
        </div>
        <div class="s-card-pad">
          <Bar
            label="Pop / Capacity"
            value={$demographics.housing.ratio}
            max={1}
            variant={housingCritical ? 'crit overflow' : ''}
            format="pct"
          />
          <dl class="kv mt-2">
            <dt>Pop</dt><dd>{$demographics.housing.pop?.toLocaleString() ?? '—'}</dd>
            <dt>Capacity</dt><dd>{$demographics.housing.capacity?.toLocaleString() ?? '—'}</dd>
          </dl>
        </div>
      </div>

      <div class="s-card" class:critical={housingCritical}>
        <div class="s-card-header">
          <h3>Modifiers</h3>
        </div>
        <div class="s-card-pad">
          <dl class="kv">
            <dt>Housing Ratio</dt>
            <dd>{$demographics.housing.ratio?.toFixed(3) ?? '—'}</dd>
            <dt>Growth Mult</dt>
            <dd>{$demographics.housing.growth_mult?.toFixed(3) ?? '—'}</dd>
            <dt>Overcrowding Exp</dt>
            <dd>{$demographics.housing.overcrowding_exp?.toFixed(2) ?? '—'}</dd>
          </dl>
        </div>
      </div>
    </div>
```

(Note: Bar.svelte accepts `variant` as a class string — `"crit overflow"` adds both `.crit` and `.overflow` classes, which works with the existing `.bar.{variant}` template since the `{variant}` interpolation is a class-name string.)

- [ ] **Step 2: Smoke-test all three themes**

```bash
npm run dev
```

Visit `/#/demographics`. Band 03 renders with two cards: Utilization (showing ratio bar + raw pop/capacity numbers) and Modifiers (kv block). Switch through all three themes — the stripe pattern on the bar should be visible if housing_util > 1.0 (won't be in fixture data; force by editing fixture or live workbook to test visually).

- [ ] **Step 3: Commit**

```bash
git add src/routes/Demographics.svelte
git commit -m "feat(demographics): band 03 housing util + modifiers"
```

---

### Task 24: Demographics — Band 04 Food Security (3 KPIs)

**Files:**
- Modify: `src/routes/Demographics.svelte`

- [ ] **Step 1: Append Band 04**

After Band 03's closing `</div>`:

```svelte
    <Band num="04" title="Food Security" meta="cropsim signals" />
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <KpiBlock
        label="Security Ratio"
        value={$demographics.food.security_ratio?.toFixed(2) ?? '—'}
        good={($demographics.food.security_ratio ?? 0) >= 1.0}
        critical={($demographics.food.security_ratio ?? 1) < 0.95}
      />
      <KpiBlock
        label="Food / Cap"
        value={$demographics.food.per_cap?.toFixed(2) ?? '—'}
      />
      <KpiBlock
        label="Variety Index"
        value={$demographics.food.variety_index?.toFixed(2) ?? '—'}
      />
    </div>
```

- [ ] **Step 2: Smoke-test**

```bash
npm run dev
```

Verify Band 04 renders with 3 KpiBlocks and reasonable values from live data.

- [ ] **Step 3: Commit**

```bash
git add src/routes/Demographics.svelte
git commit -m "feat(demographics): band 04 food security"
```

---

## Phase 10 — Tests + verification

### Task 25: Add /demographics to Playwright a11y matrix

**Files:**
- Modify: `tests-e2e/a11y.spec.js`

- [ ] **Step 1: Read existing a11y spec**

```bash
cat tests-e2e/a11y.spec.js
```

(Use the actual file structure to determine where to add `/demographics`.)

- [ ] **Step 2: Add /demographics to the iterated route list**

In `tests-e2e/a11y.spec.js`, find the array of routes (it'll look something like `const ROUTES = ['/', '/map', '/population', '/pops', '/gois', '/parties', '/situations']`). Insert `/demographics` after `/pops`:

```js
const ROUTES = ['/', '/map', '/population', '/pops', '/demographics', '/gois', '/parties', '/situations'];
```

(The exact constant name and location will be visible from Step 1's output.)

- [ ] **Step 3: Run the a11y suite**

```bash
npm run test:e2e
```

Expected: all routes × 3 themes pass axe checks. If `/demographics` fails, the report will name the violation rule (contrast, missing label, etc.) — fix in Demographics.svelte and re-run.

- [ ] **Step 4: Commit**

```bash
git add tests-e2e/a11y.spec.js
git commit -m "test(a11y): include /demographics in themes-iterated route matrix"
```

---

### Task 26: Final manual verification + run full pytest suite

**Files:** none modified — verification only.

- [ ] **Step 1: Run the full pytest suite**

```bash
uv run pytest tests/ -v
```

Expected: all NEW tests pass; pre-existing failures (per CLAUDE.md gotcha #10) unchanged in count and identity.

- [ ] **Step 2: Run a local sync against the new live sheet**

Use the `--sheet-id` flag (cross-platform; avoids the bash-vs-PowerShell env-var-prefix difference):

```bash
uv run python scripts/sync_sheet.py --sheet-id 1a602zL0X7HqUTpgr0lFxKfm5_tzDdQxbiv7Jw-hSoN0 --out-dir public/data
```

Expected: exits 0, all extractors succeed (no `partial_failures` in `meta.json`), `demographics.json` is written with non-null totals/housing/food fields.

- [ ] **Step 3: Verify the live data**

```bash
cat public/data/meta.json
cat public/data/demographics.json | head -40
```

Expected: `meta.json.schema_version == 3`, `partial_failures == []`. `demographics.json.totals.pop` should be ~33240 (or whatever the current colony total is).

- [ ] **Step 4: Smoke-test the dashboard end-to-end**

```bash
npm run dev
```

Visit:
- `http://localhost:5173/` — Vital Signs (5 KpiBlocks), Pulse row (4 tiles), bands renumbered 01-05.
- `http://localhost:5173/#/demographics` — 4 bands render with live data.
- `http://localhost:5173/#/pops` — pick any class chip, verify the per-class card shows mortality/deaths/unemployed_count (these are now in pops.json but not necessarily on the Pops UI yet — that's a separate UI follow-up; the data being present is what matters).

Toggle through all three themes (☀ ☾ ⊞) on each page. No layout breakage, no obvious contrast issues.

- [ ] **Step 5: Revert the local sync changes** (don't commit live data into the repo as part of this PR — the cron will sync it normally):

```bash
git checkout public/data/
```

- [ ] **Step 6: Final commit (CLAUDE.md update)**

Per CLAUDE.md user instruction "Before commit and pushing any changes, you should first update the CLAUDE.md of the project you are working in", append a brief reference to the new spec/plan in the project CLAUDE.md "Where to read more" section:

```markdown
## Where to read more

- Spec: `docs/superpowers/specs/2026-05-01-scorp-dashboard-design.md`
- Spec (v3 demographics): `docs/superpowers/specs/2026-05-06-demographics-page-and-status-vitals-design.md`
- Plan: `docs/superpowers/plans/2026-05-01-scorp-dashboard-implementation.md`
- Plan (v3 demographics): `docs/superpowers/plans/2026-05-06-demographics-page-and-status-vitals.md`
- Backend: `../scorp_colony/CLAUDE.md`
```

Then commit:

```bash
git add CLAUDE.md
git commit -m "docs: link new demographics spec + plan from CLAUDE.md"
```

---

## Operational handoff (USER TASK — not implemented by the agent)

After all tasks above are merged, the user must update the GitHub repo variable:

> **Settings → Secrets and variables → Actions → Variables → SHEET_ID**
>
> Set value to: `1a602zL0X7HqUTpgr0lFxKfm5_tzDdQxbiv7Jw-hSoN0`

The next hourly sync (or a manual `workflow_dispatch`) will pull the new sheet, write v3-shaped JSON, and the deployed frontend will pick it up.

If `vars.SHEET_ID` isn't updated, sync will keep pulling the old workbook, the old workbook lacks the v3 hard-required ranges, and `validate_schema` will throw — the Telegram notifier will alert. Recovery: update the variable.

---

## Summary

26 tasks total, all under ~5 minutes per step. TDD throughout where practical (Phase 1-6); UI tasks rely on smoke testing + Playwright a11y. Each phase ends in a green test run before the next phase starts. Schema bump is enforced lockstep at Task 1.
