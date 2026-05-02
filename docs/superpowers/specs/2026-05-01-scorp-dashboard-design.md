# SCORP Colony Player Dashboard — Design Spec

**Date:** 2026-05-01
**Status:** Approved, pending implementation plan
**Sibling project:** `scorp_colony/` (the backend workbook builder this dashboard reads from)

## 1. Concept

A static, player-facing web dashboard that surfaces a curated subset of the SCORP Colony GM workbook to players. Hosted on GitHub Pages. A scheduled GitHub Action pulls the live Google Sheet (an export-public mirror of the workbook), parses it, dumps per-page JSON, commits, and triggers a Pages rebuild — every hour, plus manual trigger after each turn.

The dashboard is read-only. The Google Sheet is the source of truth; players see what the GM has decided to publish.

## 2. Architecture

```
   Google Sheet (link-public, .xlsx export endpoint)
                  │
                  │ /export?format=xlsx
                  ▼
   ┌──────────────────────────────────────────┐
   │  GitHub Action  (cron: '7 * * * *'        │
   │                  + workflow_dispatch)     │
   │                                          │
   │  scripts/sync_sheet.py:                  │
   │    1. Download xlsx (retry/backoff)      │
   │    2. Read Var_SenatePageVisible flag    │
   │    3. Validate schema (named ranges,     │
   │       conditional on flag for Senate)    │
   │    4. Run extractors → JSON files        │
   │       (per-page errors logged, not fatal)│
   │    5. Write meta.json last with          │
   │       synced_at, schema_version,         │
   │       senate_visible, sheet_modified_    │
   │       time, partial_failures             │
   │  Commit + push if changes detected.      │
   │  On any fatal failure: Telegram webhook. │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │  GitHub Pages — Vite-built Svelte SPA    │
   │  Auto-deploys on push to main.           │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
              Player browsers
```

**Repo:** `SCORP 2.5/scorp_dashboard/` — sibling to `scorp_colony/`. Independent git history and GitHub repo.

**Stack:**

- **Sync:** Python 3.11+, openpyxl, `requests`. Pinned versions in `pyproject.toml`.
- **Frontend:** Svelte (Vite SPA — SvelteKit considered but adds routing/build complexity for marginal benefit at this scale). TailwindCSS for layout. CSS variables for theming.
- **Fonts:** `JetBrains Mono` + `IBM Plex Mono`, self-hosted via `@fontsource`.
- **Build:** `vite build` outputs to `dist/`. GitHub Pages serves from `gh-pages` branch (or `dist/` via Action).

## 2.1 Backend prerequisites

The following must be added to the `scorp_colony` workbook (and therefore to the live Google Sheet) before the dashboard ships. None require deep refactoring; all are additive.

| Wave | Item | Where | Notes |
|---|---|---|---|
| **1** | `Var_SenatePageVisible` named cell | `Variable` sheet, as a `Var_*` named cell (TRUE/FALSE) | Drives Senate page gating. Sync script reads this; missing → fail closed (Senate off). |
| **2** | `Situations` sheet | New sheet, S6 format: cols `Name \| Description \| Crisis Factor`. Crisis Factor is a number for ongoing or the literal string `"Ended"` for resolved. | Replaces the thin 1-row block on `Politics` rows 51-53. |
| **2** | `Stability Modifiers` sheet (or section) | New sheet (or block on `Politics`), S6 Government-tab format: cols `Name \| Description \| Factor`. Factor is a signed decimal. | Long-term institutional modifiers. |
| **2** | Crisis tier ladder | New sheet/block, S6 format: 6 tiers I-VI with `Active? (TRUE/FALSE)` and `Consequence` text per tier. Active flag computed from `% Until State Failure = Stability × 2 − Crisis Factor`. | Drives the tier-ladder component on Situations page. |
| **Future** | `Council Members` Seat # + Party columns | Adds per-NPC seat assignment to enable real Senate seat counts | Senate page ships with placeholder until this lands; not blocking either Wave. |

The dashboard's `validate_schema` step checks named ranges per page; pages whose backend prerequisites haven't been met will be omitted from the build with a clear log message rather than failing the whole sync.

## 3. Pages

