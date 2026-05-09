# Tech page — Design Spec

**Date:** 2026-05-09
**Status:** Draft (awaiting user review)
**Schema bump:** v7 → v8

## 1. Goals

1. Add a player-facing read of the GM workbook's tech research tree as a new top-level page (`/tech`).
2. Surface state at a glance: what's researched, what's available to research, what's still locked behind prereqs.
3. Make every tech's mechanical effect (`+20% Yield · Hydroponic Bay`, `−15% Workforce · Hospital`, etc.) legible without hover, since players plan around effects.
4. Preserve the dashboard's "tier-loaded" extractor pattern: missing `TechTable` named range → empty payload, page hidden, sync still succeeds.

## 2. Non-goals

- **Institutional Capture** matrix (separate sheet, GoI × institutions). Different shape, different home; will land in a separate ticket if pursued.
- **SVG prereq arrows** between tech cards. Prereqs are surfaced as text chips on cards (with cross-branch tags); arrow rendering is deferred polish.
- **Effects rollup band** (researched techs aggregated by target building). Not useful at v1 because zero techs are researched in the live data; can be added once that changes.
- **Player-side research actions.** Read-only, like every other page.
- **Per-tech illustrations / icons** beyond branch-level visual treatment.

## 3. Source data

A single 2D named range, **`TechTable`**, with a header row at the top and one row per tech below. Authored on the `Tech & Institutions` sheet.

**Headers (verbatim from GM workbook, R3):**

```
Name | Branch | Tier | Cost (RP)
Prereq 1 | Prereq 2
Researched | Available
Effect 1 — Target | Type | Mag
Effect 2 — Target | Type | Mag
Effect 3 — Target | Type | Mag
Description
```

The `Type` column for each effect is one of `Yield`, `Workforce`, `Upkeep` (free-text in the workbook; we lower-case for slug, preserve raw for display). `Mag` is a decimal (e.g. `0.20`, `-0.15`) interpreted as a multiplier.

Headers are matched by name (not column index) so the GM can reorder columns. Unknown headers are silently dropped. The "Effect N" header set repeats with positional `— Target` / `Type` / `Mag` columns; we parse them positionally within each effect group (see §4.1).

**Header-row offset.** The live `Tech & Institutions` sheet has a banner title at R1 and an author note at R2 ("These are kinda just examples"). The user's note that **`TechTable` includes the headers and covers the entire table** means the named range starts at the header row (R3 in current data) and ends at the last reserved data slot (R23 in current data, 20 slots total). Anything above R3 is outside the named range and never read.

**Currently in the live workbook:** 19 techs across 6 branches (Agriculture · Industry · Mining · Energy · Civic · Science), 0 researched, 6 available (the tier-1 of each branch), 13 locked.

## 4. Backend

### 4.1 New extractor — `scripts/extractors/tech.py`

Public entrypoint:

```python
def extract(wb) -> dict:
    """Return {'techs': [...], 'branches': [...]}. Empty lists if range absent."""
```

Behaviour:

