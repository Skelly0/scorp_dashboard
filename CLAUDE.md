# SCORP Colony Player Dashboard — Frontend Companion

Static Svelte SPA + Python sync pipeline that surfaces a player-facing read of the `scorp_colony` GM workbook. Hosted on GitHub Pages, refreshed hourly via GitHub Action that pulls the Google Sheet's xlsx export.

## Architecture in one breath

GitHub Action → openpyxl → per-page JSON in `public/data/` → git commit → Pages rebuild → Svelte SPA fetches. Each successful sync also writes a per-year snapshot to `public/data/history/year-NNN.json` so the frontend can render historical sparklines on Status.

## Layout

- `scripts/` — Python sync (entry: `sync_sheet.py`; per-page extractors in `extractors/`; per-year snapshots in `history.py`)
- `src/` — Svelte SPA (one route per page, one store per page, shared components in `src/lib/components/`)
- `src/lib/components/` — Mission-Brutalist primitives: `Band`, `KpiBlock`, `Sparkline`, `OvertonRow`, `Bar`, `Tag`. Plus updated `StatTile`, `SituationCard`, `TierLadder`, `Heatmap`. Existing: `RadarChart`, `MoonBackdrop`, `MoonLoader`, `MapCanvas`, `NavBar`, `SyncChip`, `ThemeToggle`.
- `src/lib/faction-colors.js` — class & GoI accent palettes (cosmetic only — used for 4px left-bar and faction-bar swatches)
- `src/lib/stores/history.js` — derived stores for treasury/stability/CF/population year-series
- `public/data/` — JSON output (managed by the Action; don't hand-edit). `history/index.json` lists available years; `history/year-NNN.json` is the per-year frozen snapshot.
- `tests/` — pytest, builds an in-memory fixture workbook (`tests/fixtures/build_test_workbook.py`)
- `tests-e2e/` — Playwright + axe a11y tests
- `.github/workflows/` — `sync.yml` (cron), `deploy-pages.yml` (build), `ci.yml` (PR tests)

## Critical conventions (NON-NEGOTIABLE)

1. **All sheet access via named ranges.** `wb.defined_names[name]` only — never `sheet["A24"]`. The backend reorganises rows; named ranges are the contract.
2. **Schema validator runs every sync.** When you add an extractor, register its required ranges in `BASE_REQUIRED_RANGES` (or `SENATE_REQUIRED_RANGES` for senate-only).
3. **`schema_version` bumps in lockstep.** Bump `SCHEMA_VERSION` in `sync_sheet.py` AND `EXPECTED_SCHEMA_VERSION` in `src/lib/stores/meta.js`. Mismatch = maintenance banner.
4. **Senate page is the privacy boundary.** When `Var_SenatePageVisible` is FALSE, the Action does NOT write `senate.json`. The frontend treats the absence of the file as "page does not exist."
5. **Atomic JSON writes.** Use `write_json_atomic` — write to `.tmp`, then rename. Never partial writes.
6. **Cache-bust JSON fetches.** Frontend fetches `meta.json?v=<random>` first; everything else uses `?v=${meta.synced_at}`. No mixed-version race.
7. **Numeric coercion.** All cell reads go through `coerce_number` — handles blanks, formula errors, and floats uniformly. Output: `float | None`. Frontend renders `None` as `—`.
8. **Blank-slot filtering.** Extensible blocks (15 class slots, 8 GoI slots, 15 party slots) reserve blanks for future growth. Always filter rows where col-A name is empty before serialising.
9. **Failure notifications are best-effort.** `notify_telegram.send` swallows its own exceptions — never let notification failure mask the real error.
10. **`Var_Year` is OPTIONAL but year-indexed history depends on it.** The named range points at `Colony!H1` in the live workbook and surfaces as `status.year` (int) in `status.json`. When present, sync writes/overwrites `public/data/history/year-NNN.json` (3-digit zero-padded) plus updates `public/data/history/index.json`. When absent, history is silently skipped — sync still succeeds. Year stays the same across many turns; we overwrite the same year file every sync until it ticks over.
11. **History writes are idempotent within a year, frozen across years.** While Var_Year holds, every sync overwrites the same `year-NNN.json` with the latest snapshot. When the year increments, the prior file stops being touched and effectively becomes archival. Don't expect turn-level granularity — the index axis is *year*.
12. **Design vocabulary is CSS classes in `global.css`, NOT Tailwind utilities.** `.band`, `.s-card`, `.s-card-pad`, `.s-card-header`, `.kpi-block`, `.stat-tile`, `.bar-row`, `.bar`, `.overton-row`, `.sit-card`, `.tier`, `.heatmap`, `.tbl`, `.kv`, `.layer-tabs`, `.s-chip`, `.s-tag`, `.faction-bar`, `.spark`. The `s-` prefix is used where the bare name might collide with Tailwind. Theme variables (`--bg-2`, `--accent-soft`, `--good`, `--crit-soft`, etc.) live on `:root[data-theme=…]`; *all three* themes must define every variable for cards to render correctly across themes.

## Common gotchas

1. **GitHub Pages CDN caches stable paths** (~10 min). Hashed Vite filenames solve JS/CSS but JSON is at stable paths — that's why we cache-bust on `meta.synced_at`. Don't remove the bust.
2. **`/export?format=xlsx` is undocumented.** Sometimes 429s. Sync script retries with backoff (5s/15s/45s). Three failures = exit non-zero = Telegram ping.
3. **GitHub cron drifts 5–15 min, occasionally skips.** That's why we surface the last-sync chip in nav. Don't promise "every hour exactly."
4. **Dark theme contrast.** Amber on near-black needs measurement to hit WCAG AA. The Playwright + axe job fails the build if it slips.
5. **Sub-faction range disagreement.** CLAUDE.md (backend) says rows 32-44; built workbook has it at U24:AC36. Trust the live Sheet over the docs. The extractor reads `SubFactionsBlock` named range — keep that pinned to wherever the live data actually lives.
6. **`partial_failures` in meta.json.** When an extractor crashes, sync continues without that page. Frontend reads `meta.partial_failures` and can show "this page failed to sync" — not implemented yet, just the data path is there.
7. **Svelte 4 `{@const}` placement.** `{@const}` must be the immediate child of `{#if}/{:else}/{#each}/<svelte:fragment>` etc — NOT inside an arbitrary HTML element. If you need a derived value inside a div, compute it via `$:` reactive in the script block.
8. **Tri-state theme system.** Three modes: `light` (Calm), `dark` (Cosmic), `schematic` (blueprint navy on cream). Adding/renaming one means touching FOUR places in lockstep: `THEMES` array in `src/lib/theme.js`, the `:root[data-theme=…]` block in `src/styles/global.css`, the pre-hydration validator in `index.html`, and the `THEMES` list in `tests-e2e/a11y.spec.js`. The toggle is a segmented pill (☀ ☾ ⊞), not a binary swap.
9. **`MoonLoader` is the canonical loading state; `MoonBackdrop` is the always-on ambient layer.** Both live in `src/lib/components/`. The loader is foreground (role="status", labelled, full opacity); the backdrop is fixed-position, viewport-responsive, low-opacity, `aria-hidden`, sits at `z-0` behind a `z-10` content wrapper in `App.svelte`. Both share the same canvas component — pass `decorative` to suppress ARIA + sr-only label and to honour `prefers-reduced-motion`. The texture (`src/lib/assets/moon-equirect.png`) is a Vite-bundled asset (NOT in `public/`) so it gets hashed and cache-busted with the rest of the build.
10. **Pre-existing fixture/extractor drift.** `tests/fixtures/build_test_workbook.py` lags behind a few extractors (notably `gois.py` reads Politics rows 4-11; the fixture writes the GoI block at rows 24-31 — and `status.py` reads `Colony!B3` for treasury but the fixture sets it at `B1`). 9 tests fail on `main` because of this. Don't try to "fix" it as a side project — patch only the pieces you actively need (e.g. when I added Var_Year I also added `Stability`/`CrisisFactor`/`SubFaction*` named ranges so `run_sync` could complete, but didn't fix the GoI block layout).
11. **History sparkline minimum.** `Sparkline.svelte` only renders the line+area when `data.length >= 2`. With one sample it shows "single sample"; with zero, "no history". Don't pass empty arrays expecting an empty SVG.
12. **`GITHUB_TOKEN`-authored pushes don't trigger downstream `push` workflows.** GitHub's anti-recursion safeguard. The hourly Sync commits new JSON to `public/data/` using the default token, so the `Deploy to GitHub Pages` workflow's `push` trigger never fires from a sync commit — meaning data sits on `main` but isn't in the served `dist/`. Fix: `deploy-pages.yml` also has a `workflow_run` trigger chained to `Sync sheet → JSON` completion (gated by `conclusion == 'success'`). If you add another workflow that needs to react to sync commits, do the same — don't rely on `push`.
13. **Canvas 2D `fillStyle` does NOT resolve `var(--…)` custom properties** — neither standalone nor nested inside `color-mix()`. The assignment is silently ignored, leaving the previous valid fillStyle in place (or default black). Always pre-resolve theme tokens via `getComputedStyle(canvasOrRoot).getPropertyValue('--…').trim()` and substitute concrete strings before handing to canvas. `MoonLoader.svelte` and `MapCanvas.svelte` both do this. Note: canvas redraws are NOT currently triggered by theme changes — they only fire on data/layer changes — so a theme flip leaves stale colours baked in until the next redraw. Default theme is `schematic` (set in `src/lib/theme.js` and `index.html`'s `data-theme` attribute).

## Where to read more

- Spec: `docs/superpowers/specs/2026-05-01-scorp-dashboard-design.md`
- Plan: `docs/superpowers/plans/2026-05-01-scorp-dashboard-implementation.md`
- Backend: `../scorp_colony/CLAUDE.md`