Top nav order: **Status · Map · Population · Pops · GoIs · Parties · Senate · Situations**.
Right side: theme toggle (☀/☾), `Synced HH:MM UTC` chip (red when stale > 3 h).
Senate hidden when `senate_visible: false` in `meta.json`.

### 3.1 Status (landing, `/`)

One-screen colony summary.

- **Headline tiles** (4 across): Treasury Money, Population total, Stability, Crisis Factor (Crisis tile red when `crisis ≥ stability`).
- **Resource flow strip**: Food / Materials / Ore / Energy / Housing / He-3 / Water — current value + ±/turn delta.
- **Overton Window**: 6 horizontal sliders (1↔7) for Expansion/Authority/Corporate/Tech/Faith/Materialist axes.
- **Active Situations banner**: chips with name + crisis factor; click to jump to Situations page.
- **Stab vs Crisis arms-race meter**: visual bar showing the gap.

*Source:* `Politics!B1` (Stability), `Politics!E1` (Crisis Factor), `Colony` sheet (resources), `OvertonExpn..OvertonMat`.

### 3.2 Map

Interactive 40×40 colony tile grid.

- **Render strategy**: Canvas terrain layer + SVG/DOM overlay for icons + hover targets. Pure CSS-grid hover rejected on perf grounds (1600 nodes + listeners).
- **Base render**: terrain colour from `Terrain` sheet → palette lookup.
- **Overlay**: small SVG icons for Features (deposits) + Improvements (placed buildings). Icon keyed by category from `ImprovementsCatalog`.
- **Hover**: tile highlights, side panel slides in from right with terrain / feature / resource / slot / improvement (name + Owner + Ownership Type) / per-resource yield breakdown. Side panel pins on click.
- **Heatmap toggle**: dropdown above map ("Terrain" default; or recolour by Food / Materials / Ore / Energy / Housing / Water yield). Active layer drives base colour; hover side panel still shows everything.
- **Legend**: below map, keyed to active layer.

*Source:* 11 map sheets. Each tile aggregates: `Terrain` (base), `Features` (overlay), `Resources` (overlay), `Slots` (capacity number), `Improvements` grid (placement) + manifest at cols `AO:AR` (Tile / Improvement Type / Ownership Type / Owner). Per-tile yield breakdown comes from the 6 yield sheets and the `ImprovementYieldHelper` named range. The map extractor walks tiles row-by-row across all 11 sheets and zips the layers into one record per `(x, y)` coordinate.

### 3.3 Population (high-level)

- **Class table**: 11 live rows (blank slots filtered). Cols: name, current pop, % of total, tier (Upper/Middle/Lower), political weight.
- **Worldview-per-class** small radar charts: 6-axis position per class.
- **Tier breakdown donut**: Upper/Middle/Lower share.

*Source:* `PopsimPop`, `Reference!ClassTable` (political weight is col 4 of `ClassTable`), `Popsim` worldview rows.

### 3.4 Pops Detailed (per-class drilldown)

Class chip selector (or "All classes" comparison).

For selected class:

- **Living standards**: Standard of Living + Expected SoL (gap = unmet expectations); Social Privileges; Satisfaction.
- **Income**: Income/cap before tax, Total Income before tax (derived = `Pop × Gross/cap`), Income/cap after tax, Total Income after tax, Effective Tax Rate, Income Tax/cap, Wealth Tax/cap.
- **Wealth**: Class Wealth, Wealth/cap.
- **Additional Income** (from Wages & Welfare sheet): Welfare / Dividends / Subsidies / Other / Total.
- **Status**: Radicalisation, Abject Poverty, Organisation, Literacy, Vote Eligibility, Votes Total, Vote%.
- **Color cues**: red high (radicalisation, abject poverty), green high (satisfaction, SoL).

*Source:* `Popsim` named ranges (`PopsimSoL`, `PopsimExpectedSoL`, `PopsimSocialPrivileges`, `PopsimGrossPerCap`, `PopsimDisposablePerCap`, `PopsimRadicalisation`, `PopsimAbjectPoverty`, `PopsimOrganisation`, `PopsimLiteracy`, `PopsimVotesTotal`, `PopsimVoteShare`, `PopsimSatisfaction`, `PopsimWealthPerCap`); `'Wages & Welfare'!AdditionalIncomeRange`.

### 3.5 GoIs (Groups of Interest)