- Read via `read_named_range(wb, 'TechTable')` — returns `[]` when missing.
- Treat row 0 as headers; subsequent rows as data. Header normalization: trim + collapse whitespace.
- Skip any row whose `Name` cell is blank (convention 8 — the 12 reserved slots in the live data).
- Per-row parse:
  - `name`: string, required.
  - `branch`: string, required (drives column grouping on the frontend).
  - `tier`: int via `coerce_number` then `int(...)` (workbook stores as float `1.0`).
  - `cost_rp`: int via the same path.
  - `prereqs`: collect non-blank values from `Prereq 1` and `Prereq 2` into a list (0–2 entries).
  - `researched`: bool — truthy values (`True`, `"TRUE"`, `1`) → `True`; everything else → `False`.
  - `available`: bool — same coercion.
  - `effects`: walk the three `Effect N` triples; for each, if `— Target` is non-blank, emit `{target, type, type_raw, mag}`. `type` is the lower-case slug (`yield` / `workforce` / `upkeep`); `type_raw` preserves the original casing for display fallbacks. `mag` goes through `coerce_number`. **Effect-group parsing is positional within each triple:** the parser locates the literal `Effect N — Target` header to find the start of each triple, then consumes the next two columns as Type and Mag. Column reordering is safe across groups (the headers anchor each group's start), but reordering *within* a triple breaks the assumption.
  - `description`: string, may be `None`.
- A row with `researched=True` but `available=False` is reported as-is — the GM is the source of truth on that contradiction; the frontend treats `researched` as winning (see §5.2.2 priority).
- **Unknown effect type logging.** When a `type_raw` value lower-cases to something outside `{yield, workforce, upkeep}`, emit a single-line stdout warning (mirrors `catalog.py:_slugify_category`'s `_log.warning`): `extractor tech: unknown effect type 'Stability' on 'Tech Name'`. The slug is preserved as-is in `type` (lower-cased raw); the frontend then renders a neutral chip per §5.2.2. This gives us telemetry to expand the colour map when the GM authors new types.

**Branch list derivation.** After parsing, derive `branches` as the **distinct branch values in encounter order**, with a stable canonical preference applied first: any of `Agriculture, Industry, Mining, Energy, Civic, Science` that appear are placed in that order ahead of any unknown branches (which append in encounter order). This keeps column ordering stable across syncs even if a new branch is added.

### 4.2 Output schema (`public/data/tech.json`)

```json
{
  "techs": [
    {
      "name": "Hydroponic Optimization",
      "branch": "Agriculture",
      "tier": 1,
      "cost_rp": 100,
      "prereqs": [],
      "researched": false,
      "available": true,
      "effects": [
        { "target": "Hydroponic Bay", "type": "yield",     "type_raw": "Yield",     "mag":  0.20 },
        { "target": "Hydroponic Bay", "type": "workforce", "type_raw": "Workforce", "mag": -0.10 }
      ],
      "description": "Refined nutrient cycles boost Hydroponic Bay output and reduce labour needs."
    }
  ],
  "branches": ["Agriculture", "Industry", "Mining", "Energy", "Civic", "Science"]
}
```

### 4.3 Sync wiring — `scripts/sync_sheet.py`

- Bump `SCHEMA_VERSION = 7` → `SCHEMA_VERSION = 8`.
- Register `("tech", ex_tech.extract)` in the extractor loop. Always write `public/data/tech.json` (even when `techs` is empty) — convention 5, mirrors `catalog.py`.
- No `notify_telegram` change.

### 4.4 Schema validator — `scripts/validate_schema.py`

- Add `"TechTable"` to **`SOFT_OPTIONAL_V3_RANGES`** (the soft-optional bucket — gotcha #14 / convention 14). The validator does not require it; the extractor's `read_named_range` returns `[]` when absent and the page hides.

### 4.5 Test fixture — `tests/fixtures/build_test_workbook.py`

Add a new sheet `Tech & Institutions` with:
- R1: title banner (matches live layout, ignored by extractor).
- R3 onward inside the named range:
  - **R3:** header row matching the verbatim 18 headers from §3.
  - **R4–R7:** four seeded techs covering the test surface area:
    - One Tier-1 Agriculture, `available=True`, no prereqs, 2 effects.
    - One Tier-2 Agriculture, `available=False`, single prereq (T1 above), 1 effect.
    - One Tier-1 Industry, `researched=True` (so a "researched" card is in the fixture), 3 effects.
    - One Tier-2 cross-branch tech with prereqs from two different branches.
  - **R8:** blank-name row (validates skip behaviour).
- Register `TechTable` named range covering R3:R8.

The fixture lets `test_tech.py` cover happy path + skip-blank + multi-prereq + cross-branch detection without hand-rolling a workbook in each test.

## 5. Frontend

### 5.1 New store — `src/lib/stores/tech.js`

Standard pattern: writable store, `loadTech()` fetches `public/data/tech.json?v=${meta.synced_at}`, sets `null` on 404 (graceful) or schema mismatch, exports a derived `$techByBranch` map for convenience.

### 5.2 New route — `src/routes/Tech.svelte`

Two bands. (Band 03 — effects rollup — explicitly deferred per §2.)

#### 5.2.1 Band 01 — Research Progress

KPI tiles (reuse `.kpi-block`):

- **Researched** — `n / total` (e.g. `0 / 19`).
- **Available** — count of techs with `available=true && researched=false`.
- **Locked** — count of techs with `available=false && researched=false`.
- **RP committed** — sum of `cost_rp` for researched techs.

Below the tiles, a per-branch progress strip — one mini bar per branch. **Denominator is total techs in that branch** (e.g. `Agriculture 0/4` means 0 researched out of 4 techs in the Agriculture branch — not "0 available out of 4"). Reuses `.bar-row` + `.bar` styling.

#### 5.2.2 Band 02 — Tech Tree

A **6-column responsive grid** (one column per branch in the canonical order from §4.1). Within each column, techs are grouped by tier (T1 → T2 → T3) with a tier label between groups.

**Tech card** (`<TechCard>` in `src/lib/components/`):

```
┌─────────────────────────────┐
│ [tier·cost] [status badge]  │
│ Tech Name                   │
│ ┌───────────────────────┐   │
│ │ +20% Yield · Hydropon… │   │  ← effect chip
│ │ −10% Workforce · Hydr… │   │
│ └───────────────────────┘   │
│ ⤷ Prereq Name        (lock) │
│ Description text wraps      │
└─────────────────────────────┘
```

**State priority** (single class per card, mutually exclusive — derived in this order):

1. `researched=true` → `.researched` (wins over `available`, regardless of the `available` flag value).
2. `researched=false && available=true` → `.available`.
3. otherwise → `.locked`.

**State treatments:**

- `.tech-card.researched` — full opacity, left-bar accent in `--good`, ✓ check badge, "Researched" status.
- `.tech-card.available` — full opacity, neutral border, ⚡ badge, "Available" status.
- `.tech-card.locked` — `opacity: .55`, 🔒 badge, "Locked" status. Prereqs render as red-tinted chips.

**Effect chips** — new minor class `.tech-effect-chip`. Fields:
- Sign-aware sign: `+` for positive `mag`, `−` (en-dash) for negative.
- Number rendered as percentage: `Math.round(mag * 100)` → e.g. `0.20` → `20%`, `-0.15` → `15%`.
- Type badge: `Yield` / `Workforce` / `Upkeep` (display the `type_raw` value).
- Target name: passed through verbatim.
- **Color by direction-of-good, not raw sign.** Workforce reduction is good for the player; upkeep reduction is good. So:
  - `type = yield`, `mag > 0` → `.pos`
  - `type = yield`, `mag < 0` → `.neg`
  - `type = workforce`, `mag < 0` → `.pos` (less workforce needed = good)
  - `type = workforce`, `mag > 0` → `.neg`
  - `type = upkeep`, `mag < 0` → `.pos`
  - `type = upkeep`, `mag > 0` → `.neg`
  - `mag === 0` (any type) → neutral chip (no `.pos` or `.neg`).
  - unknown `type` (anything outside `{yield, workforce, upkeep}`) → neutral chip. The extractor logs a stdout warning when this happens (§4.1) so we can extend the map.
  - This is fixed at the chip render site; no toggle.

**Prereq chips.** Each prereq renders as `⤷ {Prereq Name}`. If the prereq's branch (looked up in the techs list) differs from the current tech's branch, append `↗ {Branch}`. If the prereq is not found in the techs list at all (GM typo / phase), render as plain text without the cross-branch tag — the chip is informational, never throws.

**Locked-prereq highlight.** When the parent card is `.locked` AND the prereq is **not researched**, the prereq chip gets a red-tinted background (`var(--crit-soft)`). This makes "what's blocking me" scannable at a glance.

#### 5.2.3 Empty state

If `$tech.techs.length === 0`, the entire page renders a single empty band with the message `Tech tree not yet wired up — sync hasn't seen the TechTable named range.` This handles the pre-naming phase gracefully and remains reachable via the always-visible nav link (see §5.3).

### 5.3 Nav + routing — `src/App.svelte`, `src/lib/components/NavBar.svelte`

- Add `/tech` route in the App-level switch.
- Add a `Tech` nav link, positioned between **GoIs** and **Parties** (mirrors the gameplay flow: politics → tech → parties → senate).
- **Nav link is always visible** when `tech.json` exists (which it always does — §4.3 writes it unconditionally, even with an empty list). This differs from Senate, which conditionally writes `senate.json` based on `Var_SenatePageVisible`. With Tech, the JSON always exists, so the link is always shown; an empty payload routes to the §5.2.3 empty-state band rather than hiding the page.

### 5.4 Schema version — `src/lib/stores/meta.js`

Bump `EXPECTED_SCHEMA_VERSION` 7 → 8. Mismatch = maintenance banner per CLAUDE.md convention 3.

### 5.5 CSS additions — `src/styles/global.css`

New classes (`tech-` prefix, no Tailwind utilities per convention 12):

- `.tech-grid` — 6-column responsive grid; collapses to 3 / 2 / 1 columns at `lg` / `md` / `sm` breakpoints. Defined as CSS grid with `grid-template-columns: repeat(6, minmax(0, 1fr))`. The `minmax(0, …)` floor matters — gotcha #22 documents the feedback loop a bare `1fr` causes when content can resize.
- `.tech-card` + state modifiers `.tech-card.researched` / `.tech-card.available` / `.tech-card.locked`.
- `.tech-card-header` (tier badge + cost + status).
- `.tech-card-effects` (effect-chip column).
- `.tech-effect-chip` + `.pos` / `.neg` modifiers (lighter than `.cat-chip` — these are derived effects, not catalog reads).
- `.tech-prereq-chip` + `.unmet` modifier (red-tinted bg via `--crit-soft`).
- `.tech-tier-label` (between tier groupings within a column).

All variables resolve via `:root[data-theme=…]` blocks for `light` / `dark` / `schematic` (convention 8 — three-mode tri-state theme system). No new theme variables required; reuses existing `--good`, `--crit-soft`, `--accent-soft`, `--bg-2`, `--fg`.

## 6. Tests

### 6.1 Backend — `tests/test_tech.py`

Cases:
- Happy path: every header parsed, branches list in canonical order, effects coalesced into 0–3 entries.
- Missing range: returns `{"techs": [], "branches": []}`.
- Blank-name row: skipped.
- Cross-branch prereq: the chip-cross-branch logic doesn't run in the extractor (frontend concern), but the prereq list contains the verbatim string.
- `researched=True, available=False`: both flags preserved as-is in JSON.
- `Effect 2` blank but `Effect 3` populated: only the populated effect surfaces.
- Tier and cost: float `1.0` from openpyxl coerces to `int 1`.

### 6.2 Frontend — `tests-e2e/tech.spec.js` (new)

Playwright + axe coverage:
- Page loads, tree renders one column per branch.
- A `.researched` card has the ✓ check, an `.available` card has ⚡, a `.locked` card has 🔒.
- Locked-tech with un-researched prereq has the prereq chip with `.unmet` styling.
- All three themes (`light` / `dark` / `schematic`) pass axe.
- Keyboard tab order: nav link → KPI band → first tech card → next tech card.

## 7. Build sequence

1. **Backend extractor + tests + fixture** — extractor, fixture additions, `test_tech.py`. Validate `pytest` green.
2. **Sync wiring + schema bump** — `sync_sheet.py`, `validate_schema.py` (soft-optional list), `meta.js` `EXPECTED_SCHEMA_VERSION`. Validate `python scripts/sync_sheet.py --xlsx <local.xlsx>` writes `tech.json`.
3. **Store + route + nav** — `lib/stores/tech.js`, `routes/Tech.svelte` (without effect chips yet), `App.svelte`, `NavBar.svelte`. Page renders bare-bones cards.
4. **TechCard component + effect chips + prereq chips** — extract `TechCard.svelte`, polish chip rendering, add the direction-of-good colour logic.
5. **CSS** — six-column grid, card states, chip styles, theme variables verified.
6. **e2e tests** — `tests-e2e/tech.spec.js` covering all three themes and keyboard a11y.
7. **CLAUDE.md update** — add a numbered convention/gotcha if any non-obvious decision falls out (e.g. direction-of-good colour mapping).

## 8. Risks / open questions

- **Author note on R2.** `These are kinda just examples` is in the workbook and the GM may swap the data wholesale. Extractor is robust to any branch / target naming, so this is fine; the only fragility is the canonical branch order in §4.1 — if the GM renames `Agriculture` → `Farming`, the new branch lands at the end of the column order. Acceptable for v1.
- **`Mag` as multiplier vs flat.** All current values look like multipliers (0.10–0.40). If the GM later authors flat-value effects (e.g. `+5 Stability` rather than `+5%`), the percentage formatter will show `500%`. Fixing this would require a per-effect kind tag from the workbook; deferred.
- **Researched-but-not-available** state in source data — we don't render a contradiction warning. Treat researched as winning. If this becomes common, we could render a small ⚠ tag, but YAGNI for now.
- **Effects rollup deferred.** Reasonable v1 trade since 0 techs are researched. Need to remember to revisit when techs start getting researched.
