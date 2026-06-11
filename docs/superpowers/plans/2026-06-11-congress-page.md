# Congress Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New public `/#/congress` page showing All-Worker Congress (27 seats) and Celestial Council (15 seats) compositions by party, fed by three new named ranges already live in the GM workbook.

**Architecture:** A new `congress` extractor reads `CongressPartyNames` / `CongressPartySeats` / `CouncilSeatsByParty` (all soft-optional, on the `All-Worker Congress` sheet) and emits `congress.json` with two chamber blocks. A new store + route render each chamber through a shared `SeatChamber` component (Total Seats KPI → stacked seat strip → per-party rows). Schema version bumps 10 → 11.

**Tech Stack:** Python/openpyxl (extractor, pytest), Svelte 4 + svelte-spa-router (route), Vitest + @testing-library/svelte (units), Playwright + axe (e2e).

**Spec:** `docs/superpowers/specs/2026-06-11-congress-page-design.md`

---

## Prerequisites & commit policy

- **`feat/frontend-hardening` must be committed/merged first.** This plan depends on `PageState.svelte`, `src/lib/format.js`, and the store error-reset invariant — all introduced on that branch. Branch `feat/congress-page` from it (or from `main` after it merges).
- **The three named ranges are already live in the Google Sheet** (added 2026-06-11 via Sheets API; verified in the xlsx export). No workbook work remains.
- **Do NOT commit per task.** Per the user's standing preference, defer all commits: complete the tasks, then ask the user how to structure the final commit(s). The spec + this plan (currently untracked) ride along into the final commit structure.
- **Do not hand-edit `public/data/`.** `congress.json` lands there via the scheduled Action after merge.

## File structure

| File | Responsibility |
|---|---|
| `scripts/extractors/congress.py` (create) | Read 3 named ranges → `{congress, council}` chamber dicts |
| `scripts/validate_schema.py` (modify) | Register the 3 ranges as soft-optional |
| `scripts/sync_sheet.py` (modify) | Register `congress` extractor; `SCHEMA_VERSION = 11` |
| `tests/fixtures/build_test_workbook.py` (modify) | Add `All-Worker Congress` sheet + 3 ranges |
| `tests/extractors/test_congress.py` (create) | Extractor unit tests |
| `tests/test_validate_schema.py`, `tests/test_sync_sheet.py` (modify) | Soft-optional doc test; registry + version assertions |
| `src/lib/stores/congress.js` (create) | Store trio: `congress`, `congressError`, `loadCongress` |
| `src/lib/components/SeatChamber.svelte` (create) | One chamber: KPI + seat strip + party rows |
| `src/lib/components/SeatChamber.test.js` (create) | Sorting, muting, shares |
| `src/routes/Congress.svelte` (create) | Route: PageState wrapper, two bands, empty state |
| `src/lib/faction-colors.js` (modify) | `'Education Party': '#1abc9c'` |
| `src/lib/stores/meta.js` (modify) | `EXPECTED_SCHEMA_VERSION = 11` |
| `src/App.svelte`, `src/lib/components/NavBar.svelte` (modify) | Route + nav entry after Parties |
| `src/styles/global.css` (modify) | `.seat-strip` / `.seat-rows` / `.seat-row` |
| `tests-e2e/congress.spec.js` (create) | Render + a11y + empty state |
| `tests-e2e/a11y.spec.js` (modify) | Add `/#/congress` to PAGES |
| `tests-e2e/{tech,cropsim,partial-failures}.spec.js`, `src/lib/components/PageState.test.js`, `src/lib/stores/error-reset.test.js`, `src/lib/faction-colors.test.js` (modify) | schema_version mock bumps; new test cases |
| `CLAUDE.md` (modify) | New convention entry + CSS class list + components list |

---

### Task 1: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Confirm the hardening work has landed**

Run: `git status --short` and `git log --oneline -3`
Expected: clean working tree apart from the untracked `docs/superpowers/specs/2026-06-11-congress-page-design.md` and `docs/superpowers/plans/2026-06-11-congress-page.md`. If `feat/frontend-hardening` changes are still uncommitted, STOP and resolve that first.

- [ ] **Step 2: Create the feature branch**

```bash
git checkout -b feat/congress-page
```

---

### Task 2: Fixture workbook — All-Worker Congress sheet