- **Per-GoI panel** (4 panels for live GoIs, 2×2 desktop / stacked mobile):
  - Name, Main Class, Derived Influence, Approval, Approach (text), Mad Index vs Overton.
  - 6-axis Effective Worldview small radar.
  - Active Benefits ("1 / 3 unlocked") with the unlocked entries listed.
  - Sub-faction breakdown: name, influence%, approval, minor goals.
- **PopCapture matrix** (bottom): 11 classes × 4 GoIs heatmap, baseline involuntary loyalty.

**Slot filtering:** the GoI block has 8 slots (4 live + 4 reserved blanks for extensibility). The extractor filters out rows where `GoINames[k]` resolves to an empty string. Same pattern applies to sub-faction rows.

*Source:* `Politics!A24:T31` for the GoI block (8 slots, filter blanks); sub-faction detail block — **range needs verification at extraction time** because backend CLAUDE.md and the actual built workbook currently disagree (CLAUDE.md says rows 32-44, the built workbook still has it at rows 24-36 cols U-AC). Implementation step 1: open the live workbook, locate the sub-faction names column, and lock the range; if a `SubFactions*` named range exists by then, use that instead. Also: `'GoI Benefits'!GoIBenefitsTable`, `'GoI Modifiers'!PopCaptureBase`.

### 3.6 Parties

