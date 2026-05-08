# Pops → Demographics merge with per-class drilldown

**Date:** 2026-05-08
**Status:** Draft (awaiting user review)
**Schema bump:** none
**Supersedes:** band ordering established in
[2026-05-06-demographics-page-and-status-vitals-design.md](2026-05-06-demographics-page-and-status-vitals-design.md)
and [2026-05-06-demographics-workforce-rework-design.md](2026-05-06-demographics-workforce-rework-design.md).

## Context

The standalone `/pops` page exposes per-class income, status, and
workforce drilldowns separated from `/demographics`, where the same
classes already appear in the Class Vitals table. Players currently
have to leave one page to inspect a class they just spotted on the
other. The Living Standards bars on `/pops` (SoL out of 5, Expected
SoL out of 5, Privilege out of 1) are also visually misleading —
the max=5 bars don't communicate a meaningful target.

This spec folds Pops into Demographics by making each Class Vitals
row a click target that pins a per-class detail band beneath the
table, and removes the standalone route. The Living Standards bars
become a small key-value list.

## Goals

- One landing page (`/demographics`) for every population view —
  colony totals, class table, per-class drilldown, workforce, housing,
  food.
- Click any class row to inspect that class without losing the
  table or page-level context.
- Replace the misleading Living Standards bars with a plain
  numeric readout (values still visible to anyone curious).
- Remove the standalone `/pops` route + nav link without breaking
  any data path or test.

## Non-goals

- No backend, extractor, or schema-version change. `pops.json` shape
  is untouched.
- No new metrics or history fields.
- No `/pops` redirect or alias — direct hits land on NotFound.
- No layout change to any other route.
- No theme or CSS-token additions; existing `.s-card` / `.kv` /
  `.bar` / `.faction-bar` cover the new component.

## Architecture overview

```
src/
├─ App.svelte                            ← drop /pops route + Pops import
├─ lib/components/
│   ├─ NavBar.svelte                     ← drop /pops entry from ALL_PAGES
│   └─ ClassDetail.svelte                ← NEW (per-class card grid)
├─ routes/
│   ├─ Pops.svelte                       ← DELETED
│   └─ Demographics.svelte               ← +selected state, +row handlers,
│                                          +ClassDetail band, +Esc handler
└─ (no changes to stores, data.js, or styles/global.css)

docs/
└─ superpowers/specs/
    └─ 2026-05-08-pops-into-demographics-design.md   ← this file

CLAUDE.md
└─ Layout / gotcha #16 updated to reflect new band order
```

No JSON, no Python, no schema validator, no GitHub Action touched.

## Detailed design

### Page structure

Visible band order on `/demographics`:

```
01  Pop Dynamics                  (existing, unchanged)
02  Class Vitals                  (existing — rows become clickable)
··  {className} · Detail          (NEW, conditional, UNNUMBERED)
03  Workforce                     (existing WorkforceBand, bandNum unchanged)
04  Housing                       (existing, unchanged)
05  Food Security                 (existing, unchanged)
```

The detail band is intentionally **unnumbered** (`Band` already
supports omitting `num`). This avoids renumbering the three
downstream bands every time the user toggles a row, and visually
flags the band as a drilldown overlay rather than part of the
canonical sequence. Title format: `{cls.name} · Detail`. Meta:
`per-class drilldown`.

### ClassDetail.svelte

**Location:** `src/lib/components/ClassDetail.svelte`

**Props:**
- `cls` — the selected class object from `$pops.classes`. Required.

**Emits:** none. Read-only view.

**Layout:** `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3`,
six cards in this order:

1. **Living Standards** — `<dl class="kv">` with three rows:
   - SoL (`cls.standard_of_living`, two-decimal)
   - Expected (`cls.expected_sol`, two-decimal)
   - Privilege (`cls.social_privileges`, formatted as `xx%` —
     value × 100, zero decimal)
   - Bars are gone.

2. **Income · per cap** — KV: Gross, Income tax, Wealth tax,
   Effective rate (as %), Disposable. Identical to current Pops.

3. **Income · totals** — KV: Pre-tax, Post-tax, Class wealth,
   Wealth/cap. Identical to current Pops.

4. **Additional Income** — KV: Welfare, Dividends, Subsidies,
   Other, **Total** (bold). Identical to current Pops.

5. **Status** — `Bar` rows in a 2-col layout, identical to current
   Pops (col 1: Radicalisation, Abject Poverty, Organisation;
   col 2: Education, Vote Share). Card border switches to
   `var(--crit)` and a `⚠ Radicalised` Tag is shown when
   `radicalisation > 0.5` — preserves existing critical-state
   treatment.

6. **Workforce** — Supply/Demand KV plus Fill Ratio + Unemployment
   bars. Identical to current Pops. The Class Vitals table already
   shows raw Demand and Unemployed *count*; this card adds Supply
   and the Unemployment *rate* visualised as a bar.

The component is read-only: it consumes `cls` and renders. No store
subscriptions, no events. Demographics.svelte owns the selection.

### Demographics.svelte changes

**New script-level state:**

```js
let selected = null; // class name string | null

$: current = selected
  ? $pops?.classes.find((c) => c.name === selected) ?? null
  : null;

// Reactive guard: clear stale selection if the class disappears across a sync.
$: if (selected && $pops && !$pops.classes.some((c) => c.name === selected)) {
  selected = null;
}

function toggleSelected(name) {
  selected = selected === name ? null : name;
}

function handleKeydown(e) {
  if (e.key === 'Escape' && selected != null) {
    selected = null;
  }
}
```

A `<svelte:window on:keydown={handleKeydown} />` is added so Esc
collapses the detail band from anywhere on the page when one is
open.

**Class Vitals table:** each `<tr>` becomes a button-row:

