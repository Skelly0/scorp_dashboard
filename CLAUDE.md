# SCORP Colony Player Dashboard — Frontend Companion

Static Svelte SPA + Python sync pipeline that surfaces a player-facing read of the `scorp_colony` GM workbook. Hosted on GitHub Pages, refreshed hourly via GitHub Action that pulls the Google Sheet's xlsx export.

## Architecture in one breath

GitHub Action → openpyxl → per-page JSON in `public/data/` → git commit → Pages rebuild → Svelte SPA fetches.

## Layout

- `scripts/` — Python sync (entry: `sync_sheet.py`; per-page extractors in `extractors/`)
- `src/` — Svelte SPA (one route per page, one store per page, shared components in `src/lib/components/`)
- `public/data/` — JSON output (managed by the Action; don't hand-edit)
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

## Common gotchas

1. **GitHub Pages CDN caches stable paths** (~10 min). Hashed Vite filenames solve JS/CSS but JSON is at stable paths — that's why we cache-bust on `meta.synced_at`. Don't remove the bust.
2. **`/export?format=xlsx` is undocumented.** Sometimes 429s. Sync script retries with backoff (5s/15s/45s). Three failures = exit non-zero = Telegram ping.
3. **GitHub cron drifts 5–15 min, occasionally skips.** That's why we surface the last-sync chip in nav. Don't promise "every hour exactly."
4. **Dark theme contrast.** Amber on near-black needs measurement to hit WCAG AA. The Playwright + axe job fails the build if it slips.
5. **Sub-faction range disagreement.** CLAUDE.md (backend) says rows 32-44; built workbook has it at U24:AC36. Trust the live Sheet over the docs. The extractor reads `SubFactionsBlock` named range — keep that pinned to wherever the live data actually lives.
6. **`partial_failures` in meta.json.** When an extractor crashes, sync continues without that page. Frontend reads `meta.partial_failures` and can show "this page failed to sync" — not implemented yet, just the data path is there.
7. **Svelte 4 `{@const}` placement.** `{@const}` must be the immediate child of `{#if}/{:else}/{#each}/<svelte:fragment>` etc — NOT inside an arbitrary HTML element. If you need a derived value inside a div, compute it via `$:` reactive in the script block.
8. **Tri-state theme system.** Three modes: `light` (Calm), `dark` (Cosmic), `schematic` (blueprint navy on cream). Adding/renaming one means touching FOUR places in lockstep: `THEMES` array in `src/lib/theme.js`, the `:root[data-theme=…]` block in `src/styles/global.css`, the pre-hydration validator in `index.html`, and the `THEMES` list in `tests-e2e/a11y.spec.js`. The toggle is a segmented pill (☀ ☾ ⊞), not a binary swap.
9. **`MoonLoader` is the canonical loading state.** `src/lib/components/MoonLoader.svelte` reads `$theme` and adapts contour palette + spin speed automatically. The texture (`src/lib/assets/moon-equirect.png`) is a Vite-bundled asset (NOT in `public/`) so it gets hashed and cache-busted with the rest of the build.

## Where to read more

- Spec: `docs/superpowers/specs/2026-05-01-scorp-dashboard-design.md`
- Plan: `docs/superpowers/plans/2026-05-01-scorp-dashboard-implementation.md`
- Backend: `../scorp_colony/CLAUDE.md`
