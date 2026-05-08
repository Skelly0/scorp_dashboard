# Trashed files

- `visual-check.mjs` — moved to TRASH/ — one-off Playwright script used to screenshot all three themes during the moon-loader integration; superseded by the regular e2e suite. Keep until rotation has been ratified, then delete.
- `test-results/` — moved to TRASH/ — playwright artifact directory from a single failing run; regenerated on every `playwright test`. Now covered by `.gitignore`.
- `verify_growth_col.py` — moved to TRASH/ — one-off Python Playwright stub for verifying the Demographics Growth/turn column; superseded by the .mjs version (Python playwright wasn't installed). Safe to delete.
- `verify_growth_col.mjs` — moved to TRASH/ — one-off Node Playwright script that confirmed the new Growth/turn column rendered correctly between Mortality and Deaths/turn. Safe to delete.
- `verify_mobility.mjs` — moved to TRASH/ — one-off Node Playwright script that confirmed the new Mobility In / Mobility Out columns render between Deaths/turn and Demand with values populated. Safe to delete.
- `mobility-cols.png` — moved to TRASH/ — screenshot from `verify_mobility.mjs` showing the populated Mobility columns. Safe to delete.
- `test-map-icons.mjs` — moved to TRASH/ — one-off Node Playwright script that confirmed improvement icons render in every map mode (terrain, yields, resources, features, improvements) after the all-modes change. Safe to delete.
- `test-map-icons.py` — moved to TRASH/ — abandoned Python variant of the same check; Python Playwright wasn't installed. Safe to delete.