```svelte
<tr
  role="button"
  tabindex="0"
  aria-pressed={selected === c.name}
  on:click={() => toggleSelected(c.name)}
  on:keydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleSelected(c.name);
    }
  }}
  class:selected-row={selected === c.name}
>
  …existing cells…
</tr>
```

The selected row gets a `.selected-row` class which renders a
left-bar accent in `classColor(c.name)` and a soft row-tint via
`background: var(--accent-soft)`, plus a 1px inset outline
(`outline-offset: -1px`) in `var(--accent)` so the selection state
is visible at all times. Keyboard focus on any row gets a thicker
2px inset outline via `tr[role='button']:focus-visible`, so
keyboard users can see the active row after Tab. Both styles
defined locally in the route's `<style>` block — no global CSS
additions.

**Detail band rendering** (between Class Vitals and WorkforceBand):

```svelte
{#if current}
  <Band title="{current.name} · Detail" meta="per-class drilldown" />
  <div aria-live="polite">
    <ClassDetail cls={current} />
  </div>
{/if}
<WorkforceBand bandNum="03" />
```

The `aria-live="polite"` wrapper announces the class name to
assistive tech when the band appears. After mounting, the wrapper
calls `scrollIntoView({ block: 'nearest', behavior: 'smooth' })`
so opening a row below the fold pulls the detail band into view
without yanking already-visible content.

### Removals

- `src/routes/Pops.svelte` — file deleted.
- `src/App.svelte` — drop `import Pops from './routes/Pops.svelte';`
  and the `'/pops': Pops,` entry from `routes`.
- `src/lib/components/NavBar.svelte` — drop the
  `{ path: '/pops', label: 'Pops' }` entry from `ALL_PAGES`.
- `src/lib/stores/pops.js` and `pops.json` are **kept untouched** —
  Demographics still loads pops data for the table and the detail.

Direct hits to `/pops` after the merge land on `NotFound`. No
redirect, no alias.

### Documentation updates

- `CLAUDE.md` Layout section: add `ClassDetail` to the components
  list. It's a route-specific composite (sibling to `WorkforceBand`,
  not a Mission-Brutalist primitive) — group it accordingly.
- `CLAUDE.md` gotcha #16: rewrite as
  *"Demographics band ordering. 01 Pop Dynamics → 02 Class Vitals →
  (Class Detail · unnumbered, conditional on row click) → 03 Workforce
  → 04 Housing → 05 Food Security. The detail band is rendered by
  `ClassDetail.svelte` and is gated on a row click in the Class Vitals
  table; it is deliberately unnumbered to avoid renumbering downstream
  bands."*
- The two prior demographics specs stay as historical context; this
  spec's "Supersedes" header points back at them.

## Accessibility

- Each Class Vitals row exposes `role="button"`, `tabindex="0"`,
  `aria-pressed`, and Enter/Space handlers — keyboard parity with
  click.
- Selected row carries `aria-pressed="true"`; the accent bar is
  cosmetic and uses the existing `.faction-bar` token already
  present in the row.
- Detail band wraps in `aria-live="polite"` so screen readers
  announce the new content. The Band title heading is the first
  focusable text inside; we don't auto-shift focus, the live region
  is sufficient and avoids stealing focus mid-keyboard-nav.
- Esc collapses; existing focus on the row is preserved by the
  browser since we don't blur on toggle.
- Existing `tests-e2e/a11y.spec.js` axe pass already covers
  Demographics; one new interactive case extends it to cover
  the post-click state (see Tests).

## Testing

**Unit / pytest:** unaffected. No extractor or fixture change.

**E2E (Playwright + axe), `tests-e2e/a11y.spec.js`:**

- Drop `/pops` from the iterated route list.
- Add an interactive case for `/demographics`:
  1. Load the page, wait for `pops.json` and `demographics.json`.
  2. Click the first row in `.tbl tbody`.
  3. Assert a region with `aria-live="polite"` exists and contains
     a heading matching the clicked class name.
  4. Run axe on the post-click DOM; assert no violations.
  5. Press `Escape`; assert the live region is gone.

**Manual smoke:** dev-server check across all three themes (cosmic,
calm, schematic) for visual sanity, plus keyboard-only nav (Tab to
row → Enter → Esc) and clicking the same row twice (toggles off).

## Edge cases

- **Empty `$pops.classes`:** table renders nothing; detail can't
  open. No regression — same as today.
- **Single class:** click toggles detail open / closed; no auto-select.
- **Sync mid-interaction:** the reactive guard in Demographics clears
  `selected` if the named class disappears across a refresh.
- **Mobile / narrow viewport:** ClassDetail's grid utility collapses
  to one column at the existing `md:` breakpoint; the Class Vitals
  table scrolls horizontally as it does today; Esc still collapses.
- **Critical radicalisation state:** preserved — Status card border
  and the warning Tag both still fire from `radicalisation > 0.5`.
- **Old `/pops` bookmarks:** land on `NotFound`. Acceptable per
  brainstorming.

## Out of scope

- No backend changes (extractors, schema validator, GitHub Action,
  history snapshots).
- No new metrics, sparklines, or `KpiBlock` additions.
- No layout, palette, or theme-token changes.
- No `/pops` redirect or alias.
- No fixture-drift fixes (gotcha #10 in CLAUDE.md remains).

## Implementation order (for the plan)

A single small slice; can land in one PR:

1. Add `ClassDetail.svelte` (with all six cards).
2. Wire `Demographics.svelte` (state, row handlers, detail band, Esc).
3. Delete `Pops.svelte`, drop the route + nav entry.
4. Update CLAUDE.md (Layout list + gotcha #16).
5. Update `tests-e2e/a11y.spec.js` (drop /pops, add interactive case).
6. Manual smoke across themes + keyboard.