**Files:**
- Modify: `tests/fixtures/build_test_workbook.py` (insert before the final `wb.save(out_path)` block)

- [ ] **Step 1: Add the sheet + named ranges to the fixture builder**

Insert this block immediately before the `wb.save(out_path)` line (after the Tech & Institutions block):

```python
    # ---- All-Worker Congress sheet (v11) ----
    # Party columns B..P mirror the Parties sheet's 15 slots; Q is Non-aligned.
    # Live layout: row 44 = party header, row 45 = Congress seats (Σ=27),
    # row 49 = Celestial Council seats (Σ=15, Art. 16). Blank-name columns
    # carry 0 seats — the extractor must drop them (convention 8) while
    # keeping the NAMED zero-seat entry (Non-aligned).
    awc = wb.create_sheet("All-Worker Congress")
    awc["A43"] = "PARTY TOTALS (Congress)"
    awc["A45"] = "Seats"
    awc["A47"] = "CELESTIAL COUNCIL ALLOCATION (Art. 16)"
    awc["A49"] = "Council Seats"
    party_cols = {2: "Liberty Now", 3: "People's Voice", 17: "Non-aligned"}
    congress_seats = {2: 15, 3: 12, 17: 0}
    council_seats = {2: 8, 3: 7, 17: 0}
    for col, name in party_cols.items():
        awc.cell(row=44, column=col, value=name)
    for col in range(2, 18):  # B..Q
        awc.cell(row=45, column=col, value=congress_seats.get(col, 0))
        awc.cell(row=49, column=col, value=council_seats.get(col, 0))
    _add_name(wb, "CongressPartyNames", "'All-Worker Congress'!$B$44:$Q$44")
    _add_name(wb, "CongressPartySeats", "'All-Worker Congress'!$B$45:$Q$45")
    _add_name(wb, "CouncilSeatsByParty", "'All-Worker Congress'!$B$49:$Q$49")
```

- [ ] **Step 2: Verify no existing test regresses**

Run: `python -m pytest tests/ -q`
Expected: all pass (the new sheet/ranges are additive).

---

### Task 3: Extractor `congress.py` (TDD)

**Files:**
- Create: `tests/extractors/test_congress.py`
- Create: `scripts/extractors/congress.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/extractors/test_congress.py`:

```python
from __future__ import annotations

from extractors import congress


def test_congress_extracts_both_chambers(wb):
    result = congress.extract(wb)
    assert set(result.keys()) == {"congress", "council"}
    assert result["congress"]["total_seats"] == 27
    assert result["council"]["total_seats"] == 15


def test_congress_filters_blank_party_slots(wb):
    result = congress.extract(wb)
    names = [p["name"] for p in result["congress"]["parties"]]
    # 13 blank columns dropped; named columns kept in workbook slot order.
    assert names == ["Liberty Now", "People's Voice", "Non-aligned"]


def test_congress_keeps_named_zero_seat_parties(wb):
    result = congress.extract(wb)
    nonaligned = next(
        p for p in result["congress"]["parties"] if p["name"] == "Non-aligned"
    )
    assert nonaligned["seats"] == 0


def test_congress_council_seats_pair_by_column(wb):
    result = congress.extract(wb)
    by_name = {p["name"]: p["seats"] for p in result["council"]["parties"]}
    assert by_name == {"Liberty Now": 8, "People's Voice": 7, "Non-aligned": 0}


def test_congress_missing_ranges_yield_empty_chambers(wb):
    del wb.defined_names["CongressPartyNames"]
    del wb.defined_names["CongressPartySeats"]
    del wb.defined_names["CouncilSeatsByParty"]
    result = congress.extract(wb)
    assert result["congress"] == {"total_seats": 0, "parties": []}
    assert result["council"] == {"total_seats": 0, "parties": []}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/extractors/test_congress.py -v`
Expected: FAIL with `ImportError: cannot import name 'congress'` (module does not exist yet).

- [ ] **Step 3: Write the extractor**

Create `scripts/extractors/congress.py`:

