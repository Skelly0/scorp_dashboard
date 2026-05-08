# Sub-Faction Detail Drilldown — Design

**Date:** 2026-05-07
**Status:** Approved (pending implementation plan)
**Affected page:** `/gois` (`src/routes/GoIs.svelte`)
**Schema bump:** `4 → 5`

## 1. Motivation

The GoIs page currently renders sub-factions as a one-line summary inside each Group of Interest card: *name · within-GoI influence% · approval%*. The live workbook tracks substantially richer information per sub-faction — a goal text, a per-axis effective worldview (6-axis stance derived from the parent GoI's main-class baseline plus the faction's goal Δ), and a renormalized cross-GoI national share — none of which surfaces in the dashboard today.

This spec adds a **side-rail drilldown panel** on the GoIs page that lets the player select any sub-faction and inspect its goal, its 6-axis worldview overlaid against its parent GoI's worldview, and its three primary stats (within-GoI influence, national share, approval).

## 2. Scope

**In scope:**
- Extend `extractors/gois.py` to read three new named ranges: `SubFactionGoal`, `SubFactionNationalShare`, `SubFactionDetail`.
- Enrich the per-sub-faction JSON record in `gois.json` with `goal`, `national_share`, and `effective_worldview` fields.
- Add a sticky side-rail drilldown panel on the GoIs page, with a docked bottom-sheet fallback on narrow viewports.
- Add an optional `overlay` capability to `RadarChart.svelte` so the rail can render the parent GoI's worldview as a faint ghost behind the sub-faction's stance.
- Bump `SCHEMA_VERSION` from 4 to 5 in lockstep.

**Out of scope:**
- Minor goals (`SubFactionMinorGoals`) — already in JSON, not surfaced in the new UI.
- Goal axis (col C) and goal Δ (col D) — read but not rendered; the radar visualises the mechanical effect implicitly.
- Promoting sub-factions to a top-level page (`/sub-factions`) — explicitly rejected during brainstorming in favour of contextual drilldown.
- URL-routed selection state (deep-linkable sub-factions) — over-engineering for an exploratory click-around feature.

## 3. Data layer

### 3.1 New named ranges

The live workbook must expose three named ranges (the user has confirmed `SubFactionGoal` and `SubFactionDetail` exist; `SubFactionNationalShare` already exists per backend CLAUDE.md):

| Name                       | Source                                  | Shape                          | Purpose                                                                 |
|----------------------------|-----------------------------------------|--------------------------------|-------------------------------------------------------------------------|
| `SubFactionGoal`           | `Sub-Factions` col E                    | 1-col of strings               | Per-faction goal text (was previously the "description" column).        |
| `SubFactionNationalShare`  | `Sub-Factions` col L                    | 1-col of floats                | Renormalized cross-GoI weight; live values sum to 1.0.                  |
| `SubFactionDetail`         | `Sub-Faction Detail` sheet (full block) | N-row × 16-col block           | Derived per-faction view; cols F-K hold the 6-axis effective stance.    |