- **15-slot grid**, founded parties first, blanks collapsed (don't render empty slots — show 1 small "Slots available: N" note).
- **Per-party card**: Name, Founded year, Establishment, Closest GoI, 6-axis Stance radar, Mad Index, Estimated Support, Vote Share.
- **GoI–Party Compatibility heatmap**: parties × 4 GoIs.
- **Class–Party Compatibility heatmap**: parties × 11 classes.
- **Empty state**: when no parties founded — "No parties founded yet — players form parties during play."

*Source:* `Parties!A4:AP18`.

### 3.7 Senate (sheet-flag gated)

When `Var_SenatePageVisible` is FALSE: page does not exist. `senate.json` is not written by the sync script. Frontend nav hides the entry based on `meta.senate_visible`.

When TRUE: page exists with placeholder seat data (per design decision — backend lacks per-NPC seat assignment yet) plus the data we *do* have:

- **Coalitions table** (5 slots): name, member parties, member count, total establishment, total vote share, worldview centroid (6-axis), Approach.
  - Membership is encoded on the Coalitions sheet as 15 boolean flag columns (B-P), one per Parties row. The extractor must resolve each TRUE flag to its Parties row's name to produce a human-readable `member_parties` array.
  - Filter out coalitions where `Member Count` is 0 (empty slots).
- **GoI capture % by party**: derived = `Compat[GoI] × VoteShare`, normalised across parties per GoI. Interpretation: "of GoI X's effective political voice, party Y carries this share."
  - **Empty state**: when no parties are founded (or all founded parties have `VoteShare = 0`), the matrix renders as "No party-level capture data — no parties have measured vote share yet." Don't divide by zero in normalisation.
- **Seat count placeholders**: empty/null fields with a banner: "Seat data coming once Council Members sheet adds Seat # and Party fields."

*Source:* `Coalitions` sheet (rows 4–8, with B-P as membership flags into Parties rows 4-18), `Parties` sheet (compat + vote share for derivations).

### 3.8 Situations

- **Active situations** card grid: name, description, crisis factor contribution, status. Default filter: ongoing only; toggle reveals ended.
- **National Stability Modifiers** list (long-term institutional issues from S6's Government tab format): name, description, factor (signed).
- **Crisis tier ladder**: 6-tier escalation table, currently active tier highlighted, computed from Stab vs Crisis.

*Source:* future `Situations` sheet (S6 format: `Name | Description | Crisis Factor` with `"Ended"` sentinel for resolved); future `Government` or `Stability Modifiers` sheet for the long-term list. The user will add these to the Google Sheet.

## 4. Data pipeline

### 4.1 Sync script (`scripts/sync_sheet.py`)

```
sync_sheet.py
├── download_xlsx(sheet_id) → tempfile path
├── load_workbook(path, data_only=True)
├── validate_schema(wb, expected_named_ranges) → raises if missing
├── extractors/
│   ├── status.py
│   ├── map.py
│   ├── population.py
│   ├── pops.py
│   ├── gois.py
│   ├── parties.py
│   ├── senate.py        # short-circuits if Var_SenatePageVisible is FALSE
│   └── situations.py
├── write_json(public_dir, data_dict)
└── write_meta(public_dir, synced_at, sheet_modified_time, senate_visible, schema_version)
```

**Reading rules:**

- All sheet access via `wb.defined_names[name]` (named ranges only — never hardcoded `sheet[cell]`). This is the same convention as the backend.
- Blank class/GoI/party/sub-faction slots (empty col-A name) filtered at extraction time.
- Numeric cells: cast to float; cells with `""` or formula-error sentinels → `None`. Frontend renders `None` as `—`.

**Sync ordering:**

1. Download xlsx (with retry/backoff).
2. Read `Var_SenatePageVisible` flag. Missing or FALSE → mark Senate as disabled.
3. Run `validate_schema(required_ranges)`. The required-ranges list is **conditional**: Senate-specific ranges are excluded from validation when the flag is disabled (so a workbook without Senate data structures can still produce a valid sync).
4. Validation passes → run extractors per page. Senate extractor short-circuits if flag disabled.
5. Page extractor exception → log + omit that page's JSON, record in `meta.partial_failures`, continue others.
6. Write all JSON files to `public/data/` atomically (write to `.tmp` then rename).
7. Write `meta.json` last with `synced_at`, `senate_visible`, `schema_version`, `partial_failures`, `sheet_modified_time`.
8. Commit + push if any change.

**Failure modes:**

- Download fails (after retries) → log + Telegram webhook + exit non-zero. Last-good JSON stays in repo.
- Schema validation fails (a required, non-Senate range missing) → log + Telegram webhook + exit non-zero. Same.
- Per-extractor exception → log + skip that page's JSON, continue others. `meta.partial_failures` lists affected pages, frontend can show a "this page failed to sync" banner.
- Sheet flag missing → fail closed (Senate off, no Senate JSON written, never accidentally exposes Senate data).
- A backend-prerequisite sheet (Situations, Stability Modifiers, Crisis Tier Ladder) doesn't exist yet → that page's extractor logs and skips; page renders an empty-state in the UI.

### 4.2 GitHub Action (`.github/workflows/sync.yml`)

- Triggers: `schedule: '7 * * * *'` (off-the-hour to avoid contention) + `workflow_dispatch`.
- Steps: checkout, setup Python (uv), install deps, run `sync_sheet.py`, commit-if-changes, push.
- `SHEET_ID` stored as a repo Variable (not Secret — it's link-public).
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` stored as Secrets, used only on failure-webhook step.
- Job uses `permissions: contents: write` to push.
- Documented in `README.md` that schedule is best-effort (GitHub cron drifts 5–15 min, occasionally skips).

### 4.3 JSON contract

All keys `lower_snake_case`. Floats not stringified. Missing values are `null`, never `"—"` (rendering is the frontend's job).

`meta.json` (always present):

```json
{
  "synced_at": "2026-05-01T14:07:00Z",
  "sheet_modified_time": "2026-05-01T13:48:12Z",
  "senate_visible": false,
  "schema_version": 1,
  "partial_failures": []
}
```

`sheet_modified_time` is read from the xlsx file's internal `core.modified` property (openpyxl's `wb.properties.modified`), which Sheets stamps on export with the workbook's most recent revision time. No Drive API call needed — saves us auth setup. Useful for UI signal "synced an hour ago, but GM hasn't touched the sheet in 3 days."

Frontend boot sequence:

1. Fetch `meta.json?v=<random>` first (always-fresh).
2. If `meta.schema_version` ≠ frontend's expected version → render maintenance banner, abort.
3. All other JSON fetches use `?v=${meta.synced_at}` cache-bust → no stale-mix race.
4. Filter nav using `meta.senate_visible`.

Per-page JSON shapes documented in their extractor modules (`extractors/*.py`) — keep them as the canonical source rather than duplicating here. Implementation plan will lock the shapes via test fixtures.

Optional `taxonomy.json` if frontend wants shared label arrays (class names, GoI names, party names) referenced by index — defer to implementation, not a spec-time decision.

## 5. Visual design

### 5.1 Themes

Two themes via `data-theme` on `<html>`. Default **light (M2 "Console Cream")**, dark is **M1 "Mission Brutalist"**. Toggle persists to localStorage. Inline pre-hydration script in `app.html` reads localStorage before Svelte mounts (no flash of wrong theme).

CSS variables (representative):

```css
:root[data-theme="light"] {
  --bg: #f3ead4; --fg: #1a140a; --accent: #c44900;
  --border: #1a140a; --muted: #6b5a3a; --crit: #c44900;
  --grid-line: #1a140a; --alert-bg: #1a140a; --alert-fg: #f3ead4;
}
:root[data-theme="dark"] {
  --bg: #0d0a05; --fg: #f3e9d2; --accent: #ffb000;
  --border: #f3a000; --muted: #b89255; --crit: #ff4040;
  --grid-line: #f3a000; --alert-bg: #f3a000; --alert-fg: #0d0a05;
}
```

### 5.2 Type, layout, components

- **Display + values**: `JetBrains Mono`. **Body + labels**: `IBM Plex Mono`.
- **Borders**: 4px on cards, 2px on inner grid lines. Solid black (light) / amber (dark).
- **Monolithic 3-col stat grids**, brutalist labels (uppercase, 3px letter-spacing, muted), big values (24-32px, weight 800).
- **No rounded corners** except small UI accents (theme toggle pill, chips).
- **No shadows or gradients** except: amber text-glow on `--accent` in dark; subtle scanline overlay in dark only.

Components (Svelte):

- `<StatTile />`, `<DataGrid />`, `<RadarChart />`, `<Heatmap />`, `<MapCanvas />`, `<SituationCard />`, `<TierLadder />`, `<ThemeToggle />`, `<SyncChip />`, `<NavBar />`.

### 5.3 Responsive

Desktop-first. Mobile: collapse 3-col → 1-col, side panels become bottom drawers, nav collapses to hamburger. No bespoke tablet design.

### 5.4 Accessibility

- WCAG AA contrast verified on both themes (light passes trivially; dark amber/black requires measurement — confirm during implementation).
- Keyboard navigation on map (arrow keys move focused tile; focus state mirrors hover state).
- All hover-only content also exposed on focus.
- All animations respect `prefers-reduced-motion`. The only animations: alert-bar pulse (dark theme), theme-transition.

## 6. Privacy

The Sheet is link-public; the dashboard repo is public. The Senate page's "real privacy boundary" is real with two caveats stated honestly:

1. **Git history is permanent.** Once `senate.json` has been committed, the file is in git history forever. Toggling the flag OFF after the fact does not retroactively unpublish it. If true privacy is needed for a particular Senate state, plan the toggle BEFORE the data exists in the workbook, or maintain a separate squashed branch for Pages.
2. **The Sheet itself is link-public.** A determined player who guesses or finds the Sheet URL can read raw GM data. The dashboard's data filter is the boundary against *casual* discovery, not against an adversary.

Document this in the README. No security theatre.

## 7. Operational concerns

- **Sync staleness visibility**: `last synced HH:MM UTC` chip in nav, red after 3 h.
- **Failure webhook**: Telegram (already wired in this user's environment). On any sync exit-non-zero, the Action posts to a known chat with a short error summary + Action run URL.
- **Pinned versions**: Python and openpyxl pinned in `pyproject.toml`; Action uses pinned versions, not "latest", to insulate against Sheets-export quirk regressions.
- **Rate limits**: `/export?format=xlsx` is undocumented and has been throttled before. Sync script implements retry-with-exponential-backoff (3 attempts, 5s/15s/45s) on any non-200 response.
- **robots.txt**: noindex. The dashboard is for the campaign, not for search engines.

## 8. Out of scope

- **Per-region pages** (S6 Public Info-style). The colony is one region.
- **Electoral promises tracking**. No election framework in the workbook yet.
- **Real-time updates / websockets**. Hourly sync is the contract.
- **Player auth / per-player views**. Public dashboard, single audience.
- **Editing data from the dashboard**. Read-only.
- **Per-NPC Council seat data on Senate page**. Placeholder until backend adds Seat # + Party columns to `Council Members`.
- **Mobile-bespoke design**. Responsive collapse only.

## 9. Open items resolved during brainstorming

| Question | Decision |
|---|---|
| Sheet relation | Single persistent URL, hourly pull |
| Hosting | GitHub Pages + Action cron |
| Repo | New sibling repo `scorp_dashboard/`, own GitHub repo |
| Frontend stack | Svelte (Vite SPA) + TailwindCSS + self-hosted IBM Plex/JetBrains Mono |
| Sheet privacy | Public link; sensitive content controlled at extraction time |
| Senate gating | Sheet flag `Var_SenatePageVisible`; real privacy boundary (skip extraction when off); honest about git history caveat |
| Map UX | Canvas terrain + SVG icons + side panel + heatmap toggle |
| Visual style | M2 light default + M1 dark, brutalist mission-control mashup |
| Page count | 8 pages (Status / Map / Population / Pops Detailed / GoIs / Parties / Senate / Situations) |
| Pops vs Population | Two separate pages (per user preference; rejected reviewer's merge suggestion) |
| GoI capture % | Derived = `Compat[GoI] × VoteShare`, normalised |
| Total Income before tax | Derived in dashboard = `Pop × Gross/cap` |
| Failure webhook | Telegram |
| schema_version | Hard-fail in frontend on mismatch |
| JSON cache-busting | All fetches use `?v=${meta.synced_at}`; meta.json fetched first with random cache-bust |

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Backend renames a named range, breaking the sync | `validate_schema` step lists required names + fails Action with clear error |
| Sheets-export `.xlsx` differs from openpyxl's expectations | Test against the *actual* exported file early; don't rely on locally-built workbook for fidelity |
| Action runs while users are mid-fetch and serves mixed-version JSON | All JSON fetches keyed off `meta.synced_at` query param; meta.json fetched first; race window invisible to user |
| Action fails silently for days | Telegram webhook on failure + visible last-synced chip in nav (red when stale) |
| GitHub cron delays | Documented as best-effort; manual `workflow_dispatch` trigger available for post-turn syncs |
| 1600-tile map causes paint hitches on theme toggle | Canvas base layer (cheap repaint) + SVG overlay (cheap restyle); theme toggle does not re-render Canvas |

---

## Acceptance criteria

Shippable in two waves to handle the backend-prerequisite dependency on the Situations / Stability Modifiers / Tier Ladder sheets.

**Wave 1 — Shippable without further backend work** (assumes only `Var_SenatePageVisible` cell is added):

1. Pages **Status / Map / Population / Pops Detailed / GoIs / Parties** all render with real data from the live Sheet.
2. **Senate** page renders when flag is ON (with placeholder seats + working Coalitions + GoI capture %), and is fully absent (no `senate.json` in repo, no nav entry) when flag is OFF. Verified by toggling the flag and re-syncing.
3. **Situations** page renders an empty-state ("Backend sheets pending") and is reachable from nav, so the layout is visible but the data is "not yet wired up."
4. Theme toggle works without flash of wrong theme on load (verified by hard reload in both light and dark).
5. Schema validator catches a deliberately-renamed named range during a test sync (verified by renaming `PopsimSatisfaction` in a fixture workbook and confirming the Action exits non-zero with a clear message).
6. Sync failure triggers Telegram webhook in a forced-failure test run.
7. WCAG AA contrast verified on both themes using a reproducible tool (e.g. Playwright + `axe-core`, run in CI; or browser DevTools' contrast checker recorded as a screenshot in the README).
8. Map hover side panel works keyboard-accessibly (arrow keys move focus; Enter pins; ESC unpins).
9. **Coalition flag→name resolution** renders correctly: a fixture workbook with a coalition flagged for parties at rows 4 and 7 produces `member_parties: ["<Party at row 4 name>", "<Party at row 7 name>"]`.
10. `meta.synced_at` chip in nav turns red when stale > 3h (verified by manually backdating `meta.json`).
11. README documents: setup, manual sync trigger, `schema_version` bump procedure, privacy caveats including the git-history caveat.

**Wave 2 — Ships when backend prerequisite sheets land**:

12. **Situations** page renders active situations from the new Situations sheet, with the ongoing/ended toggle working.
13. **Stability Modifiers** list renders from the new Stability Modifiers sheet/block.
14. **Crisis tier ladder** renders with the currently-active tier highlighted, computed from `Stability × 2 − Crisis Factor`.