```python
"""Extract the All-Worker Congress page data.

Three named ranges on the `All-Worker Congress` sheet share one party-column
axis (15 party slots in cols B..P mirroring the Parties sheet, plus
Non-aligned in col Q):

- CongressPartyNames:  party header row
- CongressPartySeats:  Congress seats per party (Art. 15)
- CouncilSeatsByParty: Celestial Council seats per party (Art. 16)

All three are soft-optional (see validate_schema.SOFT_OPTIONAL_V3_RANGES):
a workbook without them yields empty chamber lists and the frontend renders
an empty state. Chamber totals are derived by summing — there is no scalar
total range. Named zero-seat entries are kept (a founded party shut out of
the chamber is information); blank-name slots are dropped (convention 8).
"""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, read_named_range


def extract(wb) -> dict[str, Any]:
    names = _single_row(read_named_range(wb, "CongressPartyNames"))
    return {
        "congress": _chamber(names, _single_row(read_named_range(wb, "CongressPartySeats"))),
        "council": _chamber(names, _single_row(read_named_range(wb, "CouncilSeatsByParty"))),
    }


def _single_row(rows: list[list[Any]]) -> list[Any]:
    return rows[0] if rows else []


def _chamber(names: list[Any], seats: list[Any]) -> dict[str, Any]:
    parties: list[dict[str, Any]] = []
    total = 0.0
    for i, raw_name in enumerate(names):
        if raw_name in (None, ""):
            continue  # blank party slot reserved for future growth
        name = str(raw_name).strip()
        if not name:
            continue
        seat_count = coerce_number(seats[i]) if i < len(seats) else None
        parties.append({"name": name, "seats": seat_count})
        if seat_count is not None:
            total += seat_count
    return {"total_seats": int(total), "parties": parties}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/extractors/test_congress.py -v`
Expected: 5 passed.

---

### Task 4: Validator — register soft-optional ranges

**Files:**
- Modify: `tests/test_validate_schema.py`
- Modify: `scripts/validate_schema.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_validate_schema.py`:

```python
def test_congress_ranges_are_documented_soft_optional():
    for name in ("CongressPartyNames", "CongressPartySeats", "CouncilSeatsByParty"):
        assert name in SOFT_OPTIONAL_V3_RANGES
```

Run: `python -m pytest tests/test_validate_schema.py -v`
Expected: the new test FAILS (`assert 'CongressPartyNames' in [...]`); all others pass.

- [ ] **Step 2: Register the ranges**

In `scripts/validate_schema.py`, append to the end of the `SOFT_OPTIONAL_V3_RANGES` list (after the `"WeeklyHoursWorkedTable",` entry):

```python
    # v11 — All-Worker Congress page (read by extractors/congress.py via
    # read_named_range; missing → empty chamber lists, frontend renders an
    # empty-state band on the /congress page). Party columns B..P mirror the
    # Parties sheet's 15 slots; col Q is Non-aligned.
    "CongressPartyNames",
    "CongressPartySeats",
    "CouncilSeatsByParty",
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `python -m pytest tests/test_validate_schema.py -v`
Expected: all pass.

---

### Task 5: Registry + schema version bump (10 → 11)

**Files:**
- Modify: `tests/test_sync_sheet.py:64` (version assertion) + append new test
- Modify: `scripts/sync_sheet.py:40` (version), imports (~line 33), extractor registry (~line 122)
- Modify: `src/lib/stores/meta.js:7`
- Modify: `tests-e2e/tech.spec.js:100`, `tests-e2e/cropsim.spec.js:41`, `tests-e2e/partial-failures.spec.js:6`, `src/lib/components/PageState.test.js:10` (mock metas)

- [ ] **Step 1: Update version assertion and add the failing registry test**

In `tests/test_sync_sheet.py`, change line 64 from `assert meta["schema_version"] == 10` to:

```python
    assert meta["schema_version"] == 11
```

Append:

```python
def test_run_sync_writes_congress_json(fixture_workbook_path, tmp_path):
    out_dir = tmp_path / "data"
    out_dir.mkdir()
    run_sync(fixture_workbook_path, out_dir)
    assert (out_dir / "congress.json").exists()
    payload = json.loads((out_dir / "congress.json").read_text())
    assert payload["congress"]["total_seats"] == 27
    assert payload["council"]["total_seats"] == 15
    names = [p["name"] for p in payload["congress"]["parties"]]
    assert names == ["Liberty Now", "People's Voice", "Non-aligned"]