All three are **soft-optional** (gotcha #14): the extractor reads them via `read_named_range()` / `scalar_named()` and tolerates absence by emitting `None` per row. The dashboard renders missing values as `—`, so the page degrades gracefully if a workbook predates these names.

**Row alignment — defensive zip required.** The existing `_sub_factions_by_goi()` helper iterates `SubFactionGoals` (cols A-E of `Sub-Factions`) row-by-row. The new `SubFactionNationalShare` (col L of the same sheet) is safe to zip by row index — it's a parallel column on the same sheet, written by the same backend code. **`SubFactionDetail`, however, lives on a separate sheet** and the spec assumes row-N alignment based on a backend invariant (both blocks emitted from the same `GOI_TABLE` iteration). Since this assumption can silently break if a row is inserted on either sheet, the extractor MUST zip `SubFactionDetail` rows to sub-factions by **`(GoI, Sub-faction)` name pair** (cols A and B of the Detail block) rather than positional index. If a row in `SubFactionDetail` doesn't match any `(goi, name)` pair from `SubFactionGoals`, log a warning and emit `effective_worldview: None` for that faction; do not raise.

**Note on count:** there are exactly **12** live sub-factions across the 4 live GoIs (3 each). The named ranges may cover 12 or 13 rows depending on whether the workbook reserves a trailing blank slot — the extractor reads via name and filters rows where the GoI cell is blank, so either is fine. The new `SubFactionGoal`, `SubFactionNationalShare`, and `SubFactionDetail` ranges must align row-for-row with the existing `SubFactionGoals` range (cols A-E of Sub-Factions); zipping is by row index.

### 3.2 Column slicing for `SubFactionDetail`

The `SubFactionDetail` named range covers all 16 columns of the Sub-Faction Detail sheet (per the user's confirmation). The extractor slices columns by index:

| Index | Column | Contents                |
|-------|--------|-------------------------|
| 0     | A      | GoI                     |
| 1     | B      | Sub-faction             |
| 2     | C      | Influence               |
| 3     | D      | Goal Axis               |
| 4     | E      | Goal Δ                  |
| 5     | F      | Expansion (effective)   |
| 6     | G      | Authority (effective)   |
| 7     | H      | Corporate (effective)   |
| 8     | I      | Technocratic (effective)|
| 9     | J      | Faith (effective)       |
| 10    | K      | Materialist (effective) |
| 11    | L      | Approval                |
| 12-14 | M-O    | Minor Goals (3)         |
| 15    | P      | National Share          |

The extractor only consumes indices **5–10** (the per-axis effective stance) for this work, plus indices **0–1** (GoI, Sub-faction) for the name-pair zip. Indices **11** (Approval) and **15** (National Share) on the Detail sheet are formula mirrors of `SubFactionApprovals` (col J of Sub-Factions) and `SubFactionNationalShare` (col L of Sub-Factions); the extractor MUST treat the Sub-Factions ranges as authoritative and ignore the Detail-sheet mirrors. This keeps a single source-of-truth even if the two sheets ever drift.

### 3.3 JSON shape change in `gois.json`

Per-sub-faction record gains three keys; existing keys unchanged:

```json
{
  "name": "Statebuilders",
  "influence": 0.25,
  "approval": 0.366,
  "minor_goals": [],
  "goal": "Strengthen the rule of law through codified procedure...",
  "national_share": 0.0545,
  "effective_worldview": {
    "expansion": 4.5,
    "authority": 6.0,
    "corporate": 4.0,
    "technocratic": 4.5,
    "faith": 4.5,
    "materialist": 5.5
  }
}
```

All three new fields are nullable. `effective_worldview` may be `null` (the entire object) when the `SubFactionDetail` range is missing, *or* may have null values for individual axes when slicing returns blank cells.

### 3.4 Schema version

- `SCHEMA_VERSION` in `scripts/sync_sheet.py`: **4 → 5**
- `EXPECTED_SCHEMA_VERSION` in `src/lib/stores/meta.js`: **4 → 5**

Mismatch surfaces the existing maintenance banner — the dashboard is already wired for this.

### 3.5 Validator changes

The validator (`scripts/validate_schema.py`) only enforces `BASE_REQUIRED_RANGES` (and `SENATE_REQUIRED_RANGES` when applicable); `SOFT_OPTIONAL_V3_RANGES` is a **documentation-only list** that does not gate sync. The actual graceful-degradation behaviour comes from the extractor calling `read_named_range()` / `scalar_named()`, both of which return empty/`None` when a name is missing.

For this work:
- Add `SubFactionGoal`, `SubFactionNationalShare`, and `SubFactionDetail` to `SOFT_OPTIONAL_V3_RANGES` (documentation).
- Do NOT add them to `BASE_REQUIRED_RANGES` — that would break sync for any workbook that predates the new names.
- Ensure the extractor uses `read_named_range()` for these three so absence is tolerated.

## 4. Frontend layout

### 4.1 Page restructure

`GoIs.svelte` adopts a two-track layout at the page-grid level:

- **≥1280px viewport:** the page becomes `grid-template-columns: 1fr 360px` with a small column gap. The existing GoI cards grid + Pop Capture matrix occupy the left 1fr column; the rail occupies the right 360px column. The page wrapper's existing `max-w-[1600px]` cap means the left column is at most ~1220px wide. The GoI cards inside the left column **stay in their existing responsive grid** (1-col on narrow, 2-col at `lg:`); the implementation may need to re-tune the inner `grid-cols-[170px_1fr]` ratio if cards feel cramped at intermediate widths around 1200–1280px. If problems show up during implementation, raising the rail breakpoint from 1280 to 1440 is acceptable — not a spec-level decision.
- **<1280px viewport:** the page reverts to single-column. The rail is hidden in document flow and a bottom-docked sheet rises into view when a sub-faction is selected.

**Sticky behavior (desktop):** the rail wrapper uses `position: sticky` with a `top` offset matching the rendered nav height. There is currently no shared `--nav-h` CSS variable in `global.css`; implementation should either (a) introduce one and reuse it on the nav itself, or (b) measure the nav height once and hard-code a value confirmed against actual render. Do NOT pick a magic number (e.g. `60px`) without first verifying.

### 4.2 Selection state

Component-local Svelte state in `GoIs.svelte`:

```js
let selected = null; // { goi: <name>, sf: <name> } | null
```

- Click a sub-faction row → set `selected = { goi, sf }`.
- Click the same row → set `selected = null`.
- Click a different row → swap.
- Press `Esc` → set `selected = null`.

No store. No URL state. No persistence across navigation away from the page.

The panel resolves the selected sub-faction by lookup: `gois.find(g => g.name === selected.goi)?.sub_factions.find(s => s.name === selected.sf)`. The parent GoI is derived from the same lookup so the panel can render the parent's `effective_worldview` for the radar overlay.

**Where the lookup lives:** in a `$:` reactive in the script block of `GoIs.svelte` (e.g. `$: selectedSf = ...; $: selectedParent = ...`), NOT inline via `{@const}` inside the template. Per gotcha #7, `{@const}` placement is restricted in Svelte 4 — using `$:` reactives keeps the derivation legal and reusable across both the desktop rail and mobile sheet markup.

**Stale selection on data refresh.** The page re-fetches `gois.json` on every mount and on `meta.synced_at` change. If a sync arrives while a sub-faction is selected and that sub-faction (or its parent GoI) has been renamed/removed, the lookup yields `undefined`. Behaviour: when either `selectedSf` or `selectedParent` resolves to `undefined`, dismiss the selection (`selected = null`); the rail returns to its empty state. Do not show a stale or partial panel.

### 4.3 Selected-row highlight

Active row in the GoI card list:
- 2px left border in the parent GoI's accent colour (reuse `goiColor()`).
- Slight background tint (`background-color: var(--accent-soft)`).
- Other rows stay neutral; only one row across all GoI cards is highlighted at a time.

### 4.4 Empty state of the rail

- **Desktop ≥1280:** rail is always visible. When `selected === null`, content is a centred placeholder: small icon + dim italic text *"Select a sub-faction to inspect"*.
- **Mobile <1280:** the bottom sheet is hidden entirely (`display: none`) until first selection.

### 4.5 Closing behaviour

- **Desktop:**
  - Click the active row again.
  - Click the ✕ button in the panel header.
  - Press `Esc`.
- **Mobile:**
  - Tap ✕.
  - Tap the dimmed area outside the sheet.
  - Press `Esc`.

A future enhancement could add swipe-to-dismiss on mobile, but that's not in this spec's scope.

## 5. Panel content

The rail panel renders top-to-bottom:

```
┌─ rail panel ─────────────────────┐
│  ◀ STATEBUILDERS              ✕  │  name (uppercase, bold; ◀ = parent accent bar)
│  Administration                  │  parent GoI label, dim, small caps
├──────────────────────────────────┤
│  GOAL                            │  section label
│  "Strengthen the rule of law…"   │  italic body, max-width 32ch
├──────────────────────────────────┤
│        ╱──╲                      │
│       ╱    ╲                     │  6-axis radar, ~200px
│      ╱  ▲▲  ╲                    │  primary line = sub-faction stance
│       ╲   ╱                      │  faint dashed overlay = parent GoI worldview
│        ╲ ╱                       │
├──────────────────────────────────┤
│  INFLUENCE   NAT.SHARE  APPROVAL │
│  25%         5.4%       37%      │  three KPI tiles, equal-width row
└──────────────────────────────────┘
```

### 5.1 Header

- Sub-faction name uppercase, bold, font-size matching existing `.s-card-header h3`.
- 4px left bar (`.faction-bar` or equivalent) using the parent GoI's accent colour — same colour cue used on the GoI cards, so the visual link to the originating card is preserved.
- Parent GoI name on a second line, dim (`text-muted`), `font-size: 11px`, `letter-spacing: widest`.
- ✕ close button at top-right; 32px hit target; `aria-label="Close sub-faction detail"`.

### 5.2 Goal block

- Section heading `GOAL` in the standard `text-muted text-[9px] uppercase tracking-widest` style used elsewhere on the page.
- Body: italicised paragraph rendering `goal` text. Wraps freely. No max line clamp — the goal text is normally 1–3 sentences.
- When `goal` is null/empty: render dim italic placeholder *"No goal recorded"*.

### 5.3 Radar (with parent overlay)

Reuses `RadarChart.svelte` with a **new optional `overlay` prop**:

```svelte
<RadarChart
  axes={[{label: 'expansion', value: 4.5}, ...]}
  overlay={[{label: 'expansion', value: 4.0}, ...]}
  size={200}
/>
```

- Primary line: sub-faction's `effective_worldview` — solid stroke + fill, using the existing `--accent` token (unchanged from today's solo radar styling).
- Overlay line: parent GoI's `effective_worldview` — faint dashed stroke (`stroke-dasharray: 3 2`), no fill, ~40% opacity. Renders *behind* the primary line. Uses a **new theme token `--radar-overlay`** defined on `:root[data-theme=…]` for all three themes (light, dark, schematic) per gotcha #12. The token must contrast with both `--accent` AND `--bg-2` in every theme — particularly schematic, where `--accent` is navy and a generic muted blue would collide. Suggested values: a desaturated complement of `--accent` (e.g. warm gray on schematic, cool gray on light, dim white on dark). Implementation should test legibility in all three themes before merging.
- When `overlay` prop is omitted (legacy callers — the GoI cards), the component renders identically to today.

When `effective_worldview` is null on the sub-faction:
- Render the radar with overlay-only and a small dim caption *"per-faction stance unavailable"* below it.
- If both sub-faction and parent worldviews are null: hide the radar block entirely; the panel still shows header, goal, and KPIs.

### 5.4 KPI row

Three equal-width tiles in a flex row at the bottom of the panel:

| Label        | Source field         | Format                                |
|--------------|----------------------|---------------------------------------|
| INFLUENCE    | `influence`          | `Math.round(v * 100)%` ; `—` if null  |
| NAT.SHARE    | `national_share`     | `Math.round(v * 1000) / 10 + '%'` (one decimal — values are typically ~5–10%) ; `—` if null |
| APPROVAL     | `approval`           | `Math.round(v * 100)%` ; `—` if null  |

Reuse the existing `.kpi-block` styling — small uppercase label, large `tnum` numeric value. The per-GoI cards on `GoIs.svelte` do NOT currently tint their Approval tile; this spec does not introduce tinting either. All three KPI tiles render with the standard neutral tile styling. (If we later want approval tinting, that's a separate, page-wide change.)

**Decimal consistency note:** INFLUENCE and APPROVAL render to the nearest integer percent; NAT.SHARE renders to one decimal because cross-GoI shares are typically in the 5–15% range and the extra precision distinguishes neighbouring factions. The asymmetry is intentional. Use `tabular-nums` (`tnum`) so the differing decimal counts don't jitter when the panel switches sub-factions.

## 6. Component decomposition

### 6.1 New: `SubFactionPanel.svelte`

Located at `src/lib/components/SubFactionPanel.svelte`.

**Props:**
- `subfaction` — the full sub-faction record (or `null` for empty state).
- `parent` — the parent GoI record (for accent colour + overlay worldview).
- `onClose` — callback fired when the user clicks ✕ or presses Esc.

**Renders:** the entire content described in §5. Pure presentational; no data fetching.

**ARIA:**
- Outer wrapper: `role="region"` `aria-label="Sub-faction detail"`.
- Close button: `aria-label="Close sub-faction detail"`.
- When `subfaction === null`, the panel renders the empty-state placeholder; the ✕ button is omitted.

### 6.2 Modified: `RadarChart.svelte`

Add an optional `overlay` prop (array of `{label, value}` objects, same shape as `axes`).

- When present: render a second polygon at lower opacity with a dashed stroke.
- When absent: behaves identically to today.

The overlay uses the same axis order as the primary `axes` prop; the component does not re-derive ordering. Callers are responsible for passing the same axis sequence.

**Defensive assertion:** if `overlay` is provided and `overlay.length !== axes.length`, log a `console.warn` (e.g. `[RadarChart] overlay/axes length mismatch — overlay ignored`) and skip rendering the overlay. This catches silent caller misuse during development without crashing the page in production. Likewise, if `overlay[i].label !== axes[i].label` for any i, warn and skip — order-misalignment would produce a plausible-looking but mathematically wrong polygon.

### 6.3 Modified: `GoIs.svelte`

- Page-grid restructure (§4.1).
- `selected` state + click handlers on each sub-faction row (§4.2).
- Selected-row visual highlight (§4.3).
- Render `<SubFactionPanel>` in both rail (desktop) and bottom-sheet (mobile) wrappers; the sheet wrapper is gated on `selected !== null` and viewport width.
- `Esc` key handler at the page level dismisses the selection.

Sub-faction rows in the GoI cards become `<button>` elements (semantic, keyboard-focusable) styled to look like the current `<li>` rows. They get `aria-pressed={isSelected}` and a visible focus ring.

### 6.4 New CSS in `global.css`

- `.s-rail` — desktop sticky rail wrapper (sticky, padded, `--bg-2` panel background, themed border).
- `.s-rail-empty` — placeholder centring + dim styling for the unselected state.
- `.s-sheet` — mobile bottom-docked sheet (fixed position, slide-up animation, dim backdrop, max-height 80vh, scrollable interior).
- All three theme variables (`light`, `dark`, `schematic`) must define the colours these classes use — gotcha #12 invariant.

## 7. Edge cases & failure modes

| Condition                                      | Behaviour                                                    |
|------------------------------------------------|--------------------------------------------------------------|
| `goal` missing or empty                         | Dim italic placeholder *"No goal recorded"*                  |
| `national_share` null                           | KPI tile shows `—`                                            |
| Sub-faction's `effective_worldview` null        | Radar shows overlay-only with caption                         |
| Both sub-faction AND parent worldviews null     | Radar block hidden entirely                                   |
| `SubFactionDetail` range absent in workbook     | All sub-factions get `effective_worldview: null`; behaviour as previous row |
| `SubFactionGoal` range absent                   | All sub-factions get `goal: null`; placeholder text shown     |
| `SubFactionNationalShare` range absent          | All sub-factions get `national_share: null`; KPI shows `—`    |
| Selected sub-faction not found after data refresh (sync renamed/removed it) | Lookup yields `undefined`; auto-dismiss selection (`selected = null`) so the rail returns to its empty state — no stale or partial panel |
| Selected parent GoI not found after data refresh (sync renamed/removed the GoI itself) | Same as above — auto-dismiss selection |
| Workbook with old schema (`schema_version < 5`)  | Existing maintenance banner triggers via `meta.js` lockstep mismatch |

## 8. Testing

### 8.1 Unit (pytest)

`tests/extractors/test_gois.py`:
- New test: `test_extract_includes_subfaction_goal` — fixture has `SubFactionGoal` populated; assert each sub-faction record has `goal` set to the expected text.
- New test: `test_extract_includes_subfaction_national_share` — fixture has `SubFactionNationalShare` populated; assert per-faction `national_share` floats present and sum to 1.0 within the 12-row block.
- New test: `test_extract_includes_subfaction_effective_worldview` — fixture has `SubFactionDetail` block; assert each sub-faction has all 6 axes populated.
- New test: `test_extract_handles_missing_subfaction_ranges` — fixture lacks the three new ranges entirely; assert sub-factions still extract with `goal=None`, `national_share=None`, `effective_worldview=None` (no exceptions).

### 8.2 Fixture additions

`tests/fixtures/build_test_workbook.py` adds:
- `SubFactionGoal` named range pointing at the col-E block on the existing `Sub-Factions` fixture sheet.
- `SubFactionNationalShare` named range pointing at the col-L block.
- A new `Sub-Faction Detail` fixture sheet with a row-aligned 16-col block, plus a `SubFactionDetail` named range covering all 16 cols.

**Row alignment (load-bearing for the new tests):** the fixture's `SubFactionGoals` (cols A-E of `Sub-Factions`) and the new `SubFactionDetail` block must be row-aligned by `(GoI, Sub-faction)` name pairs. The new tests in §8.1 verify exactly this zip — so the fixture must populate both blocks with matching name pairs in the same row order. This is a *direct dependency* of the new test suite and therefore in scope, even though gotcha #10 generally cautions against unrelated fixture work. If the existing `SubFactionGoals` fixture rows are already aligned, just mirror them in the new Detail block; if not, fix the alignment for these specific rows only — do NOT touch the unrelated drift in the GoI block at fixture rows 24-31.

### 8.3 E2E (Playwright)

`tests-e2e/gois.spec.js` (new file or extension to existing):
- Click a sub-faction row → rail panel becomes visible with the sub-faction's name in the header.
- Goal text from the JSON appears in the panel.
- Both primary radar polygon and parent overlay polygon render in the SVG.
- Click the same row again → panel returns to empty state.
- Press `Esc` while panel is open → panel returns to empty state.
- At narrow viewport (<1280px), the rail is not in document flow; clicking a row reveals a bottom sheet; tapping outside dismisses it.

### 8.4 Accessibility (axe)

- The rail panel and the bottom sheet pass axe checks across all three themes.
- Sub-faction `<button>` rows have visible focus rings in all themes.
- Focus is restored to the triggering button when the panel closes (mobile sheet focus-traps while open).

## 9. Visual / theme considerations

- The rail uses `--bg-2` for its panel surface and the standard themed border colour.
- The 4px left bar in the panel header uses `goiColor()` — same palette as the existing GoI cards.
- The radar's overlay stroke uses a dedicated **`--radar-overlay`** token (NOT `--text-muted` and NOT `--accent`, both of which can collide with the primary line in at least one theme — particularly schematic). The token must be defined for all three themes per gotcha #12 and visually distinct from `--accent` and `--bg-2` in each. Test all three before merging.
- All new CSS classes define their colours via theme variables; no hardcoded hex.

## 10. Build sequencing

The implementation plan (next document) will sequence roughly as:

1. **Backend extractor** + tests + fixture additions + schema bump.
2. **`RadarChart.svelte`** overlay prop (small isolated change, easy to validate against existing GoI cards).
3. **`SubFactionPanel.svelte`** built in isolation against fixture data.
4. **`GoIs.svelte`** integration: page grid, selection state, mobile sheet wrapper.
5. **CSS additions** in `global.css` for the rail/sheet across all three themes.
6. **E2E + a11y tests** validating the integrated behaviour.

The detailed plan is the responsibility of the writing-plans skill, invoked once this design is approved.

## 11. Out-of-scope follow-ups (noted, not built)

- Surfacing minor goals in any UI form (data is already in JSON).
- Sortable/filterable list of all 12 sub-factions across GoIs (would be a `/sub-factions` page).
- Deep-linkable selection state via URL.
- Comparing two sub-factions side-by-side.
- Sub-faction goal-progress tracking (no backend data exists for it yet).
