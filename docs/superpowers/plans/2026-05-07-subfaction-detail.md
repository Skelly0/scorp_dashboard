# Sub-Faction Detail Drilldown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a side-rail drilldown panel on the GoIs page so the player can inspect each sub-faction's goal, 6-axis effective worldview (overlaid against its parent GoI), and key stats (within-GoI influence, national share, approval).

**Architecture:** Backend extractor (`extractors/gois.py`) gains three new soft-optional named-range reads (`SubFactionGoal`, `SubFactionNationalShare`, `SubFactionDetail`). Frontend reuses `RadarChart` (extended with an `overlay` prop), introduces a new `SubFactionPanel.svelte` component, and restructures `GoIs.svelte` into a two-track grid that becomes a bottom sheet on narrow viewports. Selection state is local Svelte state. Schema bumps from 4 to 5 in lockstep across `sync_sheet.py` and `meta.js`.

**Tech Stack:** Python 3 + openpyxl (extractor + fixture); Svelte 4 + Tailwind + global.css custom-property themes; pytest (extractor tests); Playwright + axe (E2E + a11y).

**Spec:** `docs/superpowers/specs/2026-05-07-subfaction-detail-design.md`

**Note on commits:** per the user's standing preference, do NOT commit per task. Run a verification step at the end of each task and keep the working tree dirty. After all tasks complete, the user will be asked how to structure final commit(s).

---

## File map

**Modify:**
- `scripts/extractors/gois.py` — read 3 new ranges; emit new fields per sub-faction; name-pair zip for `SubFactionDetail`.
- `scripts/validate_schema.py` — append 3 new range names to `SOFT_OPTIONAL_V3_RANGES` (documentation list).
- `scripts/sync_sheet.py` — bump `SCHEMA_VERSION` from 4 to 5.
- `tests/fixtures/build_test_workbook.py` — add `SubFactionGoal`, `SubFactionNationalShare` columns on Politics; add a new `Sub-Faction Detail` sheet + named range.
- `tests/extractors/test_gois.py` — 4 new tests covering the new fields and graceful-degradation.
- `src/lib/stores/meta.js` — bump `EXPECTED_SCHEMA_VERSION` from 4 to 5.
- `src/lib/components/RadarChart.svelte` — add optional `overlay` prop with dev-mode assertions.
- `src/styles/global.css` — add `--radar-overlay` token to all three theme blocks; add `.s-rail`, `.s-rail-empty`, `.s-sheet`, `.s-rail-row-active` styles.
- `src/routes/GoIs.svelte` — page-grid restructure; selection state; sub-faction `<button>` rows; ARIA + Esc; mobile bottom-sheet wrapper; auto-dismiss stale selection.

**Create:**
- `src/lib/components/SubFactionPanel.svelte` — the rail content (header, goal block, radar w/ overlay, KPI row, empty state).
- `tests-e2e/gois.spec.js` — E2E tests for click → rail → close interactions, mobile sheet, axe a11y across themes.

---

## Task 1: Schema version bumps + validator documentation

Bumps the schema versions and registers the three new soft-optional ranges so future regressions are caught.

**Files:**
- Modify: `scripts/sync_sheet.py` (the `SCHEMA_VERSION = 4` line)
- Modify: `scripts/validate_schema.py:87-97` (`SOFT_OPTIONAL_V3_RANGES` list)
- Modify: `src/lib/stores/meta.js` (the `EXPECTED_SCHEMA_VERSION = 4` line)

- [ ] **Step 1: Locate the SCHEMA_VERSION line in `scripts/sync_sheet.py`**

Use the Grep tool with pattern `SCHEMA_VERSION` on path `scripts/sync_sheet.py`.
Expected: a line like `SCHEMA_VERSION = 4` near the top of the module.

- [ ] **Step 2: Bump `SCHEMA_VERSION` from 4 to 5**

Edit `scripts/sync_sheet.py`:
```python
SCHEMA_VERSION = 5
```

- [ ] **Step 3: Append the three new range names to `SOFT_OPTIONAL_V3_RANGES`**

Edit `scripts/validate_schema.py` — within the existing `SOFT_OPTIONAL_V3_RANGES` list (currently ending around line 97), append:
```python
    # v5 — Sub-faction enrichment (read by extractors/gois.py via read_named_range,
    # which returns [] when missing — so the dashboard degrades gracefully).
    "SubFactionGoal",
    "SubFactionNationalShare",
    "SubFactionDetail",
```

- [ ] **Step 4: Locate `EXPECTED_SCHEMA_VERSION` in `src/lib/stores/meta.js`**

Use the Grep tool with pattern `EXPECTED_SCHEMA_VERSION` on path `src/lib/stores/meta.js`.
Expected: a line like `const EXPECTED_SCHEMA_VERSION = 4`.

- [ ] **Step 5: Bump `EXPECTED_SCHEMA_VERSION` from 4 to 5**

Edit `src/lib/stores/meta.js`:
```js
const EXPECTED_SCHEMA_VERSION = 5;
```

- [ ] **Step 6: Verify Python tests still pass after the bump**