```

Run: `python -m pytest tests/test_sync_sheet.py -v`
Expected: both `test_run_sync_writes_status_and_meta` (version 10 ≠ 11) and `test_run_sync_writes_congress_json` (no congress.json) FAIL.

- [ ] **Step 2: Register the extractor and bump the version**

In `scripts/sync_sheet.py`:

1. Add to the extractor imports (alphabetical, after `from extractors import catalog as ex_catalog`):

```python
from extractors import congress as ex_congress
```

2. Change `SCHEMA_VERSION = 10` to `SCHEMA_VERSION = 11`.

3. In the `extractors` list inside `run_sync`, after `("tech", ex_tech.extract),` add:

```python
        ("congress", ex_congress.extract),
```

- [ ] **Step 3: Bump the frontend expectation and every mock meta**

1. `src/lib/stores/meta.js`: `const EXPECTED_SCHEMA_VERSION = 11;`
2. `tests-e2e/tech.spec.js` (~line 100): `schema_version: 11,`
3. `tests-e2e/cropsim.spec.js` (~line 41): `schema_version: 11,`
4. `tests-e2e/partial-failures.spec.js` (~line 6): `schema_version: 11,`
5. `src/lib/components/PageState.test.js` (~line 10): `schema_version: 11,`

(`src/lib/data.test.js` uses `schema_version: 1` without going through `loadMeta` validation — leave it alone.)

- [ ] **Step 4: Run the python suite**

Run: `python -m pytest tests/ -q`
Expected: all pass.

- [ ] **Step 5: Run the JS unit suite**

Run: `npm run test -- run`
Expected: all pass (mock bumps keep PageState/store tests green).

---

### Task 6: Education Party colour (TDD)

**Files:**
- Modify: `src/lib/faction-colors.test.js`
- Modify: `src/lib/faction-colors.js`

- [ ] **Step 1: Write the failing test**

In `src/lib/faction-colors.test.js`, inside the `describe('party colors', ...)` block, add:

```js
  it('pins the Education Party turquoise', () => {
    expect(partyColor('Education Party')).toBe('#1abc9c');
  });
```

Run: `npm run test -- run src/lib/faction-colors.test.js`
Expected: new test FAILS (returns null).

- [ ] **Step 2: Add the colour**

In `src/lib/faction-colors.js`, add to `PARTY_COLORS` (after the `'Novus Chrysalis Collective'` entry):

```js
  'Education Party': '#1abc9c',
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm run test -- run src/lib/faction-colors.test.js`
Expected: all pass.

---

### Task 7: Congress store (TDD)

**Files:**
- Modify: `src/lib/stores/error-reset.test.js`
- Create: `src/lib/stores/congress.js`

- [ ] **Step 1: Write the failing tests**

In `src/lib/stores/error-reset.test.js`, add the import below the gois import:

```js
import { congress, congressError, loadCongress } from './congress.js';
```

Append a new describe block at the end of the file:

```js
describe('congress store', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('retry after a failure clears the stale error', async () => {
    congress.set(null);
    congressError.set('congress.json fetch failed: 500');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        congress: { total_seats: 27, parties: [{ name: 'Education Party', seats: 2 }] },
        council: { total_seats: 15, parties: [] },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ));

    await loadCongress('2026-06-11T00:00:00Z');

    expect(get(congressError)).toBeNull();
    expect(get(congress)).toEqual({
      congress: { total_seats: 27, parties: [{ name: 'Education Party', seats: 2 }] },
      council: { total_seats: 15, parties: [] },
    });
  });

  test('missing congress.json resolves to the empty sentinel, not an error', async () => {
    congress.set(null);
    congressError.set(null);
    // Vite preview serves the SPA HTML fallback for absent JSON; fetchPage
    // treats text/html as null (CLAUDE.md gotcha 31).
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('<!doctype html><html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    ));

    await loadCongress('2026-06-11T00:00:00Z');

    expect(get(congress)).toEqual({
      congress: { total_seats: 0, parties: [] },
      council: { total_seats: 0, parties: [] },
    });
    expect(get(congressError)).toBeNull();
  });
});
```

Run: `npm run test -- run src/lib/stores/error-reset.test.js`
Expected: FAIL — `./congress.js` does not exist.

- [ ] **Step 2: Write the store**

Create `src/lib/stores/congress.js`:

```js
import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

const EMPTY_CHAMBER = { total_seats: 0, parties: [] };
const EMPTY_CONGRESS = {
  congress: EMPTY_CHAMBER,
  council: EMPTY_CHAMBER,
};

