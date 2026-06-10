# Frontend Hardening: PageState, Sync-Failure Visibility, A11y Baseline, Visual Consistency

**Date:** 2026-06-09
**Status:** Approved (brainstorm with user)

## Context

The dashboard's nine routes each roll their own loading/error rendering: only Status,
Demographics, and Cropsim use the canonical `MoonLoader`; the other six show plain
"Loading…" text and dump raw error strings (`{$goisError}`) with no retry. The
`meta.partial_failures` channel (CLAUDE.md gotcha #6) has carried "this page failed to
sync" data since v1 but no UI consumes it. The app has no `<main>` landmark, no skip
link, no focus management on route change, and no `aria-current` on nav links. A
screenshot review (all routes × three themes × desktop/mobile) also surfaced four
visual-consistency defects, detailed in §4.

## Goals

1. One shared presentation for page loading / error / stale-sync states.
2. Players can tell when a page is serving data from an older sync.
3. Accessibility baseline: landmark, skip link, focus management, nav semantics, real headings.
4. Visual consistency: one numeric dialect for ratio KPIs, correct size hierarchy, no
   mid-value wraps, no dead rail columns.
5. Maintainability polish: shared number formatters, dead-code removal, doc corrections.

## Non-goals

- No backend/extractor/schema changes. `partial_failures` already exists; `schema_version` does not bump.
- No redesign of the crisis-breach treatment (deliberate, gotcha #53).
- No Tech-tree restructuring (long page is accepted; branches stay fully expanded).
- `/#/senate` stays URL-reachable when hidden. The privacy boundary is the *absence of
  senate.json* (route renders only the placeholder note), which holds. Conscious non-change.
- The `catalog` page key gets no stale banner — it is a global enrichment layer, not a route.

## 1. `PageState.svelte` (new, `src/lib/components/`)

A **presentational-only** wrapper. Routes keep their own stores, load calls, and derived
conditions — this is required because loading semantics differ per page (Demographics
joins three stores; Tech resolves a 404 to an empty sentinel; Cropsim borrows the status
store). The wrapper owns rendering, not data flow.

```svelte
<PageState label="GoIs" page="gois" error={$goisError}
           loading={!$gois} retry={() => loadGois($meta.synced_at)}>
  <!-- existing page content, unchanged -->
</PageState>
```

**Props:**

| Prop | Type | Meaning |
|---|---|---|
| `label` | string | Human page name. Used in error copy and rendered as an `sr-only` `<h1>`. |
| `page` | string \| string[] | Page key(s) checked against `$meta.partial_failures`. |
| `error` | string \| null | Page error message (from the route's error store(s)). |
| `loading` | boolean | Route-computed. When true (and no error), show `MoonLoader`. |
| `loadingText` | string (optional) | Flavor line under the loader. Default `"Loading…"`. Preserves "Reading vital signs…" etc. |
| `retry` | function (optional) | Renders a Retry button in the error state; calls this on click. |

**Render logic (priority order):**

1. `error` → `.s-card` with "Failed to load {label}", the error detail in muted small
   text, and a Retry button when `retry` is provided.
2. `loading` → centered `MoonLoader` (size ≈ 220) + `loadingText`, matching the existing
   Demographics loading block.
3. Otherwise → `<slot />`.

In **all** states, when any of `page`'s keys appears in `$meta.partial_failures`, a
stale banner renders first (above error/loader/content):

> ⚠ THIS PAGE FAILED TO SYNC — showing data from the last successful update

`role="status"`, warn-toned border (reuses the existing warn token treatment from
`.kpi-num.warn`), styled as a full-width strip consistent with `CrisisBanner`'s in-flow
placement but visually distinct (warn amber, not crisis red).

The `sr-only` `<h1>{label}</h1>` renders before everything so each page has exactly one
top-level heading.

**Empty states stay in routes** (YAGNI): Tech's "TechTable not named yet" card and
Senate's placeholder remain slot content. GoIs gains a small in-route "No GoIs recorded"
card when `$gois.gois.length === 0`.

**Store fix required for Retry:** every `loadX()` must clear its error store on entry
(`xError.set(null)`) — `senate.js` already does; the other stores don't, so a retry
would render the old error forever. One-line change per store.

**Route → page-key mapping:**

| Route | `page` prop |
|---|---|
| Status | `'status'` |
| Map | `'map'` |
| Demographics | `['demographics', 'pops', 'population']` |
| Cropsim | `['cropsim', 'status']` |
| GoIs | `'gois'` |
| Tech | `'tech'` |
| Parties | `['parties', 'pops']` |
| Senate | `'senate'` |
| Situations | `'situations'` |

(Key strings verified against the extractor registry in `sync_sheet.py:111-124` — `status`,
`population`, `pops`, `demographics`, `cropsim`, `gois`, `parties`, `map`, `catalog`,
`situations`, `tech`, with `senate` appended separately on its failure path.)

## 2. SyncChip warn state

`SyncChip.svelte` adds a third state. Priority: **stale** (synced_at > 3h, crit red,
unchanged) → **partial** (`$meta.partial_failures?.length > 0`, warn amber border/text,
`⚠` prefix before the label, `title` lists the failed page names) → normal.

If no Tailwind alias for the warn token exists, add one alongside the existing
`crit`/`good` aliases rather than inlining a CSS var.

## 3. A11y baseline

- **Skip link + landmark** (`App.svelte`): a visually-hidden-until-focused "Skip to
  content" link as the first focusable element, and the Router wrapped in
  `<main id="main" tabindex="-1">`. The skip link uses a click handler
  (`preventDefault()` + `focus()` on main) because a bare `href="#main"` would be
  hijacked by the hash router as a route change.
- **Route-change focus/scroll**: subscribe to `location`; on change (skipping the
  initial value) call `main.focus({ preventScroll: true })` then `window.scrollTo(0, 0)`.
  Initial page load must not have focus stolen.
- **`aria-current="page"`** on the active nav link in both the desktop list and the
  mobile menu (`NavBar.svelte`).
- **`Band.svelte`**: title `<span>` becomes `<h2 class="band-title">`. Tailwind preflight
  zeroes heading margins/sizes, so existing `.band-title` styles continue to apply;
  verify visually across themes. Heading tree per page becomes h1 (sr-only, PageState) →
  h2 (bands) → h3 (card headers). The axe run uses `wcag2a`/`wcag2aa` tags only, so
  `heading-order` (best-practice) is not at stake either way — this is a semantic win,
  not a test fix.

## 4. Visual design fixes (screenshot-verified)

### 4.1 One numeric dialect for ratio KPIs

0..1 ratio metrics render as percents everywhere, reusing
`src/lib/status-metrics.js:formatStatusPercent()` + `statusMetricTone()` (Status already
does this, gotcha #34):

- **Demographics · Avg Satisfaction**: `0.23` → `23%` (tone logic already wired; only
  the display changes).
- **Cropsim · Security Ratio**: `0.769` → `77%`; keeps Cropsim's domain `securityTone` thresholds (< 0.95 crit, < 1 warn, ≥ 1 good) — `statusMetricTone`'s generic 0.33/0.66 cutoffs would mistone food security.

Non-ratio decimals standardize precision instead of percent-ifying (they are not 0..1
shares): **Cropsim Food/Cap** `0.0099` → `0.01`, **Variety Index** `0.037` → `0.04` —
two decimal places via the shared formatter. CLAUDE.md gotcha #34 (which documents the
Avg Satisfaction decimal display) is updated in lockstep, as are
`status-metrics.test.js` expectations if touched.

### 4.2 Predicted Growth wrap

Demographics' Predicted Growth KPI renders `+554 / year` at headline scale, wrapping
mid-value at desktop widths. Fix: value `+554` (signed int), subtitle `per year` via
`KpiBlock`'s existing subtitle slot. Gotcha #49's example text referencing
`+241 / year` is updated to match.

### 4.3 Workforce band scale

Demographics' Workforce band stat values (`105,007`) render ~2× larger than the page's
headline KPIs (`99,163`), inverting the hierarchy. Fix: normalize the value size in
whatever renders those tiles (`WorkforceBand.svelte` / `.stat-tile .val` — locate during
planning) so secondary stats never exceed `.kpi-num` scale. Must not regress Status's
Resource Flows tiles (same `StatTile` component) — if they share the rule, aligning both
to KPI scale is acceptable and desirable.

### 4.4 GoIs rail empty state

The GoIs sub-faction rail, when nothing is selected, is a small hint card above ~1500px
of dead column. Adopt the Map inspector's empty-state pattern
(`.inspector-empty-head` / `-hints` / `-key`): what the rail does, how to open it
("click a sub-faction row"), Esc-to-clear hint. Optionally a compact GoI colour legend
(reusing `faction-colors.js`) to make the column useful at rest. No grid-layout change —
the column stays; only its resting content improves.

## 5. Polish

- **Cropsim padding**: `px-6 py-5` → `px-3 py-4 md:px-6 md:py-5` (mobile contract,
  gotcha #38).
- **Dead code**: delete `src/routes/EmptyPage.svelte` and its import in `App.svelte`.
- **`src/lib/format.js`** (new): `fmtInt`, `fmtSignedInt`, `fmtPct`, `fmtNum(n, digits)`
  — all return `'—'` for null/non-finite. Migrate the byte-identical copies in Tech,
  Status, Parties, Cropsim, GoIs, Senate; route-specific formatters (e.g. Map's
  truncate-not-round `formatYieldValue`, gotcha #36) stay local.
- **CLAUDE.md updates**: gotcha #6 (partial_failures UI now implemented — describe it),
  gotcha #14 (stale: MoonLoader *does* redraw on theme flips via its reactive
  `currentTheme` draw), gotcha #34 (Avg Satisfaction now percent), gotcha #49 (example
  text), new convention entry for PageState.

## 6. Testing

**Vitest:**
- `PageState.test.js` — error state (message + retry callback fires), loading state
  (MoonLoader present), stale banner shown/hidden by `partial_failures` for string and
  array `page` props, sr-only h1.
- `format.test.js` — all helpers incl. null/NaN → `'—'`.
- SyncChip partial-state rendering (warn class, ⚠ prefix, stale-beats-partial priority).
- Updated `Status.test.js` / `KpiBlock.test.js` / `ClassDetail.test.js` expectations
  where formatting changed.

**Playwright:**
- New `partial-failures.spec.js`: mock `meta.json` with `partial_failures: ['gois']` →
  banner visible on `/#/gois`, warn chip in nav, no banner on `/#/parties`.
- Existing suites (a11y ×38, mobile-flow, map, map-zoom, tech, cropsim) must stay green.
  The skip link and stale banner must not introduce axe violations in any theme.

## 7. Risks

- **Focus management regressions**: stealing focus on initial load, or fighting the
  Map page's own focus handling — mitigated by skipping the initial `location` value
  and using `preventScroll`.
- **`Band` h2 styling drift** across the three themes — mitigated by visual check per
  theme (axe won't catch layout drift).
- **StatTile scale change** touches Status as well as Demographics — screenshot both
  before/after.
- **Percent rendering changes player-visible semantics** on two KPIs — approved
  explicitly in brainstorm; CLAUDE.md and tests updated in lockstep.