Run: `pytest tests/ -x -q`
Expected: same baseline pass/fail count as before this task (no new failures introduced; existing pre-known failures per CLAUDE.md gotcha #10 are acceptable).

---

## Task 2: Extend fixture with the goal column + national-share column

Adds two new columns on the fixture Politics sheet (Z and AA) so the new `SubFactionGoal` and `SubFactionNationalShare` named ranges have data to point at.

**Files:**
- Modify: `tests/fixtures/build_test_workbook.py` (the existing sub-faction block writer near line 285-307)

- [ ] **Step 1: Locate the sub-faction block in the fixture builder**

Use the Grep tool with pattern `sub_factions = \[` on path `tests/fixtures/build_test_workbook.py`.
Expected: a line like `sub_factions = [` followed by tuples of `(parent, sf_name, infl, appr, goal)`.

- [ ] **Step 2: Extend the `sub_factions` tuples to include `goal_text` and `national_share`**

Edit `tests/fixtures/build_test_workbook.py` — replace the existing `sub_factions = [...]` block with:
```python
    sub_factions = [
        # parent, sf_name, infl, appr, minor_goal, goal_text, national_share
        ("Founders", "Constitutional Loyalists", 0.40, 0.5, "Defend constitution",
         "Defend the founding charter against revisionism.", 0.20),
        ("Founders", "Reformist Founders", 0.35, 0.6, "Modernise institutions",
         "Modernise the constitutional framework.", 0.18),
        ("Founders", "Hardliner Founders", 0.25, 0.4, "Restore order",
         "Restore lost civic order through firm institutions.", 0.12),
        ("Capitalists", "Industrialists", 0.40, 0.5, "Heavy industry growth",
         "Expand heavy industry above all else.", 0.30),
        ("Capitalists", "Extraction Cartels", 0.35, 0.4, "Mining priority",
         "Prioritise extraction over downstream value.", 0.20),
    ]
    for i, (parent, sf_name, infl, appr, minor_goal, goal_text, nat_share) in enumerate(
        sub_factions, start=24
    ):
        pol.cell(row=i, column=21, value=parent)         # U
        pol.cell(row=i, column=22, value=sf_name)        # V
        pol.cell(row=i, column=23, value=infl)           # W influence
        pol.cell(row=i, column=24, value=appr)           # X approval
        pol.cell(row=i, column=25, value=minor_goal)     # Y minor goal 1
        pol.cell(row=i, column=26, value=goal_text)      # Z goal text (NEW)
        pol.cell(row=i, column=27, value=nat_share)      # AA national share (NEW)
```

- [ ] **Step 3: Add the new named ranges next to the existing SubFaction\* names**

In the same file, just after the existing `_add_name(wb, "SubFactionApprovals", ...)` line, add:
```python
    # Note: in the live workbook these names live on the dedicated `Sub-Factions`
    # sheet (cols E and L). The fixture parks them on `Politics` cols Z/AA so we
    # don't have to invent a new fixture sheet just for two columns. The
    # extractor reads by name only, so the topology divergence is invisible to
    # tests — but real-world drift between fixture and live wb is also masked.
    # If the fixture is ever rebuilt to mirror the live sheet topology, move
    # these ranges to the new `Sub-Factions` fixture sheet at that point.
    _add_name(wb, "SubFactionGoal", "Politics!$Z$24:$Z$36")
    _add_name(wb, "SubFactionNationalShare", "Politics!$AA$24:$AA$36")
```

- [ ] **Step 4: Verify the existing GoIs tests still pass with the extended fixture**

Run: `pytest tests/extractors/test_gois.py -v`
Expected: same passing tests as before this task; no new failures (we haven't changed the extractor yet, so new fields aren't read but old fields still work).

---

## Task 3: Add the `Sub-Faction Detail` sheet + `SubFactionDetail` named range to fixture

Builds a new fixture sheet that mirrors the live workbook's Sub-Faction Detail layout, with row alignment to the existing sub-factions block by `(GoI, sub-faction)` name pairs.

**Files:**
- Modify: `tests/fixtures/build_test_workbook.py` (after the SubFaction\* block, before the GoI Modifiers section near line 309)

- [ ] **Step 1: Add a new fixture-builder code block immediately after the SubFactionApprovals/Goal/NationalShare named ranges**

Edit `tests/fixtures/build_test_workbook.py` — insert this block before `# GoI Modifiers: PopCaptureBase B5:E15`:
```python
    # ---- Sub-Faction Detail sheet (mirrors live wb's derived 13×16 block) ----
    sfd = wb.create_sheet("Sub-Faction Detail")
    # Row 4 = header (matches live wb convention; data starts row 5).
    sfd_headers = [
        "GoI", "Sub-faction", "Influence", "Goal Axis", "Goal Δ",
        "Expansion", "Authority", "Corporate", "Technocratic", "Faith", "Materialist",
        "Approval", "Minor Goal 1", "Minor Goal 2", "Minor Goal 3", "National Share",
    ]
    for c, hdr in enumerate(sfd_headers, start=1):
        sfd.cell(row=4, column=c, value=hdr)
    # Data rows: align to the same (GoI, sub-faction) pairs as `sub_factions` above.
    # Per-axis values are arbitrary but distinct so tests can pin specific cells.
    sfd_rows = [
        # (goi, sf_name, infl, axis, delta, exp, auth, corp, tech, faith, mat, appr,
        #  m1, m2, m3, nat_share)
        ("Founders", "Constitutional Loyalists", 0.40, "authority", 1.0,
         4.0, 5.5, 4.0, 4.0, 4.5, 4.5, 0.5, "", "", "", 0.20),
        ("Founders", "Reformist Founders", 0.35, "technocratic", 1.0,
         4.0, 4.0, 4.0, 5.5, 4.5, 4.5, 0.6, "", "", "", 0.18),
        ("Founders", "Hardliner Founders", 0.25, "authority", 1.5,
         4.0, 6.0, 4.0, 4.0, 4.5, 4.5, 0.4, "", "", "", 0.12),
        ("Capitalists", "Industrialists", 0.40, "corporate", 1.5,
         5.5, 3.5, 6.5, 4.0, 3.0, 2.5, 0.5, "", "", "", 0.30),
        ("Capitalists", "Extraction Cartels", 0.35, "expansion", 1.0,
         6.5, 3.5, 5.5, 4.0, 3.0, 2.5, 0.4, "", "", "", 0.20),
    ]
    for i, row_vals in enumerate(sfd_rows, start=5):
        for c, val in enumerate(row_vals, start=1):
            sfd.cell(row=i, column=c, value=val)
    # 13-row reservation total to mirror the live wb (rows 5..17). Remaining rows
    # are blank by default and will be filtered by name-pair lookup misses.
    _add_name(wb, "SubFactionDetail", "'Sub-Faction Detail'!$A$5:$P$17")
```

- [ ] **Step 2: Verify the fixture still builds and tests still pass**

Run: `pytest tests/extractors/test_gois.py -v`
Expected: existing tests pass; no new failures.

---

## Task 4: Extractor reads `goal` (TDD)

Wires the extractor to read `SubFactionGoal` and emit a `goal` field per sub-faction.

**Files:**
- Modify: `tests/extractors/test_gois.py`
- Modify: `scripts/extractors/gois.py:_sub_factions_by_goi`

- [ ] **Step 1: Write the failing test**

Append to `tests/extractors/test_gois.py`:
```python
def test_extract_includes_subfaction_goal(wb):
    result = extract(wb)
    founders = next(g for g in result["gois"] if g["name"] == "Founders")
    loyalists = next(s for s in founders["sub_factions"]
                     if s["name"] == "Constitutional Loyalists")
    assert loyalists["goal"] == "Defend the founding charter against revisionism."
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pytest tests/extractors/test_gois.py::test_extract_includes_subfaction_goal -v`
Expected: FAIL with `KeyError: 'goal'` (extractor doesn't yet emit the field).

- [ ] **Step 3: Read `SubFactionGoal` inside `_sub_factions_by_goi`**

Edit `scripts/extractors/gois.py:_sub_factions_by_goi` — add `goals_text` read alongside the other named-range reads, and surface `goal` per record:
```python
def _sub_factions_by_goi(wb):
    """Zip the SubFaction* named ranges into per-GoI lists.

    Sub-Factions sheet layout (live wb):
      A: GoI, B: SF name, C: Goal Axis, D: Goal Δ, E: Goal text,
      F: Influence, G-I: Minor Goals, J: Approval, L: National Share.

    SubFactionDetail (separate sheet) is keyed by (GoI, SF name) pair so silent
    row drift between the two sheets cannot misalign worldviews.
    """
    goals = read_named_range(wb, "SubFactionGoals")
    influences = read_named_range(wb, "SubFactionInfluences")
    minor_goals = read_named_range(wb, "SubFactionMinorGoals")
    approvals = read_named_range(wb, "SubFactionApprovals")
    goals_text = read_named_range(wb, "SubFactionGoal")

    by_goi: dict[str, list[dict[str, Any]]] = {}
    for i, gr in enumerate(goals):
        if not gr or not gr[0]:
            continue
        goi_name = gr[0]
        sf_name = gr[1] if len(gr) > 1 else None
        infl = (
            coerce_number(influences[i][0])
            if i < len(influences) and influences[i]
            else None
        )
        appr = (
            coerce_number(approvals[i][0])
            if i < len(approvals) and approvals[i]
            else None
        )
        mgs = []
        if i < len(minor_goals) and minor_goals[i]:
            mgs = [g for g in minor_goals[i] if g not in (None, "")]
        goal_text = (
            goals_text[i][0]
            if i < len(goals_text) and goals_text[i]
            else None
        )
        if goal_text == "":
            goal_text = None

        by_goi.setdefault(goi_name, []).append({
            "name": sf_name,
            "influence": infl,
            "approval": appr,
            "minor_goals": mgs,
            "goal": goal_text,
        })
    return by_goi
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pytest tests/extractors/test_gois.py::test_extract_includes_subfaction_goal -v`
Expected: PASS.

- [ ] **Step 5: Run the whole `test_gois.py` suite to confirm no regression**

Run: `pytest tests/extractors/test_gois.py -v`
Expected: existing tests pass; new test passes.

---

## Task 5: Extractor reads `national_share` (TDD)

Wires `SubFactionNationalShare` (col L of Sub-Factions) into the per-record dict.

**Files:**
- Modify: `tests/extractors/test_gois.py`
- Modify: `scripts/extractors/gois.py:_sub_factions_by_goi`

- [ ] **Step 1: Write the failing test**

Append to `tests/extractors/test_gois.py`:
```python
def test_extract_includes_subfaction_national_share(wb):
    result = extract(wb)
    founders = next(g for g in result["gois"] if g["name"] == "Founders")
    loyalists = next(s for s in founders["sub_factions"]
                     if s["name"] == "Constitutional Loyalists")
    assert loyalists["national_share"] == 0.20
    # All live sub-factions in the fixture should have a numeric national_share.
    all_sfs = [s for g in result["gois"] for s in g["sub_factions"]]
    assert all(isinstance(s["national_share"], float) for s in all_sfs)
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pytest tests/extractors/test_gois.py::test_extract_includes_subfaction_national_share -v`
Expected: FAIL with `KeyError: 'national_share'`.

- [ ] **Step 3: Add `SubFactionNationalShare` reading**

Edit `scripts/extractors/gois.py:_sub_factions_by_goi` — add the read alongside the others and emit `national_share`:
```python
    national_shares = read_named_range(wb, "SubFactionNationalShare")
```
Inside the loop, before the `by_goi.setdefault(...)` call, add:
```python
        nat_share = (
            coerce_number(national_shares[i][0])
            if i < len(national_shares) and national_shares[i]
            else None
        )
```
And add `"national_share": nat_share,` to the appended dict.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pytest tests/extractors/test_gois.py::test_extract_includes_subfaction_national_share -v`
Expected: PASS.

---

## Task 6: Extractor reads `effective_worldview` via name-pair zip (TDD)

Reads `SubFactionDetail`, builds a `(GoI, sub-faction) → 6-axis dict` map, and merges by name pair into the per-record output. This is the defensive zip required by spec §3.1.

**Files:**
- Modify: `tests/extractors/test_gois.py`
- Modify: `scripts/extractors/gois.py` (new helper + integration in `_sub_factions_by_goi`)

- [ ] **Step 1: Write the failing test**

Append to `tests/extractors/test_gois.py`:
```python
def test_extract_includes_subfaction_effective_worldview(wb):
    result = extract(wb)
    founders = next(g for g in result["gois"] if g["name"] == "Founders")
    hardliners = next(s for s in founders["sub_factions"]
                      if s["name"] == "Hardliner Founders")
    ew = hardliners["effective_worldview"]
    assert isinstance(ew, dict)
    assert ew == {
        "expansion": 4.0,
        "authority": 6.0,
        "corporate": 4.0,
        "technocratic": 4.0,
        "faith": 4.5,
        "materialist": 4.5,
    }
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pytest tests/extractors/test_gois.py::test_extract_includes_subfaction_effective_worldview -v`
Expected: FAIL with `KeyError: 'effective_worldview'`.

- [ ] **Step 3: Add a private helper to read `SubFactionDetail` keyed by name pair**

Edit `scripts/extractors/gois.py` — first, add `import logging` to the existing import block at the top of the file (alongside the existing `import re` line). Then declare a module-level logger near the other module-level constants (e.g. just below `WORLDVIEW_AXES`):
```python
_log = logging.getLogger(__name__)
```
Then add the helper itself near `_sub_factions_by_goi` (anywhere in the lower half of the file is fine — pick a stable location):
```python
def _subfaction_worldviews_by_pair(wb):
    """Read SubFactionDetail and return {(goi, sf_name): {axis: value}} map.

    SubFactionDetail layout (16 cols on the Sub-Faction Detail sheet):
      0: GoI, 1: Sub-faction, 2: Influence, 3: Goal Axis, 4: Goal Δ,
      5-10: Expansion/Authority/Corporate/Technocratic/Faith/Materialist
            (effective stance — base + Δ if axis matches),
      11: Approval (mirror — ignored; SubFactionApprovals is authoritative),
      12-14: Minor Goals (mirror — ignored),
      15: National Share (mirror — ignored).

    Defensive zip: keyed by (GoI, sub-faction) name pair, NOT row index.
    Backend invariant promises row alignment with SubFactionGoals, but a single
    inserted row would silently corrupt every downstream worldview, so we never
    rely on positional correspondence across two separate sheets.
    """
    rows = read_named_range(wb, "SubFactionDetail")
    if not rows:
        return {}
    out: dict[tuple[str, str], dict[str, float | None]] = {}
    for r in rows:
        if not r or len(r) < 11:
            continue
        goi_name, sf_name = r[0], r[1]
        if not goi_name or not sf_name:
            continue
        out[(goi_name, sf_name)] = {
            axis: coerce_number(r[5 + i])
            for i, axis in enumerate(WORLDVIEW_AXES)
        }
    return out
```

- [ ] **Step 4: Wire the helper into `_sub_factions_by_goi`**

Edit `scripts/extractors/gois.py:_sub_factions_by_goi` — at the top, after the other reads:
```python
    detail_map = _subfaction_worldviews_by_pair(wb)
```
Inside the loop, before the `by_goi.setdefault(...)` call, add:
```python
        worldview = detail_map.get((goi_name, sf_name))
        if worldview is None and detail_map:
            # The Detail sheet has data, but no row matches this (goi, sf) pair.
            _log.warning(
                "SubFactionDetail has no matching row for (%s, %s); "
                "effective_worldview will be null for this sub-faction",
                goi_name, sf_name,
            )
```
And add `"effective_worldview": worldview,` to the appended dict.

- [ ] **Step 5: Run the test and confirm it passes**

Run: `pytest tests/extractors/test_gois.py::test_extract_includes_subfaction_effective_worldview -v`
Expected: PASS.

- [ ] **Step 6: Run the whole gois test file**

Run: `pytest tests/extractors/test_gois.py -v`
Expected: all tests pass.

---

## Task 7: Graceful degradation when new ranges are missing (TDD)

Verifies that an old-schema workbook (without the new named ranges) still extracts cleanly with `goal`, `national_share`, and `effective_worldview` set to `None`.

**Files:**
- Modify: `tests/extractors/test_gois.py`

- [ ] **Step 1: Write the failing test using a stripped-down workbook**

Append to `tests/extractors/test_gois.py`:
```python
import openpyxl

def test_extract_handles_missing_subfaction_ranges(fixture_workbook_path):
    """When SubFactionGoal/NationalShare/Detail are absent, extraction still
    works — fields default to None for the affected sub-factions."""
    wb = openpyxl.load_workbook(fixture_workbook_path, data_only=True)
    # Remove the three new ranges to simulate an older workbook.
    for nm in ("SubFactionGoal", "SubFactionNationalShare", "SubFactionDetail"):
        if nm in wb.defined_names:
            del wb.defined_names[nm]

    result = extract(wb)
    all_sfs = [s for g in result["gois"] for s in g["sub_factions"]]
    # Fixture has 5 live sub-factions across Founders + Capitalists.
    assert len(all_sfs) == 5, "removing names should not drop sub-factions"
    for sf in all_sfs:
        assert sf["goal"] is None
        assert sf["national_share"] is None
        assert sf["effective_worldview"] is None
```

- [ ] **Step 2: Run the test and confirm it passes (extractor already tolerates absence by spec design)**

Run: `pytest tests/extractors/test_gois.py::test_extract_handles_missing_subfaction_ranges -v`
Expected: PASS — `read_named_range` returns `[]` when names are missing, and the extractor's `i < len(...)` guards already produce `None`. If this fails, fix the extractor by ensuring each new field path returns `None` cleanly when its source list is empty.

- [ ] **Step 3: Run the whole gois test file**

Run: `pytest tests/extractors/test_gois.py -v`
Expected: all tests pass.

---

## Task 8: Add `--radar-overlay` theme token

Defines the new color token across all three theme blocks per spec §5.3 / gotcha #12.

**Files:**
- Modify: `src/styles/global.css` (the three `:root[data-theme=…]` blocks near lines 12-76)

- [ ] **Step 1: Locate the three theme blocks**

Use the Grep tool with pattern `data-theme=` on path `src/styles/global.css`.
Expected: three matches at the top of the file: `light`, `dark`, `schematic`.

- [ ] **Step 2: Add `--radar-overlay` to the `light` theme block**

Edit `src/styles/global.css` — within the `:root[data-theme='light'] { ... }` block, before the closing brace, add:
```css
  --radar-overlay: rgba(74, 58, 32, 0.55); /* warm desaturated brown — contrasts vs. orange accent */
```

- [ ] **Step 3: Add `--radar-overlay` to the `dark` theme block**

Edit `src/styles/global.css` — within the `:root[data-theme='dark'] { ... }` block, before the closing brace, add:
```css
  --radar-overlay: rgba(243, 233, 210, 0.45); /* dim cream — distinct from amber accent on near-black */
```

- [ ] **Step 4: Add `--radar-overlay` to the `schematic` theme block**

Edit `src/styles/global.css` — within the `:root[data-theme='schematic'] { ... }` block, before the closing brace, add:
```css
  --radar-overlay: rgba(165, 58, 38, 0.55); /* warm crit red — contrasts vs. navy accent */
```

- [ ] **Step 5: Verify the build still works**

Run: `npm run build`
Expected: build succeeds without warnings about undefined CSS variables.

---

## Task 9: Add `overlay` prop to `RadarChart.svelte` with dev-mode assertions

Extends `RadarChart` to accept a second axis array and render it as a faint dashed polygon behind the primary line. Includes safety asserts per spec §6.2.

**Files:**
- Modify: `src/lib/components/RadarChart.svelte`

- [ ] **Step 1: Replace the script block with the overlay-aware version**

Edit `src/lib/components/RadarChart.svelte` — replace the existing `<script>` block with:
```svelte
<script>
  import { polarPoints } from '../radar-utils.js';

  /** @type {{label: string, value: number | null}[]} */
  export let axes = [];
  /** Optional ghost overlay polygon (e.g. parent worldview behind sub-faction). */
  /** @type {{label: string, value: number | null}[] | null} */
  export let overlay = null;
  export let size = 160;
  export let scaleMin = 1;
  export let scaleMax = 7;

  $: cx = size / 2;
  $: cy = size / 2;
  $: radius = size / 2 - 18;
  $: values = axes.map((a) => a.value);
  $: dataPoints = polarPoints(values, { cx, cy, radius, scaleMin, scaleMax });
  $: pathD = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
  $: gridLevels = [0.25, 0.5, 0.75, 1].map((f) => polarPoints(axes.map(() => scaleMin + (scaleMax - scaleMin) * f), { cx, cy, radius, scaleMin, scaleMax }));
  $: spokes = polarPoints(axes.map(() => scaleMax), { cx, cy, radius, scaleMin, scaleMax });

  $: overlayValid = (() => {
    if (!overlay) return false;
    if (overlay.length !== axes.length) {
      console.warn('[RadarChart] overlay/axes length mismatch — overlay ignored');
      return false;
    }
    for (let i = 0; i < axes.length; i++) {
      if (overlay[i].label !== axes[i].label) {
        console.warn(
          `[RadarChart] overlay/axes label mismatch at index ${i} ` +
          `(axes='${axes[i].label}', overlay='${overlay[i].label}') — overlay ignored`,
        );
        return false;
      }
    }
    return true;
  })();
  $: overlayPoints = overlayValid
    ? polarPoints(overlay.map((a) => a.value), { cx, cy, radius, scaleMin, scaleMax })
    : null;
  $: overlayPathD = overlayPoints
    ? overlayPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'
    : null;
</script>
```

- [ ] **Step 2: Add the overlay polygon to the SVG, BEHIND the primary data shape**

Edit `src/lib/components/RadarChart.svelte` — within the `<svg>...</svg>`, immediately after the `{#each spokes ...}` block and BEFORE the `<!-- data shape -->` comment, insert:
```svelte
  <!-- overlay (ghost) shape — drawn first so primary renders on top -->
  {#if overlayPathD}
    <path
      d={overlayPathD}
      fill="none"
      stroke="var(--radar-overlay)"
      stroke-width="1.5"
      stroke-dasharray="3 2"
      stroke-opacity="0.85"
    />
  {/if}
```

- [ ] **Step 3: Verify the existing GoIs page still renders the radar chart correctly (no regression)**

Run: `npm run build`
Expected: build succeeds.
Run: `npm run dev` (in another terminal) and load `/gois`; eyeball the existing per-GoI radars — they should render exactly as before because no consumer is yet passing `overlay`.

---

## Task 10: Create `SubFactionPanel.svelte`

The new presentational component for the rail content.

**Files:**
- Create: `src/lib/components/SubFactionPanel.svelte`

- [ ] **Step 1: Create the file with full component code**

Write `src/lib/components/SubFactionPanel.svelte`:
```svelte
<script>
  import RadarChart from './RadarChart.svelte';
  import { goiColor } from '../faction-colors.js';
  import { createEventDispatcher } from 'svelte';

  /** @type {{name: string, goal: string|null, influence: number|null,
   *          approval: number|null, national_share: number|null,
   *          effective_worldview: Record<string, number|null>|null}|null} */
  export let subfaction = null;
  /** @type {{name: string, effective_worldview: Record<string, number>}|null} */
  export let parent = null;

  const dispatch = createEventDispatcher();

  const AXES = ['expansion', 'authority', 'corporate', 'technocratic', 'faith', 'materialist'];

  function close() { dispatch('close'); }

  function pct(v) {
    return v == null ? '—' : `${Math.round(v * 100)}%`;
  }
  function pctOneDec(v) {
    return v == null ? '—' : `${(Math.round(v * 1000) / 10).toFixed(1)}%`;
  }

  $: hasSubfactionWorldview = subfaction?.effective_worldview &&
    AXES.every((a) => subfaction.effective_worldview[a] != null);
  $: hasParentWorldview = parent?.effective_worldview &&
    AXES.every((a) => parent.effective_worldview[a] != null);
  $: subfactionAxes = hasSubfactionWorldview
    ? AXES.map((a) => ({ label: a, value: subfaction.effective_worldview[a] }))
    : null;
  $: parentAxes = hasParentWorldview
    ? AXES.map((a) => ({ label: a, value: parent.effective_worldview[a] }))
    : null;
</script>

{#if subfaction == null}
  <div class="s-rail-empty" role="region" aria-label="Sub-faction detail">
    <div class="s-rail-empty-icon" aria-hidden="true">◇</div>
    <p>Select a sub-faction to inspect</p>
  </div>
{:else}
  <div class="s-rail-panel" role="region" aria-label="Sub-faction detail">
    <header class="s-rail-header">
      <span
        class="faction-bar"
        style="--bar-color: {parent ? goiColor(parent.name) : 'var(--border)'}"
        aria-hidden="true"
      ></span>
      <div class="s-rail-titles">
        <h3 class="s-rail-name">{subfaction.name}</h3>
        {#if parent}
          <div class="s-rail-parent">{parent.name}</div>
        {/if}
      </div>
      <button
        type="button"
        class="s-rail-close"
        on:click={close}
        aria-label="Close sub-faction detail"
      >×</button>
    </header>

    <section class="s-rail-section">
      <div class="s-rail-section-label">Goal</div>
      {#if subfaction.goal}
        <p class="s-rail-goal">{subfaction.goal}</p>
      {:else}
        <p class="s-rail-goal s-rail-goal-empty"><em>No goal recorded</em></p>
      {/if}
    </section>

    {#if subfactionAxes || parentAxes}
      <section class="s-rail-section s-rail-radar">
        <RadarChart
          axes={subfactionAxes ?? parentAxes}
          overlay={subfactionAxes ? parentAxes : null}
          size={200}
        />
        {#if !subfactionAxes && parentAxes}
          <div class="s-rail-radar-note">
            <em>per-faction stance unavailable</em>
          </div>
        {/if}
      </section>
    {/if}

    <section class="s-rail-section s-rail-kpis">
      <div class="s-rail-kpi">
        <div class="s-rail-kpi-label">Influence</div>
        <div class="s-rail-kpi-value tnum">{pct(subfaction.influence)}</div>
      </div>
      <div class="s-rail-kpi">
        <div class="s-rail-kpi-label">Nat. Share</div>
        <div class="s-rail-kpi-value tnum">{pctOneDec(subfaction.national_share)}</div>
      </div>
      <div class="s-rail-kpi">
        <div class="s-rail-kpi-label">Approval</div>
        <div class="s-rail-kpi-value tnum">{pct(subfaction.approval)}</div>
      </div>
    </section>
  </div>
{/if}
```

- [ ] **Step 2: Verify the build still passes**

Run: `npm run build`
Expected: build succeeds; the new component is referenced by no caller yet, so no visible change.

---

## Task 11: Add rail / sheet / row-active styles to `global.css`

Defines the visual scaffolding for the panel across desktop and mobile, plus the active-row highlight on the GoI cards. All theme-variable-driven per gotcha #12.

**Files:**
- Modify: `src/styles/global.css` (append toward the bottom of the file)

- [ ] **Step 1: Verify the nav height before picking a fallback**

Inspect `src/lib/components/NavBar.svelte` (or whatever the rendered nav component is) for its rendered height. Use Read on the file and identify the `padding`/`height` declarations on the nav root. If a CSS custom property like `--nav-h` already exists in `global.css`, use it. If not, measure: at runtime, `getBoundingClientRect().height` of the rendered nav element. Pick the integer value (e.g. 48, 52, 56, 60) and use it as the fallback in Step 2 below — replace `56px` with the verified value if different.

Run (from PowerShell): `Select-String -Path src/styles/global.css -Pattern '--nav-h'`
Expected: empty (no existing token) OR a definition you can reuse.

- [ ] **Step 2: Append rail-and-sheet styles**

Edit `src/styles/global.css` — add at the end of the file:
```css
/* === Sub-faction rail / bottom sheet ====================================== */
.s-rail {
  position: sticky;
  /* Top offset matches the rendered nav. The fallback below should be replaced
     with the verified value from Step 1 above. */
  top: var(--nav-h, 56px);
  align-self: start;
  background: var(--bg-2);
  border: 2px solid var(--border);
  padding: 16px;
  min-height: 240px;
  display: flex;
  flex-direction: column;
}

.s-rail-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--muted);
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-align: center;
  gap: 8px;
}
.s-rail-empty-icon { font-size: 32px; opacity: 0.4; }

.s-rail-panel { display: flex; flex-direction: column; gap: 14px; }

.s-rail-header {
  display: grid;
  grid-template-columns: 4px 1fr auto;
  gap: 10px;
  align-items: start;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-soft);
}
.s-rail-titles { min-width: 0; }
.s-rail-name {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  margin: 0;
}
.s-rail-parent {
  font-size: 10px;
  color: var(--muted);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-top: 2px;
}
.s-rail-close {
  background: transparent;
  border: 1px solid var(--border-soft);
  color: var(--fg);
  width: 28px;
  height: 28px;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.s-rail-close:hover { background: var(--accent-soft); }
.s-rail-close:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.s-rail-section { display: flex; flex-direction: column; gap: 6px; }
.s-rail-section-label {
  font-size: 9px;
  color: var(--muted);
  letter-spacing: 0.22em;
  text-transform: uppercase;
}
.s-rail-goal {
  font-style: italic;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
  max-width: 32ch;
}
.s-rail-goal-empty { color: var(--muted); }

.s-rail-radar { align-items: center; }
.s-rail-radar-note { font-size: 10px; color: var(--muted); margin-top: 2px; }

.s-rail-kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  border-top: 1px solid var(--border-soft);
  padding-top: 10px;
}
.s-rail-kpi { display: flex; flex-direction: column; gap: 2px; }
.s-rail-kpi-label {
  font-size: 9px;
  color: var(--muted);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.s-rail-kpi-value { font-size: 18px; font-weight: 800; }

/* Mobile bottom sheet (reuses the panel content via the same component) */
.s-sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 50;
}
.s-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  background: var(--bg-2);
  border-top: 2px solid var(--border);
  padding: 16px;
  max-height: 80vh;
  overflow-y: auto;
}

/* Active-row highlight on the GoI cards' sub-faction list */
.s-rail-row-active {
  background: var(--accent-soft);
  border-left: 2px solid var(--accent);
  padding-left: 6px;
  margin-left: -8px;
}
```

- [ ] **Step 3: Verify the build still passes**

Run: `npm run build`
Expected: build succeeds.

---

## Task 12: Restructure `GoIs.svelte` page grid

Splits the page into the cards column + rail column on wide viewports, single column on narrow. Wraps content in a responsive grid container.

**Files:**
- Modify: `src/routes/GoIs.svelte`

- [ ] **Step 1: Update the top-level `<section>` to host the responsive page grid**

Edit `src/routes/GoIs.svelte` — change the outer `<section>` line:
```svelte
<section class="px-6 py-5 max-w-[1600px] gois-page">
```
And in a `<style>` block at the bottom of the file (or extend it if one already exists), add:
```svelte
<style>
  .gois-page { display: grid; grid-template-columns: 1fr; gap: 16px; }
  @media (min-width: 1280px) {
    .gois-page { grid-template-columns: 1fr 360px; }
  }
  .gois-main { min-width: 0; }
</style>
```

- [ ] **Step 2: Wrap the existing content (Band 01, GoI grid, Band 02, Heatmap) in a `.gois-main` div**

Edit `src/routes/GoIs.svelte` — wrap the existing rendered content inside the `{:else}` branch (Band 01 through the Pop Capture matrix `</div>`) in a `<div class="gois-main">…</div>`. Keep the existing GoI cards' `grid grid-cols-1 lg:grid-cols-2 gap-3` classes exactly as they are — those cards already collapse cleanly inside the narrower 1fr column. The placeholder rail added in Step 3 will be a sibling of `.gois-main`, both children of the outer `.gois-page` section.

- [ ] **Step 3: Add a placeholder rail slot inside the `{:else}` branch as a sibling of `.gois-main`**

Edit `src/routes/GoIs.svelte` — directly after the `</div>` that closes the `gois-main` wrapper (still inside the `{:else}` branch — NOT after `{/if}`), add:
```svelte
    <aside class="s-rail" aria-hidden="true">
      <!-- Sub-faction detail panel mounts here (Task 14). -->
    </aside>
```

The `.gois-main` div and the `<aside class="s-rail">` are both children of the outer `<section class="gois-page">`. Both must be inside the `{:else}` branch so they are only rendered after `$gois` has loaded — placing the aside outside `{:else}` would mean it tries to mount with `$gois === null` and the panel logic in Task 14 would crash on `$gois.gois.find(...)`.

- [ ] **Step 4: Verify the build still passes and the page still renders all existing content**

Run: `npm run build` then `npm run dev`. Load `/gois` in the browser. Confirm:
- All 4 GoI cards render in a 1- or 2-column grid (depending on viewport).
- Pop Capture matrix renders below as before.
- An empty rail panel is visible on the right at viewports ≥1280px and absent (or empty) below that.

---

## Task 13: Convert sub-faction rows to `<button>` + selection state

Adds the page-local `selected` state, makes each sub-faction row a focusable button with click handlers, and applies the active-row highlight.

**Files:**
- Modify: `src/routes/GoIs.svelte`

- [ ] **Step 1: Add the selection state and derived lookups in the `<script>` block**

Edit `src/routes/GoIs.svelte` — within the existing `<script>` block, after the `const AXES = …` line, add:
```js
  /** @type {{goi: string, sf: string} | null} */
  let selected = null;

  function toggleSelect(goiName, sfName) {
    if (selected && selected.goi === goiName && selected.sf === sfName) {
      selected = null;
    } else {
      selected = { goi: goiName, sf: sfName };
    }
  }

  $: selectedParent = selected
    ? ($gois?.gois.find((g) => g.name === selected.goi) ?? null)
    : null;
  $: selectedSf = selected && selectedParent
    ? (selectedParent.sub_factions.find((s) => s.name === selected.sf) ?? null)
    : null;

  // Auto-dismiss stale selections after a sync (selectedSf goes null when the
  // sub-faction is renamed/removed in a refreshed gois.json).
  $: if (selected && (!selectedParent || !selectedSf)) selected = null;
```

- [ ] **Step 2: Replace the sub-faction `<ul><li>…</li></ul>` markup with `<button>` rows**

Edit `src/routes/GoIs.svelte` — locate the `{#if g.sub_factions?.length}` block (the existing list) and replace its inner `<ul>…</ul>` with:
```svelte
                <ul class="m-0 p-0 list-none text-[11px]">
                  {#each g.sub_factions as s}
                    {@const isActive = selected && selected.goi === g.name && selected.sf === s.name}
                    <li>
                      <button
                        type="button"
                        class="w-full flex justify-between border-b border-[var(--border-soft)] border-dashed py-1 text-left"
                        class:s-rail-row-active={isActive}
                        aria-pressed={isActive}
                        on:click={() => toggleSelect(g.name, s.name)}
                      >
                        <span>{s.name}</span>
                        <span class="text-muted tnum">
                          {s.influence != null ? Math.round(s.influence * 100) + '%' : '—'} ·
                          ap {s.approval != null ? Math.round(s.approval * 100) + '%' : '—'}
                        </span>
                      </button>
                    </li>
                  {/each}
                </ul>
```

(Per gotcha #7, `{@const}` must be the immediate child of `{#each}` — NOT nested inside an arbitrary HTML element. In the code above, `{@const isActive = …}` sits directly between the `{#each …}` opener and the `<li>` opener, so it IS the immediate child of `{#each}`. Do NOT move `{@const}` inside the `<li>` or `<button>` — that would break the build.)

- [ ] **Step 3: Verify the build passes and rows are clickable + visually highlight when active**

Run: `npm run build` then `npm run dev`. In the browser at `/gois`:
- Click any sub-faction row — it should highlight (left bar + soft background).
- Click the same row again — highlight clears.
- Click a different row — highlight moves.
- The placeholder rail (added in Task 12) remains empty for now.

---

## Task 14: Wire `SubFactionPanel` into the rail and bottom sheet + Esc handler

Mounts the panel inside the sticky rail (desktop) and a bottom sheet (mobile), and wires the Esc key + close events to dismiss the selection.

**Files:**
- Modify: `src/routes/GoIs.svelte`

- [ ] **Step 1: Import the new panel and add Esc handling in `<script>`**

Edit `src/routes/GoIs.svelte` — at the top of the existing `<script>` block, add:
```js
  import SubFactionPanel from '../lib/components/SubFactionPanel.svelte';
```
And further down (after the `selected` declarations from Task 13), add:
```js
  function handleKeydown(e) {
    if (e.key === 'Escape' && selected) {
      selected = null;
    }
  }
```

- [ ] **Step 2: Bind the keydown handler at the page level**

Edit `src/routes/GoIs.svelte` — directly after the `<script>` block closes, add a `<svelte:window>` directive:
```svelte
<svelte:window on:keydown={handleKeydown} />
```

- [ ] **Step 3: Replace the placeholder rail markup with a real desktop rail + mobile sheet**

Edit `src/routes/GoIs.svelte` — replace the `<aside class="s-rail" aria-hidden="true">…</aside>` placeholder added in Task 12 with two conditional blocks:
```svelte
    <!-- Desktop sticky rail (≥1280px via CSS) -->
    <aside class="s-rail gois-rail-desktop">
      <SubFactionPanel
        subfaction={selectedSf}
        parent={selectedParent}
        on:close={() => (selected = null)}
      />
    </aside>

    <!-- Mobile bottom sheet (<1280px via CSS) -->
    {#if selected && selectedSf}
      <div
        class="s-sheet-backdrop gois-sheet-mobile"
        on:click={() => (selected = null)}
        role="presentation"
      ></div>
      <div class="s-sheet gois-sheet-mobile">
        <SubFactionPanel
          subfaction={selectedSf}
          parent={selectedParent}
          on:close={() => (selected = null)}
        />
      </div>
    {/if}
```

- [ ] **Step 4: Add the responsive show/hide rules for desktop rail and mobile sheet**

Edit `src/routes/GoIs.svelte` — extend the existing `<style>` block (added in Task 12) to:
```svelte
<style>
  .gois-page { display: grid; grid-template-columns: 1fr; gap: 16px; }
  @media (min-width: 1280px) {
    .gois-page { grid-template-columns: 1fr 360px; }
  }
  .gois-main { min-width: 0; }

  .gois-rail-desktop { display: none; }
  @media (min-width: 1280px) {
    .gois-rail-desktop { display: block; }
  }

  .gois-sheet-mobile { display: block; }
  @media (min-width: 1280px) {
    .gois-sheet-mobile { display: none; }
  }
</style>
```

- [ ] **Step 5: Verify all the desktop interactions work**

Run: `npm run build` then `npm run dev`. In the browser at `/gois` (≥1280px viewport):
- Empty rail shows the "Select a sub-faction to inspect" placeholder.
- Click any sub-faction row — rail populates with name, parent, goal, radar (with parent overlay), and three KPI tiles.
- Click the same row again — rail returns to empty state.
- Click ✕ — rail returns to empty state.
- Press Esc — rail returns to empty state.
- Switch the theme (☀ / ☾ / ⊞) — overlay polygon stays legible against the primary line in every theme.

- [ ] **Step 6: Verify the mobile sheet works**

Resize the browser to <1280px:
- Rail vanishes from layout.
- Click any sub-faction row — bottom sheet slides up with the same content.
- Tap the dimmed backdrop — sheet dismisses.
- Tap ✕ — sheet dismisses.
- Press Esc — sheet dismisses.

---

## Task 15: E2E happy-path test

Asserts the click-through behaviour with Playwright.

**Files:**
- Create: `tests-e2e/gois.spec.js`

- [ ] **Step 1: Confirm `tests-e2e/` exists and check the existing test for conventions**

Use the Read tool on `tests-e2e/a11y.spec.js` to inspect THEMES + localStorage key conventions. Confirm: the localStorage theme key is `'theme'` (per the existing `localStorage.setItem('theme', t)` line); routes are hash-routed (`/#/gois`).

- [ ] **Step 2: Write the E2E spec**

Create `tests-e2e/gois.spec.js`:
```js
import { test, expect } from '@playwright/test';

// Selects the first sub-faction button in the cards grid. We don't pin to a
// specific name (e.g. Statebuilders) because live sync data could rename
// factions; instead we rely on the structural class `.gois-main` and the
// `aria-pressed` attribute the row buttons carry.
const FIRST_ROW = '.gois-main button[aria-pressed]';

test.describe('GoIs page sub-faction drilldown', () => {
  test.beforeEach(async ({ page }) => {
    // Routes use hash routing — match how a11y.spec.js navigates.
    await page.goto('/#/gois');
    // Hash navigation doesn't fire network idle, so wait on the data-driven
    // markup directly. The cards render each GoI name as h3 once gois.json
    // has loaded.
    await page.waitForSelector(FIRST_ROW, { timeout: 10_000 });
  });

  test('clicking a sub-faction populates the rail panel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('.s-rail-empty')).toBeVisible();

    const firstRow = page.locator(FIRST_ROW).first();
    const expectedName = await firstRow.locator('span').first().textContent();
    await firstRow.click();

    await expect(page.locator('.s-rail-name')).toHaveText((expectedName ?? '').trim());
    await expect(page.locator('.s-rail-parent')).toBeVisible();
    await expect(page.locator('.s-rail-goal')).toBeVisible();
    // The dashed overlay polygon is the load-bearing visual proof of overlay rendering.
    await expect(page.locator('.s-rail svg path[stroke-dasharray]')).toHaveCount(1);
  });

  test('clicking the same sub-faction again clears the panel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const row = page.locator(FIRST_ROW).first();
    await row.click();
    await expect(page.locator('.s-rail-name')).toBeVisible();
    await row.click();
    await expect(page.locator('.s-rail-empty')).toBeVisible();
  });

  test('Esc dismisses the rail selection', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator(FIRST_ROW).first().click();
    await expect(page.locator('.s-rail-name')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.s-rail-empty')).toBeVisible();
  });

  test('mobile viewport uses bottom sheet instead of sticky rail', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('.gois-rail-desktop')).toBeHidden();
    await expect(page.locator('.s-sheet')).toHaveCount(0);

    await page.locator(FIRST_ROW).first().click();

    await expect(page.locator('.s-sheet')).toBeVisible();
    await expect(page.locator('.s-sheet .s-rail-name')).toBeVisible();
    // Tap backdrop dismisses.
    await page.locator('.s-sheet-backdrop').click();
    await expect(page.locator('.s-sheet')).toHaveCount(0);
  });
});
```

- [ ] **Step 3: Run the E2E test against the dev server**

Run: `npm run test:e2e -- tests-e2e/gois.spec.js`
Expected: all four tests pass. If the dev server isn't running and the project's playwright.config doesn't auto-start it, start `npm run dev` in another terminal first.

If a test fails:
- Check the browser console for `[RadarChart] overlay/axes` warnings — they indicate a wiring bug in `SubFactionPanel.svelte`.
- For the dashed-stroke check: confirm `--radar-overlay` is defined in the active theme.
- For the row-click check: confirm sub-faction `<button>` rows have `aria-pressed` set (Task 13).

---

## Task 16: Axe a11y check across all three themes

Extends the existing axe sweep to cover the GoIs page with a sub-faction selected — both desktop rail and mobile sheet states.

**Files:**
- Modify: `tests-e2e/a11y.spec.js`

The existing file iterates `THEMES` × `PAGES` and runs axe on each combo. We add a parallel block specifically for the GoIs page with a sub-faction selected — that state isn't reachable from the existing scan.

- [ ] **Step 1: Append the rail-active a11y block at the end of the file**

Edit `tests-e2e/a11y.spec.js` — append (after the existing `for (const theme of THEMES)` loop closes):
```js
// GoIs rail in the "sub-faction selected" state — not reachable from the
// default page-load scan, so we sweep it explicitly per theme.
for (const theme of THEMES) {
  test(`a11y: ${theme} theme — /#/gois with sub-faction selected (desktop rail)`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate((t) => {
      localStorage.setItem('theme', t);
    }, theme);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#/gois');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h3:has-text("Administration")', { timeout: 10_000 });
    // Click the first visible sub-faction button (any name will do).
    await page.locator('.gois-main button[aria-pressed]').first().click();
    await page.waitForSelector('.s-rail-name');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test(`a11y: ${theme} theme — /#/gois with sub-faction selected (mobile sheet)`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate((t) => {
      localStorage.setItem('theme', t);
    }, theme);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/#/gois');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h3:has-text("Administration")', { timeout: 10_000 });
    await page.locator('.gois-main button[aria-pressed]').first().click();
    await page.waitForSelector('.s-sheet .s-rail-name');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
```

- [ ] **Step 2: Run the a11y suite**

Run: `npm run test:e2e -- tests-e2e/a11y.spec.js`
Expected: no new axe violations introduced by the rail/sheet markup. If violations appear:
- Missing form labels — confirm `aria-pressed` on row buttons, `aria-label` on close button, `role="region"` + `aria-label` on the panel wrapper.
- Color contrast — adjust `--radar-overlay` token alpha/hue for the offending theme; re-run.

---

## Task 17: Update CLAUDE.md with the new sub-faction drilldown notes

Per the user's standing project workflow ("Before commit and pushing any changes, you should first update the CLAUDE.md of the project"), capture the load-bearing additions: new soft-optional ranges, the name-pair-zip pattern for cross-sheet alignment, and the rail's responsive layout.

**Files:**
- Modify: `CLAUDE.md` (the project file)

- [ ] **Step 1: Add a new gotcha entry under "Common gotchas" describing the cross-sheet name-pair zip**

Edit `CLAUDE.md` — append a new numbered gotcha (continue the numbering from the last existing one, currently 16):
```
17. **Cross-sheet name-pair zip for sub-faction worldview.** `extractors/gois.py` reads `SubFactionDetail` (a separate sheet from Sub-Factions) and zips into per-sub-faction records by `(GoI, Sub-faction)` name pair, NOT row index. Backend invariant claims row alignment, but a single inserted row on either sheet would silently corrupt every faction's effective worldview — so the zip is defensive. If you add another cross-sheet derived view, follow the same pattern.
```

- [ ] **Step 2: Add a brief note under "Critical conventions" about the `--radar-overlay` token + tri-theme requirement**

Edit `CLAUDE.md` — extend convention #12 (the design vocabulary list) by appending to the theme variables paragraph:
> `--radar-overlay` (used by `RadarChart.svelte`'s `overlay` prop for ghost polygons) joins the existing token set; like all theme tokens, it must be defined in all three themes per the gotcha #12 invariant.

- [ ] **Step 3: Add a "Where to read more" entry pointing at the new spec + plan**

Edit `CLAUDE.md` — at the end of the "Where to read more" list, append:
```
- Spec (sub-faction drilldown): `docs/superpowers/specs/2026-05-07-subfaction-detail-design.md`
- Plan (sub-faction drilldown): `docs/superpowers/plans/2026-05-07-subfaction-detail.md`
```

- [ ] **Step 4: Verify the file still parses as Markdown (eyeball)**

Use the Read tool on `CLAUDE.md` (offset around the section you edited) and confirm: well-formed Markdown, no truncated bullets, no orphan inline code marks. Do NOT use bash `head`/`tail` (the env is PowerShell on Windows).

---

## Task 18: Final verification

Hands-off pass to confirm everything in scope is wired correctly before reporting completion to the user.

- [ ] **Step 1: Run the full Python test suite**

Run: `pytest tests/ -v`
Expected: all 4 new gois tests pass; baseline failures (per CLAUDE.md gotcha #10) unchanged.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: builds cleanly with no warnings about missing variables, undefined imports, or unused props.

- [ ] **Step 3: Run the E2E suite**

Run: `npm run test:e2e`
Expected: the new `gois.spec.js` tests pass + axe sweeps clean.

- [ ] **Step 4: Manual smoke across all three themes**

Run: `npm run dev`. Load `/gois`, click a sub-faction, then cycle through ☀ / ☾ / ⊞. For each theme:
- Rail panel header, goal text, KPI tiles all readable.
- Primary radar polygon + dashed overlay both legible (overlay is faint but distinguishable).
- Active-row highlight on the GoI card is visible.

- [ ] **Step 5: Report completion to the user**

Tell the user:
- Schema bumped 4 → 5; sync pipeline + frontend in lockstep.
- Three new soft-optional ranges live: `SubFactionGoal`, `SubFactionNationalShare`, `SubFactionDetail`.
- New `SubFactionPanel.svelte` component + restructured GoIs page.
- All existing tests still passing; 4 new extractor tests + 4 new E2E tests added.

Then ask the user how to structure the final commit(s) (per their standing memory preference — defer commits until end of plan).