export const congress = writable(null);
export const congressError = writable(null);

function chamber(raw) {
  return {
    total_seats: raw?.total_seats ?? 0,
    parties: Array.isArray(raw?.parties) ? raw.parties : [],
  };
}

export async function loadCongress(syncedAt) {
  congressError.set(null);
  // Reset to the loading state so a Retry shows the loader, not the empty-state card.
  congress.set(null);
  try {
    const data = await fetchPage('congress', syncedAt);
    if (!data) {
      congress.set(EMPTY_CONGRESS);
      return;
    }
    congress.set({ congress: chamber(data.congress), council: chamber(data.council) });
  } catch (err) {
    congressError.set(err.message);
    congress.set(EMPTY_CONGRESS);
  }
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm run test -- run src/lib/stores/error-reset.test.js`
Expected: all pass.

---

### Task 8: SeatChamber component + CSS (TDD)

**Files:**
- Create: `src/lib/components/SeatChamber.test.js`
- Create: `src/lib/components/SeatChamber.svelte`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/components/SeatChamber.test.js`:

```js
import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import SeatChamber from './SeatChamber.svelte';

const chamber = {
  total_seats: 27,
  parties: [
    { name: 'Education Party', seats: 2 },
    { name: 'Lunar Survival League', seats: 8 },
    { name: 'Selenite Rose Front', seats: 7 },
    { name: 'Novus Chrysalis Collective', seats: 6 },
    { name: 'Independent', seats: 4 },
    { name: 'Non-aligned', seats: 0 },
  ],
};

describe('SeatChamber', () => {
  test('sorts party rows by seats descending', () => {
    const { container } = render(SeatChamber, { props: { chamber } });
    const names = [...container.querySelectorAll('.seat-row-name')].map((el) => el.textContent);
    expect(names).toEqual([
      'Lunar Survival League',
      'Selenite Rose Front',
      'Novus Chrysalis Collective',
      'Independent',
      'Education Party',
      'Non-aligned',
    ]);
  });

  test('mutes zero-seat parties and omits them from the strip', () => {
    const { container } = render(SeatChamber, { props: { chamber } });
    expect(container.querySelectorAll('.seat-row.muted')).toHaveLength(1);
    expect(container.querySelector('.seat-row.muted .seat-row-name')?.textContent).toBe('Non-aligned');
    expect(container.querySelectorAll('.seat-strip > i')).toHaveLength(5);
  });

  test('renders the total seats KPI and share percentages', () => {
    const { container } = render(SeatChamber, { props: { chamber } });
    expect(container.querySelector('.kpi-num')?.textContent).toBe('27');
    const shares = [...container.querySelectorAll('.seat-row-share')].map((el) => el.textContent);
    expect(shares[0]).toBe('30%'); // 8 / 27 → fmtPct default 0 digits
  });
});
```

Run: `npm run test -- run src/lib/components/SeatChamber.test.js`
Expected: FAIL — `./SeatChamber.svelte` does not exist.

- [ ] **Step 2: Write the component**

Create `src/lib/components/SeatChamber.svelte`:

```svelte
<script>
  // One legislative chamber: Total Seats KPI, stacked party-coloured seat
  // strip, then per-party rows sorted seats-desc. Zero-seat (but named)
  // parties render muted at the bottom and are omitted from the strip.
  import KpiBlock from './KpiBlock.svelte';
  import { partyColor } from '../faction-colors.js';
  import { fmtInt, fmtPct } from '../format.js';

  /** @type {{ total_seats: number, parties: Array<{name: string, seats: number | null}> }} */
  export let chamber;

  $: total = chamber?.total_seats ?? 0;
  $: sorted = [...(chamber?.parties ?? [])].sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0));
  $: seated = sorted.filter((p) => (p.seats ?? 0) > 0);
  $: stripLabel = seated.map((p) => `${p.name} ${fmtInt(p.seats)}`).join(', ');

  function color(name) {
    return partyColor(name) ?? 'var(--accent)';
  }
</script>

<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
  <KpiBlock label="Total Seats" value={fmtInt(total)} />
</div>

<div class="s-card s-card-pad">
  <div class="seat-strip" role="img" aria-label="Seat composition: {stripLabel}">
    {#each seated as p (p.name)}
      <i style="width: {((p.seats ?? 0) / Math.max(total, 1)) * 100}%; --seg-color: {color(p.name)}"></i>
    {/each}
  </div>
  <ul class="seat-rows">
    {#each sorted as p (p.name)}
      <li class="seat-row" class:muted={!((p.seats ?? 0) > 0)}>
        <span class="faction-bar" style="--bar-color: {color(p.name)}"></span>
        <span class="seat-row-name">{p.name}</span>
        <b class="tnum">{fmtInt(p.seats)}</b>
        <span class="seat-row-share tnum">{fmtPct(total > 0 && p.seats != null ? p.seats / total : null)}</span>
      </li>
    {/each}
  </ul>
</div>
```

- [ ] **Step 3: Add the CSS vocabulary**

In `src/styles/global.css`, append a new section (near the other component classes; all tokens used — `--border`, `--bg`, `--bg-2`, `--accent`, `--muted` — already exist in all three themes):

```css
/* ---- Congress seat composition (SeatChamber) ---- */
.seat-strip {
  display: flex;
  height: 22px;
  border: 2px solid var(--border);
  background: var(--bg-2);
  overflow: hidden;
}
.seat-strip > i {
  display: block;
  height: 100%;
  background: var(--seg-color, var(--accent));
}
.seat-strip > i + i {
  border-left: 2px solid var(--bg);
}
.seat-rows {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.seat-row {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  min-width: 0;
}
.seat-row-name {
  min-width: 0;
  overflow-wrap: anywhere;
}
.seat-row b {
  font-size: 15px;
}
.seat-row-share {
  color: var(--muted);
  font-size: 11px;
  min-width: 44px;
  text-align: right;
}
.seat-row.muted .seat-row-name,
.seat-row.muted b {
  color: var(--muted);
  font-weight: 400;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- run src/lib/components/SeatChamber.test.js`
Expected: 3 passed.

---

### Task 9: Route + nav + App wiring

**Files:**
- Create: `src/routes/Congress.svelte`
- Modify: `src/lib/components/NavBar.svelte` (ALL_PAGES)
- Modify: `src/App.svelte` (import + routes)

- [ ] **Step 1: Write the route**

Create `src/routes/Congress.svelte`:

```svelte
<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { congress, congressError, loadCongress } from '../lib/stores/congress.js';
  import { pageTitle } from '../lib/page-title.js';
  import Band from '../lib/components/Band.svelte';
  import PageState from '../lib/components/PageState.svelte';
  import SeatChamber from '../lib/components/SeatChamber.svelte';

  onMount(() => {
    pageTitle.set('Congress');
    if ($meta?.synced_at) loadCongress($meta.synced_at);
  });

  $: ready = $congress != null;
  $: empty = ready
    && $congress.congress.parties.length === 0
    && $congress.council.parties.length === 0;
</script>

<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px]">
  <PageState
    label="Congress"
    page="congress"
    error={$congressError}
    loading={!ready}
    loadingText="Counting delegates..."
    retry={() => loadCongress($meta.synced_at)}
  >
    {#if empty}
      <Band num="01" title="All-Worker Congress" />
      <div class="s-card s-card-pad">
        <p class="text-muted text-sm">
          Congress data is not yet wired up. Sync has not seen the
          <code>CongressPartySeats</code> and <code>CouncilSeatsByParty</code>
          named ranges.
        </p>
      </div>
    {:else}
      <Band num="01" title="All-Worker Congress" meta="Art. 15 — delegates apportioned to Trade Federations" />
      <SeatChamber chamber={$congress.congress} />

      <Band num="02" title="Celestial Council" meta="Art. 16 — Congress totals scaled to Council size" />
      <SeatChamber chamber={$congress.council} />
    {/if}
  </PageState>
</section>
```

- [ ] **Step 2: Add the nav entry**

In `src/lib/components/NavBar.svelte`, in `ALL_PAGES`, insert between the Parties and Senate entries:

```js
    { path: '/congress', label: 'Congress' },
```

- [ ] **Step 3: Register the route**

In `src/App.svelte`:

1. Add the import after `import Parties from './routes/Parties.svelte';`:

```js
  import Congress from './routes/Congress.svelte';
```

2. In the `routes` object, insert between `'/parties': Parties,` and `'/senate': Senate,`:

```js
    '/congress': Congress,
```

- [ ] **Step 4: Verify the app builds**

Run: `npm run build`
Expected: clean Vite build, no warnings about unresolved imports.

---

### Task 10: E2E coverage

**Files:**
- Create: `tests-e2e/congress.spec.js`
- Modify: `tests-e2e/a11y.spec.js` (PAGES)

- [ ] **Step 1: Write the spec**

Create `tests-e2e/congress.spec.js`:

```js
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const THEMES = ['light', 'dark', 'schematic'];

// public/data/congress.json may be absent until the first post-merge sync,
// and Vite preview serves the SPA HTML fallback for missing JSON paths.
// Mocking keeps these checks deterministic (same rationale as tech.spec.js).
const mockCongressPayload = {
  congress: {
    total_seats: 27,
    parties: [
      { name: 'Independent', seats: 4 },
      { name: 'Lunar Survival League', seats: 8 },
      { name: 'Novus Chrysalis Collective', seats: 6 },
      { name: 'Selenite Rose Front', seats: 7 },
      { name: 'Education Party', seats: 2 },
      { name: 'Non-aligned', seats: 0 },
    ],
  },
  council: {
    total_seats: 15,
    parties: [
      { name: 'Independent', seats: 2 },
      { name: 'Lunar Survival League', seats: 5 },
      { name: 'Novus Chrysalis Collective', seats: 3 },
      { name: 'Selenite Rose Front', seats: 4 },
      { name: 'Education Party', seats: 1 },
      { name: 'Non-aligned', seats: 0 },
    ],
  },
};

async function mockMeta(page, syncedAt) {
  await page.route('**/data/meta.json?*', async (route) => {
    await route.fulfill({
      json: {
        history_year: 2076,
        partial_failures: [],
        schema_version: 11,
        senate_visible: false,
        synced_at: syncedAt,
      },
    });
  });
}

async function mockCongressData(page, payload = mockCongressPayload) {
  await mockMeta(page, 'playwright-congress');
  await page.route('**/data/congress.json?*', async (route) => {
    await route.fulfill({ json: payload });
  });
}

async function gotoWithTheme(page, theme, path) {
  await page.addInitScript((t) => {
    localStorage.setItem('theme', t);
  }, theme);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

for (const theme of THEMES) {
  test(`Congress page renders both chambers (${theme})`, async ({ page }) => {
    await mockCongressData(page);
    await gotoWithTheme(page, theme, '/#/congress');

    await expect(page.getByRole('heading', { name: 'All-Worker Congress' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Celestial Council' })).toBeVisible();
    await expect(page.locator('.seat-strip')).toHaveCount(2);

    // Congress chamber sorts seats-desc: LSL leads with 8.
    const congressRows = page.locator('.seat-rows').first().locator('.seat-row');
    await expect(congressRows.first()).toContainText('Lunar Survival League');
    await expect(congressRows.first()).toContainText('8');

    // One muted zero-seat Non-aligned row per chamber.
    await expect(page.locator('.seat-row.muted')).toHaveCount(2);
  });

  test(`Congress page axe a11y (${theme})`, async ({ page }) => {
    await mockCongressData(page);
    await gotoWithTheme(page, theme, '/#/congress');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('Congress page shows the empty state when congress.json is absent', async ({ page }) => {
  await mockMeta(page, 'playwright-congress-empty');
  await page.route('**/data/congress.json?*', async (route) => {
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
  });
  await gotoWithTheme(page, 'schematic', '/#/congress');

  await expect(page.getByText(/Congress data is not yet wired up/)).toBeVisible();
  await expect(page.locator('code', { hasText: 'CongressPartySeats' })).toBeVisible();
});
```

- [ ] **Step 2: Add the route to the a11y sweep**

In `tests-e2e/a11y.spec.js`, change the PAGES array to include the new route (after `'/#/parties'`):

```js
const PAGES = ['/', '/#/map', '/#/demographics', '/#/cropsim', '/#/gois', '/#/tech', '/#/parties', '/#/congress', '/#/situations'];
```

(The a11y sweep runs against committed `public/data` where `congress.json` does not exist yet — the route renders its empty-state band, which is a legitimate axe target. No mock needed.)

- [ ] **Step 3: Run the new spec**

Run: `npx playwright test tests-e2e/congress.spec.js`
Expected: 7 passed (3 themes × 2 + empty state). The config builds + previews automatically.

- [ ] **Step 4: Run the congress slice of the a11y sweep**

Run: `npx playwright test tests-e2e/a11y.spec.js -g "congress"`
Expected: 6 passed (3 themes × 2 viewports).

---

### Task 11: Full verification

- [ ] **Step 1: Python suite**

Run: `python -m pytest tests/ -q`
Expected: all pass.

- [ ] **Step 2: JS unit suite**

Run: `npm run test -- run`
Expected: all pass.

- [ ] **Step 3: Full e2e suite**

Run: `npx playwright test`
Expected: all pass. (Two workers max per config; on Windows ignore late connection-refused noise after otherwise-green specs — gotcha 30.)

- [ ] **Step 4: Live-workbook sync smoke test**

This validates the real named ranges added to the live Sheet on 2026-06-11. From the `scripts/` directory:

```bash
cd scripts
python sync_sheet.py --sheet-id 1a602zL0X7HqUTpgr0lFxKfm5_tzDdQxbiv7Jw-hSoN0 --out-dir ../.tmp-sync-check
python -c "import json; d = json.load(open('../.tmp-sync-check/congress.json')); print(d['congress']['total_seats'], d['council']['total_seats'])"
cd ..
```

Expected output: `27 15` (live values as of 2026-06-11 — if the GM has run another turn, expect whatever the sheet now sums to; the point is both chambers parse). Then delete the scratch dir:

```bash
rm -rf .tmp-sync-check
```

---

### Task 12: CLAUDE.md + commit structuring

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

1. In the **Layout** section's `src/lib/components/` line, add `SeatChamber` to the route-specific composites list (after `SubFactionPanel`).
2. In **convention #12**'s class list, add: `` `.seat-strip` / `.seat-rows` / `.seat-row` (Congress seat composition — strip omits zero-seat parties, `.muted` rows keep them listed) ``.
3. Append a new numbered convention after the last one:

```markdown
NN. **Congress page reads three soft-optional named ranges on the `All-Worker Congress` sheet.** `CongressPartyNames` (B44:Q44), `CongressPartySeats` (B45:Q45), and `CouncilSeatsByParty` (B49:Q49) share one party-column axis: cols B–P mirror the Parties sheet's 15 slots, col Q is Non-aligned. `extractors/congress.py` pairs names/seats by column index, drops blank-name slots (convention #8), KEEPS named zero-seat entries (a shut-out party is information), and derives `total_seats` by summing — there is no scalar total range. All three ranges are soft-optional (`SOFT_OPTIONAL_V3_RANGES`): missing → empty chambers → `/#/congress` renders an empty-state band, sync never fails. The page is public (NOT Senate-gated); page key `congress` in the registry and `PageState`. `SeatChamber.svelte` renders each chamber; party colours resolve via `partyColor()` with `var(--accent)` fallback (Independent, Non-aligned). The richer constitution data (apportionment math, federation stance vectors, party-split matrices) is deliberately unsurfaced — see the spec's out-of-scope list before adding bands.
```

(Replace `NN` with the next free number.)

- [ ] **Step 2: Ask the user how to structure the commits**

Per the user's standing preference, do NOT commit autonomously. Present the changed-file list (spec, plan, backend, frontend, tests, CLAUDE.md) and ask whether they want one commit, or a backend/frontend split, then create the commit(s) as directed (ending with the Co-Authored-By trailer per project convention).

---

## Self-review notes

- **Spec coverage:** named ranges (already live — Task 11 smoke-tests them), extractor + JSON shape (Tasks 3, 5), soft-optional registration (Task 4), schema bump in lockstep incl. every mock meta (Task 5), store with error-reset + HTML-fallback invariants (Task 7), SeatChamber layout incl. muting and strip omission (Task 8), route/nav/empty state (Task 9), Education Party colour (Task 6), e2e + a11y route (Task 10), CLAUDE.md (Task 12). Out-of-scope items from the spec have no tasks — correct.
- **Type consistency:** `{total_seats: int, parties: [{name: str, seats: float|None}]}` is identical in extractor output, fixture expectations, store sentinel, component prop, and e2e mocks.
- **Known judgment calls:** seats serialize as floats (convention #7 coercion) — `fmtInt` renders them; chamber totals are `int(sum)`; `congress.set(null)` on load entry mirrors the cropsim Retry-shows-loader invariant.
