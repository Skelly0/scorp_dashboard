# SCORP Colony Player Dashboard

Player-facing static dashboard for the SCORP Colony tabletop campaign. Reads from a live Google Sheet (the export-public mirror of the `scorp_colony` GM workbook), syncs hourly via GitHub Action, and serves a 10-route Svelte SPA on GitHub Pages.

**Live:** `https://<your-user>.github.io/scorp_dashboard/` (set after first deploy)

**Spec:** `docs/superpowers/specs/2026-05-01-scorp-dashboard-design.md`
**Implementation plan:** `docs/superpowers/plans/2026-05-01-scorp-dashboard-implementation.md`

## Quick start (local dev)

```bash
# Python (sync side)
uv sync

# Frontend
npm install

# Generate sample data from the test fixture
uv run python tests/fixtures/build_test_workbook.py /tmp/test_wb.xlsx
uv run python scripts/sync_sheet.py --xlsx /tmp/test_wb.xlsx --out-dir public/data

# Dev server
npm run dev
```

## Tests

```bash
make test   # runs pytest + vitest

# E2E + a11y (slower)
npx playwright install chromium   # one-time browser install
npm run test:e2e
```

## Deployment (one-time setup)

1. Create the GitHub repo and push.
2. **Settings → Pages → Source:** "GitHub Actions".
3. **Settings → Variables and Secrets → Actions:**
   - **Variable** `SHEET_ID` = the Google Sheet ID.
   - **Secrets** (optional) `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` for failure notifications.
4. Push to main. The two workflows do the rest:
   - `sync.yml` runs hourly + on demand → writes JSON → commits.
   - `deploy-pages.yml` fires on `main` pushes (path-filtered) → builds → publishes.

## Pages (9 routes, Senate gated)

| Page | Route | Notes |
|---|---|---|
| Status | `/` | Treasury, Stab/Crisis, resources, Overton, situations banner |
| Map | `/#/map` | 40×40 interactive, terrain base + icons + heatmap toggle |
| Demographics | `/#/demographics` | Pop/housing/food vitals + Class Vitals table with click-to-drilldown per-class detail (population share, worldview, income, wealth, status, workforce) |
| Cropsim | `/#/cropsim` | Food supply, class demand, production mix, and food-security balance |
| GoIs | `/#/gois` | 4 panels + sub-factions + PopCapture matrix |
| Tech | `/#/tech` | Research tree, unlock states, and active-effect signalling |
| Parties | `/#/parties` | Founded parties + class support splits + GoI/Class compat heatmaps |
| Senate | `/#/senate` | **Sheet-flag gated.** Coalitions + GoI capture % |
| Situations | `/#/situations` | Active/ended + Stability Modifiers + Tier Ladder |

## Manual operations

- **Force a sync after a turn:** Actions → Sync sheet → JSON → Run workflow.
- **Toggle Senate visibility:** Edit `Var_SenatePageVisible` in the Sheet's `Variable` tab. Next sync will (un)publish `senate.json` and the nav entry.
- **Bump `schema_version`:** Edit `SCHEMA_VERSION` in `scripts/sync_sheet.py` AND `EXPECTED_SCHEMA_VERSION` in `src/lib/stores/meta.js`. The frontend will hard-fail with a maintenance banner if they disagree, so deploy these in lockstep.

## Privacy caveats

The Google Sheet is link-public. **Anyone with the URL can read the raw GM data.** The dashboard's data filter is the boundary against *casual* discovery, not adversaries.

The Senate page's "real privacy boundary" is real *while the flag is OFF and has been OFF since the data existed*. **Caveat: git history is permanent.** Once `senate.json` has been committed, it lives in the repo's commit history forever. Toggling the flag OFF after the fact does not retroactively unpublish it. Plan toggles BEFORE the data exists in the workbook, or maintain a separate squashed branch for Pages.

## Best-effort cron caveat

GitHub's scheduled cron is best-effort. Hourly runs typically land within 5–15 minutes of `:07`, but can drift further or skip under load. The "Synced HH:MM UTC" chip in the dashboard nav turns red when stale > 3 h so you can see this without checking Actions.

## Theme toggle

Light (default) is "Console Cream"; dark is "Mission Brutalist". Toggle in the nav. Preference persists in localStorage. There is NO flash of wrong theme on reload (a tiny inline script in `index.html` reads localStorage before Svelte hydrates).

## Backend prerequisites

The dashboard depends on the upstream `scorp_colony` workbook. See spec §2.1 for the full list. Wave 1 minimum:
- `Var_SenatePageVisible` named cell on the `Variable` sheet.

Wave 2 (for Situations page to populate):
- `Situations` sheet (S6 format)
- `Stability Modifiers` sheet
- `Tier Ladder` sheet

## License

(GM tool — internal use)
