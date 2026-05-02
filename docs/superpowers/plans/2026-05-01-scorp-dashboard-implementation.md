# SCORP Colony Player Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static, player-facing web dashboard hosted on GitHub Pages that surfaces a curated subset of the SCORP Colony GM workbook, refreshed hourly via a GitHub Action that downloads the live Google Sheet, parses it with openpyxl, and dumps per-page JSON.

**Architecture:** Sibling repo `scorp_dashboard/` next to `scorp_colony/`. Two halves sharing one JSON contract: (1) a Python sync pipeline (cron-triggered Action → openpyxl → JSON in `public/data/` → git commit → Pages deploy), and (2) a Svelte SPA (Vite-built) that fetches that JSON and renders 8 pages with two themes. Privacy boundary at extraction time: Senate page JSON is only written when a sheet flag is TRUE.

**Tech Stack:**
- **Sync:** Python 3.11+, openpyxl, requests, pytest. Pinned in `pyproject.toml`. uv-managed.
- **Frontend:** Svelte 4 (Vite SPA, no SvelteKit), TailwindCSS, svelte-spa-router (hash routing — works on Pages without server config), Vitest + @testing-library/svelte for unit tests, Playwright + axe-core for E2E + a11y.
- **Fonts:** `@fontsource/jetbrains-mono` + `@fontsource/ibm-plex-mono`.
- **CI/CD:** GitHub Actions (cron sync + Pages deploy), pinned action versions.

**Spec:** `docs/superpowers/specs/2026-05-01-scorp-dashboard-design.md` (read this first).

---

## Patterns used throughout this plan

**Commit message style** (mirrors `scorp_colony` convention):
- `feat(area): summary` for new features
- `fix(area): summary` for bug fixes
- `test(area): summary` for tests-only commits
- `chore(area): summary` for tooling/config
- `docs(area): summary` for documentation
- First line under 70 chars; body for details. One task per commit unless explicitly bundled.

**Selective `git add`**: Always add files by name. Never `git add -A` or `git add .`.

**Python test invocation** (assumes uv): `uv run pytest tests/<path> -v`

**Svelte/Vitest invocation**: `npm run test -- <path>`

**Atomic-write pattern for JSON files** (used by sync script):

```python
def write_json_atomic(path: Path, data: dict) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True))
    tmp.replace(path)
```

**Named-range reader** (used by every extractor):

```python
def read_named_range(wb, name: str) -> list[list]:
    """Resolve a named range to a list-of-lists of values. Returns [] if missing."""
    if name not in wb.defined_names:
        return []
    dn = wb.defined_names[name]
    rows = []
    for sheet_name, ref in dn.destinations:
        ws = wb[sheet_name]
        for row in ws[ref]:
            rows.append([cell.value for cell in row])
    return rows
```

---

## Phase 1: End-to-end MVP

Goal of this phase: a deployed dashboard that renders the **Status page** with real data from the live Sheet, with the full sync pipeline + theme system + nav + privacy gate working. Everything but the other 7 pages.

### Task 1: Initialise repo + Python project scaffold

**Files:**
- Create: `pyproject.toml`
- Create: `.gitignore`
- Create: `README.md` (stub)
- Create: `Makefile`

- [ ] **Step 1: Initialise git**

```bash
cd "C:/Users/skell/OneDrive/Obsidian/SCORP/SCORP 2.5/scorp_dashboard"
git init -b main
```

- [ ] **Step 2: Write `pyproject.toml`**

```toml
[project]
name = "scorp-dashboard"
version = "0.1.0"
description = "Player-facing dashboard for SCORP Colony — syncs Google Sheet to JSON for static frontend"
requires-python = ">=3.11"
dependencies = [
    "openpyxl==3.1.5",
    "requests==2.32.3",
]

[dependency-groups]
dev = [
    "pytest==8.3.3",
    "pytest-cov==5.0.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["scripts"]
```

- [ ] **Step 3: Write `.gitignore`**

```
# Python
.venv/
__pycache__/
*.pyc
.pytest_cache/
.coverage
htmlcov/

# Node
node_modules/
dist/
.vite/

# Editor
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Local sync output (only the Action commits to public/data/)
public/data/*.json.tmp
```

- [ ] **Step 4: Write `README.md` stub**

```markdown
# SCORP Colony Player Dashboard

A static player-facing dashboard for the SCORP Colony tabletop campaign. Reads from a live Google Sheet on an hourly cron and renders 8 pages on GitHub Pages.

See `docs/superpowers/specs/2026-05-01-scorp-dashboard-design.md` for the design.

## Quick start

(Coming soon — see implementation plan.)
```

- [ ] **Step 5: Write `Makefile`**

```makefile
.PHONY: install sync test lint clean dev build

install:
	uv sync
	npm install

sync:
	uv run python scripts/sync_sheet.py

test:
	uv run pytest -v
	npm run test -- --run

dev:
	npm run dev

build:
	npm run build

clean:
	rm -rf dist node_modules .pytest_cache htmlcov .coverage
```

- [ ] **Step 6: Verify uv installs cleanly**

```bash
uv sync
```

Expected: creates `.venv/` and `uv.lock`. No errors.

- [ ] **Step 7: Commit**

```bash
git add pyproject.toml .gitignore README.md Makefile uv.lock
git commit -m "chore: initialise scorp_dashboard repo with python scaffold"
```

---

### Task 2: Frontend project scaffold (Svelte + Vite + Tailwind)

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `svelte.config.js`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/App.svelte`
- Create: `src/styles/global.css`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "scorp-dashboard-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "3.1.2",
    "@testing-library/svelte": "5.2.4",
    "autoprefixer": "10.4.20",
    "jsdom": "25.0.1",
    "postcss": "8.4.47",
    "svelte": "4.2.19",
    "tailwindcss": "3.4.13",
    "vite": "5.4.8",
    "vitest": "2.1.2"
  },
  "dependencies": {
    "@fontsource/ibm-plex-mono": "5.1.0",
    "@fontsource/jetbrains-mono": "5.1.1",
    "svelte-spa-router": "4.0.1"
  }
}
```

- [ ] **Step 2: Write `vite.config.js`**

```javascript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

- [ ] **Step 3: Write `svelte.config.js`**

```javascript
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
};
```

- [ ] **Step 4: Write `tailwind.config.js`**

```javascript
export default {
  content: ['./index.html', './src/**/*.{svelte,js}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'Consolas', 'monospace'],
      },
      colors: {
        bg: 'var(--bg)',
        fg: 'var(--fg)',
        accent: 'var(--accent)',
        border: 'var(--border)',
        muted: 'var(--muted)',
        crit: 'var(--crit)',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5: Write `postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="en" data-theme="light">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Colony Status</title>
    <script>
      // Pre-hydration theme set — avoid flash of wrong theme
      (function () {
        try {
          var t = localStorage.getItem('theme');
          if (t === 'dark' || t === 'light') {
            document.documentElement.dataset.theme = t;
          }
        } catch (e) {}
      })();
    </script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 7: Write `src/main.js`**

```javascript
import App from './App.svelte';
import './styles/global.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

const app = new App({
  target: document.getElementById('app'),
});

export default app;
```

- [ ] **Step 8: Write `src/App.svelte`**

```svelte
<script>
  // Placeholder — NavBar + router come in later tasks.
</script>

<main class="min-h-screen bg-bg text-fg font-mono p-8">
  <h1 class="text-2xl font-bold">SCORP Colony Dashboard</h1>
  <p class="opacity-60 text-sm mt-2">Scaffolded. Pages coming soon.</p>
</main>
```

- [ ] **Step 9: Write `src/styles/global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root[data-theme='light'] {
  --bg: #f3ead4;
  --fg: #1a140a;
  --accent: #c44900;
  --border: #1a140a;
  --muted: #6b5a3a;
  --crit: #c44900;
  --grid-line: #1a140a;
  --alert-bg: #1a140a;
  --alert-fg: #f3ead4;
}

:root[data-theme='dark'] {
  --bg: #0d0a05;
  --fg: #f3e9d2;
  --accent: #ffb000;
  --border: #f3a000;
  --muted: #b89255;
  --crit: #ff4040;
  --grid-line: #f3a000;
  --alert-bg: #f3a000;
  --alert-fg: #0d0a05;
}

html,
body {
  background: var(--bg);
  color: var(--fg);
}
```

- [ ] **Step 10: Install + verify dev server boots**

```bash
npm install
npm run dev
```

Expected: server prints a localhost URL; opening it shows "SCORP Colony Dashboard" on a cream background. Kill the server.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json vite.config.js svelte.config.js tailwind.config.js postcss.config.js index.html src/main.js src/App.svelte src/styles/global.css
git commit -m "chore: scaffold svelte+vite+tailwind frontend"
```

---

### Task 3: Common extractor helpers + named-range reader

**Files:**
- Create: `scripts/__init__.py`
- Create: `scripts/extractors/__init__.py`
- Create: `scripts/extractors/_common.py`
- Create: `tests/__init__.py`
- Create: `tests/extractors/__init__.py`
- Create: `tests/extractors/test_common.py`
- Create: `tests/fixtures/__init__.py`
- Create: `tests/fixtures/build_test_workbook.py`

- [ ] **Step 1: Write the failing test**

`tests/extractors/test_common.py`:

```python
"""Tests for extractor common helpers."""
from __future__ import annotations

from pathlib import Path

import openpyxl
import pytest

from extractors._common import (
    coerce_number,
    filter_blank_rows,
    read_named_range,
)


@pytest.fixture
def wb():
    """Tiny workbook with one named range and a blank-slot row."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    # A1:C3 grid with a blank middle row.
    ws["A1"], ws["B1"], ws["C1"] = "Alpha", 1.5, "x"
    ws["A2"], ws["B2"], ws["C2"] = "", "", ""
    ws["A3"], ws["B3"], ws["C3"] = "Bravo", 2.5, "y"
    dn = openpyxl.workbook.defined_name.DefinedName("MyRange", attr_text="Sheet1!$A$1:$C$3")
    wb.defined_names["MyRange"] = dn
    return wb


def test_read_named_range_returns_rows(wb):
    rows = read_named_range(wb, "MyRange")
    assert rows == [
        ["Alpha", 1.5, "x"],
        ["", "", ""],
        ["Bravo", 2.5, "y"],
    ]


def test_read_named_range_missing_returns_empty(wb):
    assert read_named_range(wb, "Nonexistent") == []


def test_filter_blank_rows_removes_empty_first_col(wb):
    rows = read_named_range(wb, "MyRange")
    filtered = filter_blank_rows(rows)
    assert filtered == [
        ["Alpha", 1.5, "x"],
        ["Bravo", 2.5, "y"],
    ]


def test_coerce_number_handles_floats():
    assert coerce_number(1.5) == 1.5
    assert coerce_number(0) == 0.0


def test_coerce_number_returns_none_for_blanks():
    assert coerce_number(None) is None
    assert coerce_number("") is None


def test_coerce_number_returns_none_for_formula_errors():
    assert coerce_number("#REF!") is None
    assert coerce_number("#NAME?") is None
    assert coerce_number("#VALUE!") is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest tests/extractors/test_common.py -v
```

Expected: FAIL with `ModuleNotFoundError: extractors`.

- [ ] **Step 3: Write `scripts/__init__.py`** (empty file).

- [ ] **Step 4: Write `scripts/extractors/__init__.py`** (empty file).

- [ ] **Step 5: Write `scripts/extractors/_common.py`**

```python
"""Shared helpers for sheet extractors."""
from __future__ import annotations

from typing import Any

FORMULA_ERROR_SENTINELS = {
    "#REF!",
    "#NAME?",
    "#VALUE!",
    "#DIV/0!",
    "#N/A",
    "#NULL!",
    "#NUM!",
}


def read_named_range(wb, name: str) -> list[list[Any]]:
    """Resolve a named range to a list-of-lists of cell values.

    Returns [] when the name does not exist (caller decides whether that's fatal).
    """
    if name not in wb.defined_names:
        return []
    dn = wb.defined_names[name]
    rows: list[list[Any]] = []
    for sheet_name, ref in dn.destinations:
        ws = wb[sheet_name]
        for row in ws[ref]:
            rows.append([cell.value for cell in row])
    return rows


def filter_blank_rows(rows: list[list[Any]]) -> list[list[Any]]:
    """Drop rows whose first column is empty/None — convention for blank slots."""
    return [r for r in rows if r and r[0] not in (None, "")]


def coerce_number(value: Any) -> float | None:
    """Cast to float; None for blanks and formula-error sentinels."""
    if value is None or value == "":
        return None
    if isinstance(value, str) and value in FORMULA_ERROR_SENTINELS:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
```

- [ ] **Step 6: Write `tests/__init__.py`** (empty file).

- [ ] **Step 7: Write `tests/extractors/__init__.py`** (empty file).

- [ ] **Step 8: Write `tests/fixtures/__init__.py`** (empty file).

- [ ] **Step 9: Run tests to verify they pass**

```bash
uv run pytest tests/extractors/test_common.py -v
```

Expected: 6 tests PASS.

- [ ] **Step 10: Commit**

```bash
git add scripts/__init__.py scripts/extractors/__init__.py scripts/extractors/_common.py tests/__init__.py tests/extractors/__init__.py tests/fixtures/__init__.py tests/extractors/test_common.py
git commit -m "feat(sync): add common extractor helpers (named range, blank filter, numeric coerce)"
```

---

### Task 4: Test-fixture workbook builder

**Files:**
- Create: `tests/fixtures/build_test_workbook.py`
- Create: `tests/conftest.py`

- [ ] **Step 1: Write `tests/fixtures/build_test_workbook.py`**

This script generates a minimal-but-realistic xlsx that mirrors the live workbook's named ranges, used by every extractor test. Generated on demand; never committed (output goes to `/tmp` or `tests/fixtures/_generated/`).

```python
"""Build a minimal test workbook that mirrors the live SCORP Colony schema.

Used as a fixture by extractor tests. Not committed — regenerated on each test run.
"""
from __future__ import annotations

from pathlib import Path

import openpyxl
from openpyxl.workbook.defined_name import DefinedName


def build(out_path: Path) -> Path:
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # ---- Reference sheet ----
    ref = wb.create_sheet("Reference")
    ref["A1"] = "ClassTable"
    # ClassTable: Name, Tier, StartingPop, PoliticalWeight (cols A-D from row 56-70 in real wb;
    # we just need the shape — 15 rows, 11 live + 4 blank).
    classes = [
        ("Bureaucrats", "Upper", 970, 3.0),
        ("Capitalists", "Upper", 220, 5.0),
        ("Engineers", "Middle", 1115, 2.0),
        ("Scientists", "Middle", 1790, 2.5),
        ("Security", "Middle", 1040, 1.5),
        ("Proprietors", "Middle", 295, 1.5),
        ("Managerial", "Middle", 295, 2.5),
        ("Agricultural Workers", "Lower", 1115, 0.8),
        ("Industrial Workers", "Lower", 4170, 0.8),
        ("Service Workers", "Lower", 3870, 0.7),
        ("Skilled Tradesmen", "Lower", 990, 0.9),
    ]
    for i, (name, tier, pop, weight) in enumerate(classes, start=56):
        ref.cell(row=i, column=1, value=name)
        ref.cell(row=i, column=2, value=tier)
        ref.cell(row=i, column=3, value=pop)
        ref.cell(row=i, column=4, value=weight)
    # 4 blank reserved slots (rows 67-70 already empty by default).

    _add_name(wb, "ClassTable", "Reference!$A$56:$D$70")

    # ---- Variable sheet ----
    var = wb.create_sheet("Variable")
    var["A1"], var["B1"] = "Var_SenatePageVisible", False
    _add_name(wb, "Var_SenatePageVisible", "Variable!$B$1")

    # ---- Politics sheet ----
    pol = wb.create_sheet("Politics")
    pol["B1"] = 0.42      # Stability
    pol["E1"] = 0.38      # Crisis Factor
    # Overton window B13:B18
    overton = [5.0, 4.5, 5.0, 4.0, 4.0, 4.0]
    for i, v in enumerate(overton, start=13):
        pol.cell(row=i, column=2, value=v)
    _add_name(wb, "OvertonExpn", "Politics!$B$13")
    _add_name(wb, "OvertonAuth", "Politics!$B$14")
    _add_name(wb, "OvertonCorp", "Politics!$B$15")
    _add_name(wb, "OvertonTech", "Politics!$B$16")
    _add_name(wb, "OvertonFaith", "Politics!$B$17")
    _add_name(wb, "OvertonMat", "Politics!$B$18")

    # ---- Colony sheet (Treasury + resources) ----
    col = wb.create_sheet("Colony")
    col["A1"], col["B1"] = "Money", 487
    col["A2"], col["B2"] = "Money_Delta", -12
    resources = [
        ("Food", 0, -2),
        ("Materials", 200, -4),
        ("Ore", 100, 0),
        ("Energy", 50, 0),
        ("Housing", -500, 0),
        ("He-3", 0, 1),
        ("Water", 60, -1),
    ]
    for i, (name, current, delta) in enumerate(resources, start=4):
        col.cell(row=i, column=1, value=name)
        col.cell(row=i, column=2, value=current)
        col.cell(row=i, column=3, value=delta)
    _add_name(wb, "TreasuryMoney", "Colony!$B$1")
    _add_name(wb, "TreasuryMoneyDelta", "Colony!$B$2")
    _add_name(wb, "ResourceFlows", "Colony!$A$4:$C$10")

    # ---- Popsim sheet ----
    pop = wb.create_sheet("Popsim")
    # Just enough to satisfy population total derivation. PopsimPop = B5:B19
    for i, (name, _, p, _w) in enumerate(classes, start=5):
        pop.cell(row=i, column=1, value=name)
        pop.cell(row=i, column=2, value=p)
    _add_name(wb, "PopsimPop", "Popsim!$B$5:$B$19")

    wb.save(out_path)
    return out_path


def _add_name(wb, name: str, attr_text: str) -> None:
    wb.defined_names[name] = DefinedName(name, attr_text=attr_text)


if __name__ == "__main__":
    import sys
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("test_workbook.xlsx")
    build(out)
    print(f"Wrote {out}")
```

- [ ] **Step 2: Write `tests/conftest.py`**

```python
"""Shared pytest fixtures."""
from __future__ import annotations

from pathlib import Path

import openpyxl
import pytest

from tests.fixtures.build_test_workbook import build as build_fixture


@pytest.fixture(scope="session")
def fixture_workbook_path(tmp_path_factory) -> Path:
    """Build the test workbook once per test session."""
    out = tmp_path_factory.mktemp("fixture") / "test_workbook.xlsx"
    return build_fixture(out)


@pytest.fixture
def wb(fixture_workbook_path):
    """Open the fixture workbook fresh for each test (no shared state)."""
    return openpyxl.load_workbook(fixture_workbook_path, data_only=True)
```

- [ ] **Step 3: Verify fixture builds**

```bash
uv run python tests/fixtures/build_test_workbook.py /tmp/check.xlsx
ls -la /tmp/check.xlsx
```

Expected: file exists, non-zero size.

- [ ] **Step 4: Add a smoke test to confirm the fixture is usable**

Append to `tests/extractors/test_common.py`:

```python
def test_fixture_workbook_loads(wb):
    """Sanity: fixture loads with expected named ranges."""
    assert "ClassTable" in wb.defined_names
    assert "Var_SenatePageVisible" in wb.defined_names
    assert "PopsimPop" in wb.defined_names
```

- [ ] **Step 5: Run tests**

```bash
uv run pytest tests/ -v
```

Expected: 7 tests pass (the new smoke test + the 6 from Task 3).

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/build_test_workbook.py tests/conftest.py tests/extractors/test_common.py
git commit -m "test(sync): add fixture workbook builder and conftest"
```

---

### Task 5: Schema validator

**Files:**
- Create: `scripts/validate_schema.py`
- Create: `tests/test_validate_schema.py`

- [ ] **Step 1: Write the failing test**

`tests/test_validate_schema.py`:

```python
"""Tests for the schema validator."""
from __future__ import annotations

import pytest

from validate_schema import (
    BASE_REQUIRED_RANGES,
    SENATE_REQUIRED_RANGES,
    SchemaValidationError,
    validate,
)


def test_validate_passes_when_all_base_ranges_present(wb):
    # The fixture wb has the base ranges by construction.
    validate(wb, senate_enabled=False)


def test_validate_fails_when_base_range_missing(wb):
    del wb.defined_names["PopsimPop"]
    with pytest.raises(SchemaValidationError, match="PopsimPop"):
        validate(wb, senate_enabled=False)


def test_validate_skips_senate_ranges_when_disabled(wb):
    # Senate-specific ranges are NOT in fixture; validation should still pass when disabled.
    validate(wb, senate_enabled=False)


def test_validate_requires_senate_ranges_when_enabled(wb):
    # Fixture lacks Coalitions etc., so enabling Senate should fail.
    with pytest.raises(SchemaValidationError):
        validate(wb, senate_enabled=True)


def test_base_required_includes_var_senate_page_visible():
    assert "Var_SenatePageVisible" in BASE_REQUIRED_RANGES


def test_senate_required_lists_coalitions_named_range():
    # Document the contract: coalitions data lives behind a named range
    # (or, if not, a sheet name string starting with "Coalitions").
    assert any("Coalition" in r for r in SENATE_REQUIRED_RANGES)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest tests/test_validate_schema.py -v
```

Expected: FAIL with `ModuleNotFoundError: validate_schema`.

- [ ] **Step 3: Write `scripts/validate_schema.py`**

```python
"""Schema validator: verifies the workbook has every named range the extractors need.

Runs after the Senate flag has been read so Senate-specific ranges can be
conditionally required.
"""
from __future__ import annotations


class SchemaValidationError(Exception):
    """Raised when the workbook is missing one or more required named ranges."""


# Named ranges that every sync run requires regardless of Senate flag.
# Add to this list when a new extractor relies on a new range.
BASE_REQUIRED_RANGES: list[str] = [
    # Variable sheet
    "Var_SenatePageVisible",
    # Reference
    "ClassTable",
    # Popsim
    "PopsimPop",
    # Politics — Overton
    "OvertonExpn",
    "OvertonAuth",
    "OvertonCorp",
    "OvertonTech",
    "OvertonFaith",
    "OvertonMat",
    # Colony — treasury + resources
    "TreasuryMoney",
    "TreasuryMoneyDelta",
    "ResourceFlows",
]

# Ranges only required when Senate page is enabled.
SENATE_REQUIRED_RANGES: list[str] = [
    "CoalitionsBlock",
]


def validate(wb, *, senate_enabled: bool) -> None:
    """Raise SchemaValidationError if any required named range is missing."""
    required = list(BASE_REQUIRED_RANGES)
    if senate_enabled:
        required.extend(SENATE_REQUIRED_RANGES)

    missing = [name for name in required if name not in wb.defined_names]
    if missing:
        raise SchemaValidationError(
            f"Workbook missing required named ranges: {', '.join(sorted(missing))}"
        )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/test_validate_schema.py -v
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate_schema.py tests/test_validate_schema.py
git commit -m "feat(sync): schema validator with conditional senate-range requirement"
```

---

### Task 6: Telegram failure notifier

**Files:**
- Create: `scripts/notify_telegram.py`
- Create: `tests/test_notify_telegram.py`

- [ ] **Step 1: Write the failing test**

`tests/test_notify_telegram.py`:

```python
"""Tests for the Telegram failure notifier."""
from __future__ import annotations

import pytest

from notify_telegram import build_message, send


def test_build_message_includes_run_url_and_summary():
    msg = build_message(
        summary="Schema validation failed: missing PopsimPop",
        run_url="https://github.com/u/r/actions/runs/123",
    )
    assert "Schema validation failed" in msg
    assert "PopsimPop" in msg
    assert "https://github.com/u/r/actions/runs/123" in msg
    assert "scorp_dashboard sync" in msg.lower()


def test_send_no_op_when_token_missing(monkeypatch):
    """When token/chat env vars are absent, send() must not raise."""
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
    # Should silently no-op — failure-on-failure is a worse experience than no notification.
    send("any message")


def test_send_posts_to_telegram_api(monkeypatch):
    """When env vars are present, send() POSTs to the right URL with the right body."""
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "abc:123")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "999")
    posted = {}

    def fake_post(url, json, timeout):
        posted["url"] = url
        posted["json"] = json
        posted["timeout"] = timeout

        class R:
            status_code = 200

            def raise_for_status(self):
                pass

        return R()

    monkeypatch.setattr("notify_telegram.requests.post", fake_post)

    send("hello")
    assert posted["url"] == "https://api.telegram.org/botabc:123/sendMessage"
    assert posted["json"]["chat_id"] == "999"
    assert posted["json"]["text"] == "hello"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest tests/test_notify_telegram.py -v
```

Expected: FAIL with `ModuleNotFoundError: notify_telegram`.

- [ ] **Step 3: Write `scripts/notify_telegram.py`**

```python
"""Send sync-failure notifications to Telegram. Silent no-op when unconfigured."""
from __future__ import annotations

import logging
import os

import requests

logger = logging.getLogger(__name__)


def build_message(*, summary: str, run_url: str) -> str:
    return (
        "scorp_dashboard sync failed\n"
        f"\n{summary}\n"
        f"\nRun: {run_url}"
    )


def send(text: str) -> None:
    """POST to Telegram if configured. Failures here are logged, never re-raised."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        logger.info("Telegram not configured (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID); skipping")
        return
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text},
            timeout=10,
        )
        r.raise_for_status()
    except Exception as exc:  # noqa: BLE001 — never let notification failure mask the real error
        logger.warning("Telegram notification failed: %s", exc)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/test_notify_telegram.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/notify_telegram.py tests/test_notify_telegram.py
git commit -m "feat(sync): telegram failure notifier (silent no-op when unconfigured)"
```

---

### Task 7: Status page extractor

**Files:**
- Create: `scripts/extractors/status.py`
- Create: `tests/extractors/test_status.py`

- [ ] **Step 1: Write the failing test**

`tests/extractors/test_status.py`:

```python
"""Tests for the Status page extractor."""
from __future__ import annotations

from extractors.status import extract


def test_extract_returns_treasury_block(wb):
    result = extract(wb)
    assert result["treasury"] == {"money": 487, "delta": -12}


def test_extract_returns_stability_and_crisis(wb):
    result = extract(wb)
    assert result["stability"] == 0.42
    assert result["crisis_factor"] == 0.38


def test_extract_returns_population_total(wb):
    result = extract(wb)
    # Sum of fixture's class populations.
    assert result["population_total"] == 15870


def test_extract_returns_resource_flow_strip(wb):
    result = extract(wb)
    resources = result["resources"]
    names = [r["name"] for r in resources]
    assert names == ["Food", "Materials", "Ore", "Energy", "Housing", "He-3", "Water"]
    assert resources[0] == {"name": "Food", "current": 0, "delta": -2}
    assert resources[6] == {"name": "Water", "current": 60, "delta": -1}


def test_extract_returns_overton_window(wb):
    result = extract(wb)
    assert result["overton"] == {
        "expansion": 5.0,
        "authority": 4.5,
        "corporate": 5.0,
        "technocratic": 4.0,
        "faith": 4.0,
        "materialist": 4.0,
    }


def test_extract_active_situations_empty_when_no_situations_sheet(wb):
    """Wave 1: Situations sheet doesn't exist yet — extractor should return [] not crash."""
    result = extract(wb)
    assert result["active_situations"] == []
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest tests/extractors/test_status.py -v
```

Expected: FAIL with `ModuleNotFoundError: extractors.status`.

- [ ] **Step 3: Write `scripts/extractors/status.py`**

```python
"""Extract data for the Status (landing) page."""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, read_named_range

OVERTON_AXES = [
    ("expansion", "OvertonExpn"),
    ("authority", "OvertonAuth"),
    ("corporate", "OvertonCorp"),
    ("technocratic", "OvertonTech"),
    ("faith", "OvertonFaith"),
    ("materialist", "OvertonMat"),
]


def extract(wb) -> dict[str, Any]:
    return {
        "treasury": _treasury(wb),
        "stability": _scalar(wb, "Politics", "B1"),
        "crisis_factor": _scalar(wb, "Politics", "E1"),
        "population_total": _population_total(wb),
        "resources": _resources(wb),
        "overton": _overton(wb),
        "active_situations": _active_situations(wb),
    }


def _treasury(wb) -> dict[str, Any]:
    money = read_named_range(wb, "TreasuryMoney")
    delta = read_named_range(wb, "TreasuryMoneyDelta")
    return {
        "money": coerce_number(money[0][0]) if money else None,
        "delta": coerce_number(delta[0][0]) if delta else None,
    }


def _scalar(wb, sheet: str, cell: str) -> float | None:
    return coerce_number(wb[sheet][cell].value)


def _population_total(wb) -> int:
    rows = read_named_range(wb, "PopsimPop")
    total = 0.0
    for row in rows:
        v = coerce_number(row[0])
        if v is not None:
            total += v
    return int(total)


def _resources(wb) -> list[dict[str, Any]]:
    rows = read_named_range(wb, "ResourceFlows")
    out = []
    for row in rows:
        if not row or row[0] in (None, ""):
            continue
        out.append({
            "name": row[0],
            "current": coerce_number(row[1]),
            "delta": coerce_number(row[2]),
        })
    return out


def _overton(wb) -> dict[str, float | None]:
    return {key: _scalar_named(wb, name) for key, name in OVERTON_AXES}


def _scalar_named(wb, name: str) -> float | None:
    rows = read_named_range(wb, name)
    if not rows or not rows[0]:
        return None
    return coerce_number(rows[0][0])


def _active_situations(wb) -> list[dict[str, Any]]:
    """Return [] if the Wave-2 Situations sheet doesn't exist yet."""
    if "Situations" not in wb.sheetnames:
        return []
    out: list[dict[str, Any]] = []
    ws = wb["Situations"]
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[0] in (None, ""):
            continue
        name, desc, crisis = (row + (None, None, None))[:3]
        if crisis == "Ended":
            continue  # Status banner shows ongoing only.
        out.append({"name": name, "description": desc, "crisis_factor": coerce_number(crisis)})
    return out
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/extractors/test_status.py -v
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/extractors/status.py tests/extractors/test_status.py
git commit -m "feat(sync): status page extractor (treasury/stab/crisis/pop/overton/resources)"
```

---

### Task 8: Sync orchestrator (`sync_sheet.py`)

**Files:**
- Create: `scripts/sync_sheet.py`
- Create: `tests/test_sync_sheet.py`

- [ ] **Step 1: Write the failing test**

`tests/test_sync_sheet.py`:

```python
"""Tests for the sync_sheet orchestrator (logic only — download mocked)."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from sync_sheet import (
    SyncResult,
    read_senate_flag,
    run_sync,
    write_json_atomic,
)


def test_write_json_atomic_creates_file(tmp_path):
    target = tmp_path / "x.json"
    write_json_atomic(target, {"a": 1})
    assert json.loads(target.read_text()) == {"a": 1}


def test_write_json_atomic_overwrites_existing(tmp_path):
    target = tmp_path / "x.json"
    target.write_text("OLD")
    write_json_atomic(target, {"a": 1})
    assert json.loads(target.read_text()) == {"a": 1}


def test_write_json_atomic_no_partial_file_on_failure(tmp_path, monkeypatch):
    target = tmp_path / "x.json"

    def boom(*a, **kw):
        raise RuntimeError("disk full")

    monkeypatch.setattr("sync_sheet.Path.replace", boom)
    with pytest.raises(RuntimeError):
        write_json_atomic(target, {"a": 1})
    assert not target.exists()


def test_read_senate_flag_returns_false_when_missing(wb):
    del wb.defined_names["Var_SenatePageVisible"]
    assert read_senate_flag(wb) is False


def test_read_senate_flag_reads_truthy_value(wb):
    # Fixture defaults to False — flip via the named cell.
    cell = wb["Variable"]["B1"]
    cell.value = True
    assert read_senate_flag(wb) is True


def test_run_sync_writes_status_and_meta(tmp_path, fixture_workbook_path):
    out_dir = tmp_path / "data"
    out_dir.mkdir()
    result = run_sync(fixture_workbook_path, out_dir)
    assert isinstance(result, SyncResult)
    assert result.status == "ok"
    assert (out_dir / "status.json").exists()
    assert (out_dir / "meta.json").exists()
    meta = json.loads((out_dir / "meta.json").read_text())
    assert meta["senate_visible"] is False
    assert meta["schema_version"] == 1
    assert "synced_at" in meta


def test_run_sync_does_not_write_senate_when_flag_off(tmp_path, fixture_workbook_path):
    out_dir = tmp_path / "data"
    out_dir.mkdir()
    run_sync(fixture_workbook_path, out_dir)
    assert not (out_dir / "senate.json").exists()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest tests/test_sync_sheet.py -v
```

Expected: FAIL with `ModuleNotFoundError: sync_sheet`.

- [ ] **Step 3: Write `scripts/sync_sheet.py`**

```python
"""Sync orchestrator: download xlsx, validate, extract per-page JSON, write meta.

Designed to run inside a GitHub Action; can also be run locally for testing.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import openpyxl
import requests

from extractors import status as ex_status
from notify_telegram import build_message, send as send_telegram
from validate_schema import SchemaValidationError, validate

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 1
EXPORT_URL = "https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx"
RETRY_BACKOFFS = [5, 15, 45]  # seconds


@dataclass
class SyncResult:
    status: str
    partial_failures: list[str]


def download_xlsx(sheet_id: str, dest: Path) -> Path:
    url = EXPORT_URL.format(sheet_id=sheet_id)
    last_exc: Exception | None = None
    for i, delay in enumerate([0, *RETRY_BACKOFFS]):
        if delay:
            time.sleep(delay)
        try:
            r = requests.get(url, timeout=60, allow_redirects=True)
            r.raise_for_status()
            dest.write_bytes(r.content)
            return dest
        except Exception as exc:  # noqa: BLE001
            logger.warning("Download attempt %d failed: %s", i + 1, exc)
            last_exc = exc
    raise RuntimeError(f"Failed to download xlsx after {len(RETRY_BACKOFFS) + 1} attempts: {last_exc}")


def write_json_atomic(path: Path, data: dict | list) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True))
    tmp.replace(path)


def read_senate_flag(wb) -> bool:
    """Read Var_SenatePageVisible. Convention: single-cell named range (e.g. Variable!$B$1).

    Defensive: if someone defines it as a 1×1 range (e.g. $B$1:$B$1), openpyxl returns
    a tuple-of-tuples for `ws[ref]`, which is truthy regardless of value. We pull the
    top-left cell explicitly to handle both cases.
    """
    if "Var_SenatePageVisible" not in wb.defined_names:
        return False
    dn = wb.defined_names["Var_SenatePageVisible"]
    for sheet_name, ref in dn.destinations:
        clean = ref.replace("$", "")
        result = wb[sheet_name][clean]
        # ws[address] returns either a Cell (single addr) or tuple-of-tuples (range).
        if isinstance(result, tuple):
            cell = result[0][0]
        else:
            cell = result
        return bool(cell.value)
    return False


def _sheet_modified_time(wb) -> str | None:
    mod = wb.properties.modified
    if mod is None:
        return None
    return mod.replace(tzinfo=timezone.utc).isoformat() if mod.tzinfo is None else mod.isoformat()


def run_sync(xlsx_path: Path, out_dir: Path) -> SyncResult:
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    senate_enabled = read_senate_flag(wb)
    validate(wb, senate_enabled=senate_enabled)

    partial_failures: list[str] = []

    extractors = [
        ("status", ex_status.extract),
        # Phase 2 extractors registered here as they land.
    ]

    for page_name, fn in extractors:
        try:
            data = fn(wb)
            write_json_atomic(out_dir / f"{page_name}.json", data)
        except Exception as exc:  # noqa: BLE001 — keep going on per-page failure
            logger.error("Extractor %s failed: %s", page_name, exc)
            partial_failures.append(page_name)

    meta = {
        "synced_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "sheet_modified_time": _sheet_modified_time(wb),
        "senate_visible": senate_enabled,
        "schema_version": SCHEMA_VERSION,
        "partial_failures": partial_failures,
    }
    write_json_atomic(out_dir / "meta.json", meta)

    return SyncResult(status="ok", partial_failures=partial_failures)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", default="public/data", help="JSON output directory")
    parser.add_argument("--sheet-id", default=os.environ.get("SHEET_ID"))
    parser.add_argument("--xlsx", help="Use a local xlsx instead of downloading (for testing)")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        if args.xlsx:
            xlsx_path = Path(args.xlsx)
        else:
            if not args.sheet_id:
                raise RuntimeError("SHEET_ID env var or --sheet-id flag required")
            with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
                xlsx_path = download_xlsx(args.sheet_id, Path(tmp.name))
        result = run_sync(xlsx_path, out_dir)
        if result.partial_failures:
            logger.warning("Partial failures: %s", result.partial_failures)
        logger.info("Sync OK")
        return 0
    except (RuntimeError, SchemaValidationError) as exc:
        logger.exception("Sync failed")
        run_url = os.environ.get("GITHUB_RUN_URL", "(no run URL)")
        send_telegram(build_message(summary=str(exc), run_url=run_url))
        return 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/test_sync_sheet.py -v
```

Expected: 7 tests PASS.

- [ ] **Step 5: Verify CLI runs locally against the fixture**

```bash
uv run python tests/fixtures/build_test_workbook.py /tmp/test_wb.xlsx
mkdir -p /tmp/sync_out
uv run python scripts/sync_sheet.py --xlsx /tmp/test_wb.xlsx --out-dir /tmp/sync_out
ls /tmp/sync_out
cat /tmp/sync_out/meta.json
```

Expected: `meta.json` and `status.json` exist; meta has `senate_visible: false`, schema_version: 1.

- [ ] **Step 6: Commit**

```bash
git add scripts/sync_sheet.py tests/test_sync_sheet.py
git commit -m "feat(sync): orchestrator with download/retry/validate/extract/atomic-write"
```

---

### Task 9: GitHub Action workflow

**Files:**
- Create: `.github/workflows/sync.yml`
- Create: `.github/workflows/deploy-pages.yml`
- Modify: `README.md` (add Action setup section)

- [ ] **Step 1: Write `.github/workflows/sync.yml`**

```yaml
name: Sync sheet → JSON

on:
  schedule:
    - cron: '7 * * * *'   # hourly, off-the-hour to avoid contention
  workflow_dispatch:       # manual trigger after a turn

permissions:
  contents: write          # commit JSON updates back to main

concurrency:
  group: sync
  cancel-in-progress: false

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v3
        with:
          version: "0.4.18"

      - name: Set up Python
        run: uv python install 3.11

      - name: Install deps
        run: uv sync --frozen

      - name: Run sync
        env:
          SHEET_ID: ${{ vars.SHEET_ID }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
          GITHUB_RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: uv run python scripts/sync_sheet.py --out-dir public/data

      - name: Commit if changed
        run: |
          git config user.name "scorp-dashboard-sync[bot]"
          git config user.email "actions@users.noreply.github.com"
          git add public/data
          if git diff --staged --quiet; then
            echo "No changes — nothing to commit."
          else
            git commit -m "data: sync $(date -u +%Y-%m-%dT%H:%M:%SZ)"
            git push
          fi
```

- [ ] **Step 2: Write `.github/workflows/deploy-pages.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'public/**'
      - 'index.html'
      - 'package.json'
      - 'package-lock.json'
      - 'vite.config.js'
      - 'svelte.config.js'
      - 'tailwind.config.js'
      - 'postcss.config.js'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run build

      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Update README.md with Action setup**

Append to `README.md`:

```markdown
## Deployment

### One-time setup

1. Create the GitHub repository (`scorp_dashboard`) and push this code.
2. **Settings → Pages → Source:** select "GitHub Actions".
3. **Settings → Variables and secrets → Actions:**
   - **Variables:** `SHEET_ID` = the Google Sheet ID (the bit between `/d/` and `/edit` in the URL).
   - **Secrets:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (optional — sync runs fine without them, just no failure pings).
4. Push to `main`. Two workflows will run:
   - `sync.yml` — hourly; pulls the sheet, writes JSON to `public/data/`, commits.
   - `deploy-pages.yml` — on every push to `main` (path-filtered); builds and publishes the SPA.

### Manual operations

- **Force a sync after a turn:** Actions → Sync sheet → JSON → Run workflow.
- **Force a redeploy:** Actions → Deploy to GitHub Pages → Run workflow.

### Best-effort cron caveat

GitHub's scheduled cron is best-effort. Hourly runs typically land within 5–15 minutes of `:07`, but can drift further or be skipped under load. The "Synced HH:MM UTC" chip in the dashboard nav turns red when stale > 3 hours so users can see this without checking Actions.
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/sync.yml .github/workflows/deploy-pages.yml README.md
git commit -m "chore: add github actions for sync cron and pages deploy"
```

---

### Task 10: Theme store + ThemeToggle component

**Files:**
- Create: `src/lib/theme.js`
- Create: `src/lib/components/ThemeToggle.svelte`
- Create: `src/lib/theme.test.js`

- [ ] **Step 1: Write the failing test**

`src/lib/theme.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { theme, setTheme, toggleTheme, initTheme } from './theme.js';
import { get } from 'svelte/store';

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to light when no preference is stored', () => {
    initTheme();
    expect(get(theme)).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('reads stored preference on init', () => {
    localStorage.setItem('theme', 'dark');
    initTheme();
    expect(get(theme)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('setTheme persists and applies', () => {
    initTheme();
    setTheme('dark');
    expect(get(theme)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('toggleTheme flips light <-> dark', () => {
    initTheme();
    toggleTheme();
    expect(get(theme)).toBe('dark');
    toggleTheme();
    expect(get(theme)).toBe('light');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem('theme', 'pink');
    initTheme();
    expect(get(theme)).toBe('light');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- --run src/lib/theme.test.js
```

Expected: FAIL with "Cannot find module './theme.js'".

- [ ] **Step 3: Write `src/lib/theme.js`**

```javascript
import { writable } from 'svelte/store';

const VALID = new Set(['light', 'dark']);
const KEY = 'theme';

export const theme = writable('light');

function readStored() {
  try {
    const t = localStorage.getItem(KEY);
    return VALID.has(t) ? t : 'light';
  } catch {
    return 'light';
  }
}

function apply(value) {
  document.documentElement.dataset.theme = value;
  theme.set(value);
}

export function initTheme() {
  apply(readStored());
}

export function setTheme(value) {
  if (!VALID.has(value)) return;
  try {
    localStorage.setItem(KEY, value);
  } catch {}
  apply(value);
}

export function toggleTheme() {
  let current;
  theme.subscribe((v) => (current = v))();
  setTheme(current === 'light' ? 'dark' : 'light');
}
```

- [ ] **Step 4: Write `src/lib/components/ThemeToggle.svelte`**

```svelte
<script>
  import { theme, toggleTheme } from '../theme.js';
</script>

<button
  class="px-3 py-1 border-2 border-border bg-bg text-fg font-mono text-xs uppercase tracking-widest hover:bg-border hover:text-bg transition-colors"
  on:click={toggleTheme}
  aria-label="Toggle theme"
  title="Toggle theme"
>
  {$theme === 'light' ? '☾ Dark' : '☀ Light'}
</button>
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test -- --run src/lib/theme.test.js
```

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/theme.js src/lib/theme.test.js src/lib/components/ThemeToggle.svelte
git commit -m "feat(ui): theme store + toggle component (light/dark, localStorage)"
```

---

### Task 11: Data fetcher with cache-bust + meta store

**Files:**
- Create: `src/lib/data.js`
- Create: `src/lib/stores/meta.js`
- Create: `src/lib/data.test.js`

- [ ] **Step 1: Write the failing test**

`src/lib/data.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchMeta, fetchPage } from './data.js';

describe('data fetcher', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchMeta hits meta.json with a random cache-bust', async () => {
    const calls = [];
    global.fetch = vi.fn(async (url) => {
      calls.push(url);
      return new Response(
        JSON.stringify({ synced_at: '2026-05-01T14:07:00Z', schema_version: 1, senate_visible: false, partial_failures: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const meta = await fetchMeta();
    expect(meta.synced_at).toBe('2026-05-01T14:07:00Z');
    expect(calls[0]).toMatch(/data\/meta\.json\?v=/);
  });

  it('fetchPage uses meta.synced_at as cache-bust', async () => {
    const calls = [];
    global.fetch = vi.fn(async (url) => {
      calls.push(url);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const data = await fetchPage('status', '2026-05-01T14:07:00Z');
    expect(data).toEqual({ ok: true });
    expect(calls[0]).toBe('./data/status.json?v=2026-05-01T14%3A07%3A00Z');
  });

  it('fetchPage returns null on 404', async () => {
    global.fetch = vi.fn(async () => new Response('', { status: 404 }));
    const data = await fetchPage('senate', 'x');
    expect(data).toBeNull();
  });

  it('fetchPage throws on non-404 errors', async () => {
    global.fetch = vi.fn(async () => new Response('boom', { status: 500 }));
    await expect(fetchPage('status', 'x')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- --run src/lib/data.test.js
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Write `src/lib/data.js`**

```javascript
const BASE = './data';

export async function fetchMeta() {
  const bust = Math.random().toString(36).slice(2);
  const r = await fetch(`${BASE}/meta.json?v=${bust}`);
  if (!r.ok) throw new Error(`meta.json fetch failed: ${r.status}`);
  return r.json();
}

export async function fetchPage(name, syncedAt) {
  const url = `${BASE}/${name}.json?v=${encodeURIComponent(syncedAt)}`;
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${name}.json fetch failed: ${r.status}`);
  return r.json();
}
```

- [ ] **Step 4: Write `src/lib/stores/meta.js`**

```javascript
import { writable } from 'svelte/store';
import { fetchMeta } from '../data.js';

export const meta = writable(null);
export const metaError = writable(null);

const EXPECTED_SCHEMA_VERSION = 1;

export async function loadMeta() {
  try {
    const data = await fetchMeta();
    if (data.schema_version !== EXPECTED_SCHEMA_VERSION) {
      metaError.set({
        kind: 'schema_mismatch',
        expected: EXPECTED_SCHEMA_VERSION,
        actual: data.schema_version,
      });
      return null;
    }
    meta.set(data);
    return data;
  } catch (err) {
    metaError.set({ kind: 'fetch_failed', message: err.message });
    return null;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test -- --run src/lib/data.test.js
```

Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data.js src/lib/stores/meta.js src/lib/data.test.js
git commit -m "feat(ui): data fetcher with cache-bust + meta store with schema check"
```

---

### Task 12: NavBar + SyncChip components

**Files:**
- Create: `src/lib/components/SyncChip.svelte`
- Create: `src/lib/components/NavBar.svelte`
- Create: `src/lib/components/SyncChip.test.js`

The SyncChip turns red when `synced_at` is stale > 3 hours. NavBar lists pages, hiding Senate when `senate_visible` is false.

- [ ] **Step 1: Write the failing test**

`src/lib/components/SyncChip.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { isStale, formatSyncedAt } from './SyncChip.svelte';
```

Wait — Svelte component files don't export pure functions like this for testing. Move the helpers to a sibling `.js` file.

Replace with `src/lib/sync-chip-utils.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { isStale, formatSyncedAt } from './sync-chip-utils.js';

describe('sync chip utils', () => {
  it('isStale returns false for recent timestamps', () => {
    const now = new Date('2026-05-01T14:00:00Z');
    expect(isStale('2026-05-01T13:30:00Z', now)).toBe(false);
  });

  it('isStale returns true for timestamps older than 3 hours', () => {
    const now = new Date('2026-05-01T14:00:00Z');
    expect(isStale('2026-05-01T10:30:00Z', now)).toBe(true);
  });

  it('isStale returns true when synced_at is null', () => {
    expect(isStale(null, new Date())).toBe(true);
  });

  it('formatSyncedAt returns HH:MM UTC', () => {
    expect(formatSyncedAt('2026-05-01T14:07:00Z')).toBe('14:07 UTC');
  });

  it('formatSyncedAt returns "—" when null', () => {
    expect(formatSyncedAt(null)).toBe('—');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- --run src/lib/sync-chip-utils.test.js
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Write `src/lib/sync-chip-utils.js`**

```javascript
const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000;

export function isStale(syncedAt, now = new Date()) {
  if (!syncedAt) return true;
  return now.getTime() - new Date(syncedAt).getTime() > STALE_THRESHOLD_MS;
}

export function formatSyncedAt(syncedAt) {
  if (!syncedAt) return '—';
  const d = new Date(syncedAt);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}
```

- [ ] **Step 4: Write `src/lib/components/SyncChip.svelte`**

```svelte
<script>
  import { meta } from '../stores/meta.js';
  import { isStale, formatSyncedAt } from '../sync-chip-utils.js';

  $: synced = $meta?.synced_at ?? null;
  $: stale = isStale(synced);
  $: label = formatSyncedAt(synced);
</script>

<span
  class="px-3 py-1 border-2 font-mono text-xs uppercase tracking-widest"
  class:border-border={!stale}
  class:text-fg={!stale}
  class:border-crit={stale}
  class:text-crit={stale}
  title={stale ? 'Sync is stale (> 3h old)' : 'Last sync time'}
>
  Synced {label}
</span>
```

- [ ] **Step 5: Write `src/lib/components/NavBar.svelte`**

```svelte
<script>
  import { meta } from '../stores/meta.js';
  import ThemeToggle from './ThemeToggle.svelte';
  import SyncChip from './SyncChip.svelte';
  import { link, location } from 'svelte-spa-router';

  const ALL_PAGES = [
    { path: '/', label: 'Status' },
    { path: '/map', label: 'Map' },
    { path: '/population', label: 'Population' },
    { path: '/pops', label: 'Pops' },
    { path: '/gois', label: 'GoIs' },
    { path: '/parties', label: 'Parties' },
    { path: '/senate', label: 'Senate', requiresSenate: true },
    { path: '/situations', label: 'Situations' },
  ];

  $: pages = ALL_PAGES.filter((p) => !p.requiresSenate || $meta?.senate_visible);
</script>

<nav class="border-b-4 border-border bg-bg px-6 py-3 flex items-center justify-between">
  <div class="flex items-center gap-6">
    <span class="font-mono font-bold uppercase tracking-widest text-accent">
      Colony ▌ T-43
    </span>
    <ul class="flex gap-3 font-mono text-xs uppercase tracking-widest">
      {#each pages as p}
        <li>
          <a
            href={p.path}
            use:link
            class="px-2 py-1 border-2 border-transparent hover:border-border"
            class:border-border={$location === p.path}
            class:bg-border={$location === p.path}
            class:text-bg={$location === p.path}
          >
            {p.label}
          </a>
        </li>
      {/each}
    </ul>
  </div>
  <div class="flex items-center gap-3">
    <SyncChip />
    <ThemeToggle />
  </div>
</nav>
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm run test -- --run src/lib/sync-chip-utils.test.js
```

Expected: 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sync-chip-utils.js src/lib/sync-chip-utils.test.js src/lib/components/SyncChip.svelte src/lib/components/NavBar.svelte
git commit -m "feat(ui): navbar with senate gating + sync chip with staleness highlight"
```

---

### Task 13: Status page route + StatTile component

**Files:**
- Create: `src/lib/components/StatTile.svelte`
- Create: `src/lib/stores/status.js`
- Create: `src/routes/Status.svelte`

- [ ] **Step 1: Write `src/lib/components/StatTile.svelte`**

```svelte
<script>
  export let label;
  export let value;
  export let delta = null;
  export let critical = false;
</script>

<div
  class="border-2 border-border bg-bg p-3 flex flex-col gap-1"
  class:border-crit={critical}
>
  <div class="text-[9px] uppercase tracking-[3px] text-muted">{label}</div>
  <div
    class="font-mono text-2xl font-extrabold leading-none"
    class:text-crit={critical}
  >
    {value ?? '—'}{#if delta !== null && delta !== undefined}<span class="text-xs ml-2 font-normal text-muted">{delta > 0 ? '+' : ''}{delta}</span>{/if}
  </div>
</div>
```

- [ ] **Step 2: Write `src/lib/stores/status.js`**

```javascript
import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const status = writable(null);
export const statusError = writable(null);

export async function loadStatus(syncedAt) {
  try {
    const data = await fetchPage('status', syncedAt);
    status.set(data);
  } catch (err) {
    statusError.set(err.message);
  }
}
```

- [ ] **Step 3: Write `src/routes/Status.svelte`**

```svelte
<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { status, statusError, loadStatus } from '../lib/stores/status.js';
  import StatTile from '../lib/components/StatTile.svelte';

  onMount(() => {
    if ($meta?.synced_at) loadStatus($meta.synced_at);
  });

  $: critical = $status && $status.crisis_factor != null && $status.stability != null
    && $status.crisis_factor >= $status.stability;
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider mb-4 border-b-4 border-border pb-2">
    Colony Status
  </h2>

  {#if $statusError}
    <p class="text-crit">Failed to load status: {$statusError}</p>
  {:else if !$status}
    <p class="text-muted">Loading…</p>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
      <StatTile label="Treasury" value={$status.treasury?.money} delta={$status.treasury?.delta} />
      <StatTile label="Population" value={$status.population_total?.toLocaleString()} />
      <StatTile label="Stability" value={$status.stability?.toFixed(2)} />
      <StatTile label="Crisis Factor" value={$status.crisis_factor?.toFixed(2)} critical={critical} />
    </div>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Resource Flows</h3>
    <div class="grid grid-cols-2 md:grid-cols-7 gap-3 mb-6">
      {#each $status.resources as r}
        <StatTile label={r.name} value={r.current} delta={r.delta} />
      {/each}
    </div>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Overton Window</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
      {#each Object.entries($status.overton) as [axis, value]}
        <div class="border-2 border-border p-2">
          <div class="flex justify-between text-xs uppercase tracking-widest mb-1">
            <span>{axis}</span>
            <span class="font-bold">{value?.toFixed(1) ?? '—'}</span>
          </div>
          <div class="h-2 bg-bg border border-border relative">
            <div
              class="absolute top-0 bottom-0 bg-accent"
              style="width: {((value ?? 4) - 1) / 6 * 100}%"
            ></div>
          </div>
        </div>
      {/each}
    </div>

    {#if $status.active_situations.length > 0}
      <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Active Situations</h3>
      <div class="flex flex-wrap gap-2">
        {#each $status.active_situations as sit}
          <span class="border-2 border-crit text-crit px-2 py-1 text-xs uppercase tracking-widest">
            ⚠ {sit.name} · {sit.crisis_factor?.toFixed(2)}
          </span>
        {/each}
      </div>
    {/if}
  {/if}
</section>
```

- [ ] **Step 4: Verify dev server renders the page** (after Task 14 wires the router) — defer for now, will verify in Task 14.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/StatTile.svelte src/lib/stores/status.js src/routes/Status.svelte
git commit -m "feat(ui): status page with stat tiles, overton window, situations banner"
```

---

### Task 14: Router + App composition + maintenance banner

**Files:**
- Modify: `src/App.svelte`
- Create: `src/lib/components/MaintenanceBanner.svelte`
- Create: `src/routes/NotFound.svelte`
- Create: `src/routes/EmptyPage.svelte` (placeholder for not-yet-implemented pages in Phase 1)

- [ ] **Step 1: Write `src/lib/components/MaintenanceBanner.svelte`**

```svelte
<script>
  export let metaError;
</script>

<div class="bg-crit text-bg p-4 font-mono text-sm">
  <strong class="uppercase tracking-widest">Dashboard Unavailable</strong>
  {#if metaError.kind === 'schema_mismatch'}
    <p class="mt-2">
      Frontend expects schema version {metaError.expected}; data is at version {metaError.actual}.
      The dashboard needs to be redeployed against the current data schema.
    </p>
  {:else if metaError.kind === 'fetch_failed'}
    <p class="mt-2">Could not load metadata: {metaError.message}. Check Pages deployment.</p>
  {:else}
    <p class="mt-2">Unknown error.</p>
  {/if}
</div>
```

- [ ] **Step 2: Write `src/routes/NotFound.svelte`**

```svelte
<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider">404 — Page Not Found</h2>
  <p class="text-muted mt-2">The page you requested doesn't exist.</p>
</section>
```

- [ ] **Step 3: Write `src/routes/EmptyPage.svelte`** (Phase 1 placeholder for pages built in Phase 2)

```svelte
<script>
  export let params = {};
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider border-b-4 border-border pb-2">
    {params.title ?? 'Page'}
  </h2>
  <p class="text-muted mt-4">Coming in Phase 2.</p>
</section>
```

- [ ] **Step 4: Replace `src/App.svelte`**

```svelte
<script>
  import { onMount } from 'svelte';
  import Router from 'svelte-spa-router';
  import { initTheme } from './lib/theme.js';
  import { meta, metaError, loadMeta } from './lib/stores/meta.js';
  import NavBar from './lib/components/NavBar.svelte';
  import MaintenanceBanner from './lib/components/MaintenanceBanner.svelte';

  import Status from './routes/Status.svelte';
  import EmptyPage from './routes/EmptyPage.svelte';
  import NotFound from './routes/NotFound.svelte';

  onMount(async () => {
    initTheme();
    await loadMeta();
  });

  const routes = {
    '/': Status,
    '/map': EmptyPage,
    '/population': EmptyPage,
    '/pops': EmptyPage,
    '/gois': EmptyPage,
    '/parties': EmptyPage,
    '/senate': EmptyPage,
    '/situations': EmptyPage,
    '*': NotFound,
  };
</script>

<div class="min-h-screen bg-bg text-fg font-mono">
  {#if $metaError}
    <MaintenanceBanner metaError={$metaError} />
  {:else if !$meta}
    <div class="p-8 text-muted">Loading…</div>
  {:else}
    <NavBar />
    <Router {routes} />
  {/if}
</div>
```

- [ ] **Step 5: Wire up the local sync output for `npm run dev` testing**

```bash
mkdir -p public/data
uv run python tests/fixtures/build_test_workbook.py /tmp/test_wb.xlsx
uv run python scripts/sync_sheet.py --xlsx /tmp/test_wb.xlsx --out-dir public/data
```

- [ ] **Step 6: Run dev server and verify Status page renders**

```bash
npm run dev
```

In the browser:
- Status page shows Treasury 487, Population 15,870, Stability 0.42, Crisis 0.38 (red).
- Resource strip shows all 7 resources with deltas.
- Overton window shows 6 axes.
- Active Situations section is empty (no Situations sheet in fixture).
- Theme toggle in nav flips between light and dark.
- Sync chip shows current time, not red (just synced).
- Senate page is NOT in the nav (fixture has flag = FALSE).

Kill the server.

- [ ] **Step 7: Commit**

```bash
git add src/App.svelte src/lib/components/MaintenanceBanner.svelte src/routes/NotFound.svelte src/routes/EmptyPage.svelte
git commit -m "feat(ui): wire up router with status page, maintenance banner, placeholders"
```

---

### Task 15: Phase 1 acceptance — manual end-to-end verification

**Goal:** Stand up the GitHub repo, push, and verify the live Pages deployment renders the Status page from a real synced Sheet. This task is mostly manual; document what to check and what to commit afterward.

- [ ] **Step 1: Add `Var_SenatePageVisible` to the `scorp_colony` workbook builder**

Switch to the `scorp_colony` repo. On the `Variable` sheet, add a new `Var_*` named cell:

- Cell: pick the next free row on the Variable sheet
- Value: `FALSE` (default — Senate hidden until you flip it)
- Named range: `Var_SenatePageVisible`

Build, recalc, verify, upload to the Google Sheet.

- [ ] **Step 2: Create the GitHub repo for the dashboard**

```bash
gh repo create scorp_dashboard --public --source . --remote origin --push
```

(Or use the GitHub UI — it doesn't matter how the repo gets there.)

- [ ] **Step 3: Configure repo Variables and Secrets**

Settings → Variables and Secrets → Actions:

- **Variable** `SHEET_ID` = the Google Sheet ID
- **Secret** `TELEGRAM_BOT_TOKEN` = (your bot token, optional)
- **Secret** `TELEGRAM_CHAT_ID` = (your chat ID, optional)

- [ ] **Step 4: Enable Pages**

Settings → Pages → Source: "GitHub Actions".

- [ ] **Step 5: Trigger first sync manually**

Actions → Sync sheet → JSON → Run workflow → main → Run.

Wait for the run to complete. Verify:
- Run is green.
- A new commit appears: `data: sync <timestamp>`.
- `public/data/meta.json`, `public/data/status.json` are committed.

- [ ] **Step 6: Trigger Pages deploy**

The previous commit will have triggered `deploy-pages.yml` automatically. Wait for it to finish.

- [ ] **Step 7: Visit the deployed dashboard**

Open `https://<user>.github.io/scorp_dashboard/`. Verify the Status page renders the same data you'd expect from the live Sheet.

- [ ] **Step 8: Test the Senate flag round-trip**

1. Edit the Google Sheet: set `Var_SenatePageVisible` to TRUE.
2. Manually trigger another sync run.
3. After deploy, verify Senate appears in the nav (it'll route to the EmptyPage placeholder for now — that's expected in Phase 1).
4. Set the cell back to FALSE, sync again, verify Senate disappears from nav.

- [ ] **Step 9: Test failure-webhook (only if Telegram configured)**

Easiest path: temporarily break `SHEET_ID` in repo Variables. Settings → Variables → Actions → set `SHEET_ID` to `INVALID_ID`. Trigger sync via workflow_dispatch. Verify:
- Action run is red (exits non-zero on download failure after retries).
- Telegram receives a message containing the failure summary AND the Action run URL.
- `public/data/*.json` in the repo is unchanged (last-good state preserved).

Restore `SHEET_ID` to its real value when done. Trigger one more sync to confirm green path still works.

- [ ] **Step 10: Test sync-chip staleness highlight**

In the deployed dashboard, open DevTools console and run:

```javascript
// Backdate meta.json's synced_at by 4h to simulate stale sync.
const now = new Date(); now.setHours(now.getHours() - 4);
fetch('./data/meta.json').then(r => r.json()).then(m => {
  m.synced_at = now.toISOString();
  // Inject directly into the store via a quick app-internal hack.
  window.dispatchEvent(new CustomEvent('test:backdate-meta', { detail: m }));
  console.log('Backdated to', m.synced_at);
});
```

(Alternatively: just wait 3+ hours after a sync and refresh.) Verify the "Synced HH:MM UTC" chip in the nav turns red.

If the JS hack doesn't fly, hard-test it locally instead: backdate `public/data/meta.json` by editing the file's `synced_at` to 4 hours ago, run `npm run dev`, reload — chip is red.

- [ ] **Step 11: Document Phase 1 completion in the README**

Add a "Status: Phase 1 shipped" line at the top of `README.md` with the deployed URL.

```bash
git add README.md
git commit -m "docs: mark phase 1 shipped, add deployed URL"
```

---

## Phase 2: Remaining pages

Goal: ship the 7 remaining pages — Map, Population, Pops Detailed, GoIs, Parties, Senate, Situations — by extending the sync pipeline and adding Svelte routes for each.

### Task 16: RadarChart component (shared)

Used by Population, Pops Detailed, GoIs, Parties. Renders a 6-axis worldview as an SVG radar.

**Files:**
- Create: `src/lib/components/RadarChart.svelte`
- Create: `src/lib/radar-utils.js`
- Create: `src/lib/radar-utils.test.js`

- [ ] **Step 1: Write the failing test**

`src/lib/radar-utils.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { polarPoints } from './radar-utils.js';

describe('radar utils', () => {
  it('polarPoints returns N points evenly distributed around center', () => {
    const pts = polarPoints([4, 4, 4, 4, 4, 4], { cx: 100, cy: 100, radius: 50, scaleMin: 1, scaleMax: 7 });
    expect(pts).toHaveLength(6);
    // Each point at half radius (4 is midpoint of 1..7).
    expect(pts[0].x).toBeCloseTo(100, 1);
    expect(pts[0].y).toBeCloseTo(75, 1); // straight up
  });

  it('polarPoints handles missing values as scale midpoint', () => {
    const pts = polarPoints([null, null, null, null, null, null], { cx: 0, cy: 0, radius: 10, scaleMin: 1, scaleMax: 7 });
    expect(pts).toHaveLength(6);
    pts.forEach((p) => expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true));
  });

  it('polarPoints clamps values outside scale range', () => {
    const pts = polarPoints([10, -5, 4, 4, 4, 4], { cx: 0, cy: 0, radius: 10, scaleMin: 1, scaleMax: 7 });
    pts.forEach((p) => expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- --run src/lib/radar-utils.test.js
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Write `src/lib/radar-utils.js`**

```javascript
export function polarPoints(values, { cx, cy, radius, scaleMin = 1, scaleMax = 7 }) {
  const n = values.length;
  return values.map((v, i) => {
    const raw = v == null ? (scaleMin + scaleMax) / 2 : v;
    const clamped = Math.min(scaleMax, Math.max(scaleMin, raw));
    const norm = (clamped - scaleMin) / (scaleMax - scaleMin);
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * radius * norm,
      y: cy + Math.sin(angle) * radius * norm,
    };
  });
}
```

- [ ] **Step 4: Write `src/lib/components/RadarChart.svelte`**

```svelte
<script>
  import { polarPoints } from '../radar-utils.js';

  /** @type {{label: string, value: number | null}[]} */
  export let axes = [];
  export let size = 160;
  export let scaleMin = 1;
  export let scaleMax = 7;

  $: cx = size / 2;
  $: cy = size / 2;
  $: radius = size / 2 - 18;
  $: values = axes.map((a) => a.value);
  $: dataPoints = polarPoints(values, { cx, cy, radius, scaleMin, scaleMax });
  $: pathD = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
  $: gridLevels = [0.25, 0.5, 0.75, 1].map((f) => polarPoints(axes.map(() => scaleMin + (scaleMax - scaleMin) * f), { cx, cy, radius, scaleMin, scaleMax }));
  $: spokes = polarPoints(axes.map(() => scaleMax), { cx, cy, radius, scaleMin, scaleMax });
</script>

<svg width={size} height={size} viewBox="0 0 {size} {size}" class="font-mono">
  <!-- grid rings -->
  {#each gridLevels as ring}
    <polygon
      points={ring.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
      fill="none"
      stroke="var(--border)"
      stroke-width="1"
      stroke-opacity="0.25"
    />
  {/each}
  <!-- spokes -->
  {#each spokes as p}
    <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border)" stroke-opacity="0.25" stroke-width="1" />
  {/each}
  <!-- data shape -->
  <path d={pathD} fill="var(--accent)" fill-opacity="0.25" stroke="var(--accent)" stroke-width="2" />
  <!-- axis labels -->
  {#each axes as a, i}
    {@const lp = polarPoints(axes.map((_, j) => (j === i ? scaleMax : scaleMin)), { cx, cy, radius: radius + 12, scaleMin, scaleMax })[i]}
    <text x={lp.x.toFixed(1)} y={lp.y.toFixed(1)} text-anchor="middle" dominant-baseline="central" font-size="9" fill="var(--muted)" text-transform="uppercase">
      {a.label.slice(0, 4)}
    </text>
  {/each}
</svg>
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test -- --run src/lib/radar-utils.test.js
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/radar-utils.js src/lib/radar-utils.test.js src/lib/components/RadarChart.svelte
git commit -m "feat(ui): radar chart component for 6-axis worldview"
```

---

### Task 17: Heatmap component (shared)

Used by GoIs (PopCapture matrix), Parties (GoI×Party + Class×Party compat), Senate (GoI capture %).

**Files:**
- Create: `src/lib/components/Heatmap.svelte`

- [ ] **Step 1: Write `src/lib/components/Heatmap.svelte`**

```svelte
<script>
  /**
   * Generic 0..1 heatmap.
   * @type {string[]}  rowLabels
   * @type {string[]}  colLabels
   * @type {(number|null)[][]} values  - rowLabels.length × colLabels.length
   */
  export let rowLabels = [];
  export let colLabels = [];
  export let values = [];
  export let cellSize = 36;

  function cellColor(v) {
    if (v == null) return 'var(--bg)';
    const t = Math.min(1, Math.max(0, v));
    // Light bg → accent at 1.0
    return `color-mix(in srgb, var(--accent) ${(t * 100).toFixed(0)}%, var(--bg))`;
  }
</script>

<div class="overflow-x-auto">
  <table class="border-collapse font-mono text-xs">
    <thead>
      <tr>
        <th class="border-2 border-border p-1 bg-bg"></th>
        {#each colLabels as c}
          <th class="border-2 border-border p-1 bg-bg uppercase tracking-widest text-[9px] text-muted">
            {c}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rowLabels as r, i}
        <tr>
          <th class="border-2 border-border p-1 bg-bg uppercase tracking-widest text-[9px] text-muted text-right">
            {r}
          </th>
          {#each colLabels as _c, j}
            <td
              class="border-2 border-border text-center"
              style="width: {cellSize}px; height: {cellSize}px; background: {cellColor(values[i]?.[j])}"
              title="{r} × {colLabels[j]} = {values[i]?.[j]?.toFixed(2) ?? '—'}"
            >
              {values[i]?.[j]?.toFixed(2) ?? '—'}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/Heatmap.svelte
git commit -m "feat(ui): heatmap component for 0..1 matrix data"
```

---

### Task 18: Population page

Surfaces 11 classes with population, share, tier, political weight, and per-class worldview.

**Files:**
- Modify: `tests/fixtures/build_test_workbook.py` (add Popsim worldview data)
- Create: `scripts/extractors/population.py`
- Create: `tests/extractors/test_population.py`
- Create: `src/lib/stores/population.js`
- Create: `src/routes/Population.svelte`
- Modify: `scripts/sync_sheet.py` (register extractor)
- Modify: `scripts/validate_schema.py` (add required ranges)
- Modify: `src/App.svelte` (route to Population)

- [ ] **Step 1: Extend the fixture builder**

Append to `tests/fixtures/build_test_workbook.py`'s `build()` function, after the Popsim block:

```python
    # Popsim worldview block (cols B-G, rows 41-55, paired with class names in col A).
    # We mirror class names from ClassTable into col A using a formula approximation —
    # for the fixture, just write them directly.
    for i, (name, _, _, _) in enumerate(classes, start=41):
        pop.cell(row=i, column=1, value=name)
        # Six axis values per class — make them deterministic but varied.
        for axis in range(6):
            pop.cell(row=i, column=2 + axis, value=4.0 + (i % 3) * 0.5 - axis * 0.3)
    _add_name(wb, "PopsimWorldview", "Popsim!$B$41:$G$55")
```

- [ ] **Step 2: Write the failing extractor test**

`tests/extractors/test_population.py`:

```python
"""Tests for the Population page extractor."""
from __future__ import annotations

from extractors.population import extract


def test_extract_returns_class_count_matching_live_classes(wb):
    result = extract(wb)
    # Fixture has 11 live classes + 4 reserved blanks. Blanks should be filtered.
    assert len(result["classes"]) == 11


def test_extract_class_record_shape(wb):
    result = extract(wb)
    bureaucrats = result["classes"][0]
    assert bureaucrats["name"] == "Bureaucrats"
    assert bureaucrats["tier"] == "Upper"
    assert bureaucrats["pop"] == 970
    assert bureaucrats["political_weight"] == 3.0
    assert isinstance(bureaucrats["worldview"], dict)
    assert set(bureaucrats["worldview"].keys()) == {
        "expansion", "authority", "corporate", "technocratic", "faith", "materialist",
    }


def test_extract_share_sums_to_one(wb):
    result = extract(wb)
    total = sum(c["share"] for c in result["classes"])
    assert abs(total - 1.0) < 1e-6


def test_extract_tier_totals_present(wb):
    result = extract(wb)
    assert set(result["tier_totals"].keys()) == {"Upper", "Middle", "Lower"}
    assert abs(sum(result["tier_totals"].values()) - 1.0) < 1e-6
```

- [ ] **Step 3: Run test to verify it fails**

```bash
uv run pytest tests/extractors/test_population.py -v
```

Expected: FAIL with module-not-found.

- [ ] **Step 4: Write `scripts/extractors/population.py`**

```python
"""Extract data for the Population (high-level) page."""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, filter_blank_rows, read_named_range

WORLDVIEW_AXES = ["expansion", "authority", "corporate", "technocratic", "faith", "materialist"]


def extract(wb) -> dict[str, Any]:
    classes = filter_blank_rows(read_named_range(wb, "ClassTable"))
    pops = read_named_range(wb, "PopsimPop")
    worldview_rows = read_named_range(wb, "PopsimWorldview")

    enriched: list[dict[str, Any]] = []
    total_pop = 0.0
    for i, row in enumerate(classes):
        name, tier = row[0], row[1]
        pop = coerce_number(pops[i][0]) if i < len(pops) else None
        if pop is None:
            continue
        total_pop += pop
        wv_row = worldview_rows[i] if i < len(worldview_rows) else [None] * 6
        worldview = {axis: coerce_number(wv_row[j]) for j, axis in enumerate(WORLDVIEW_AXES)}
        enriched.append({
            "name": name,
            "tier": tier,
            "pop": int(pop),
            "share": None,  # filled below
            "political_weight": coerce_number(row[3]) if len(row) > 3 else None,
            "worldview": worldview,
        })

    for c in enriched:
        c["share"] = c["pop"] / total_pop if total_pop else 0.0

    tier_totals: dict[str, float] = {"Upper": 0.0, "Middle": 0.0, "Lower": 0.0}
    for c in enriched:
        if c["tier"] in tier_totals:
            tier_totals[c["tier"]] += c["share"]

    return {"classes": enriched, "tier_totals": tier_totals}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
uv run pytest tests/extractors/test_population.py -v
```

Expected: 4 tests PASS.

- [ ] **Step 6: Register extractor in `scripts/sync_sheet.py`**

Edit `sync_sheet.py`'s `extractors` list:

```python
from extractors import population as ex_population

# ...inside run_sync():
extractors = [
    ("status", ex_status.extract),
    ("population", ex_population.extract),
]
```

- [ ] **Step 7: Add `PopsimWorldview` to `BASE_REQUIRED_RANGES` in `scripts/validate_schema.py`**

```python
BASE_REQUIRED_RANGES: list[str] = [
    # ...existing entries...
    "PopsimWorldview",
]
```

- [ ] **Step 8: Write `src/lib/stores/population.js`**

```javascript
import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const population = writable(null);
export const populationError = writable(null);

export async function loadPopulation(syncedAt) {
  try {
    population.set(await fetchPage('population', syncedAt));
  } catch (err) {
    populationError.set(err.message);
  }
}
```

- [ ] **Step 9: Write `src/routes/Population.svelte`**

```svelte
<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { population, populationError, loadPopulation } from '../lib/stores/population.js';
  import RadarChart from '../lib/components/RadarChart.svelte';

  onMount(() => {
    if ($meta?.synced_at) loadPopulation($meta.synced_at);
  });

  const AXIS_LABELS = ['expansion', 'authority', 'corporate', 'technocratic', 'faith', 'materialist'];
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider mb-4 border-b-4 border-border pb-2">
    Population
  </h2>

  {#if $populationError}
    <p class="text-crit">{$populationError}</p>
  {:else if !$population}
    <p class="text-muted">Loading…</p>
  {:else}
    <table class="border-collapse w-full mb-6 font-mono text-sm">
      <thead>
        <tr class="border-b-2 border-border">
          <th class="text-left p-2 uppercase tracking-widest text-xs text-muted">Class</th>
          <th class="text-right p-2 uppercase tracking-widest text-xs text-muted">Tier</th>
          <th class="text-right p-2 uppercase tracking-widest text-xs text-muted">Pop</th>
          <th class="text-right p-2 uppercase tracking-widest text-xs text-muted">% Share</th>
          <th class="text-right p-2 uppercase tracking-widest text-xs text-muted">Pol Weight</th>
        </tr>
      </thead>
      <tbody>
        {#each $population.classes as c}
          <tr class="border-b border-border/30">
            <td class="p-2">{c.name}</td>
            <td class="p-2 text-right">{c.tier}</td>
            <td class="p-2 text-right">{c.pop.toLocaleString()}</td>
            <td class="p-2 text-right">{(c.share * 100).toFixed(1)}%</td>
            <td class="p-2 text-right">{c.political_weight?.toFixed(1) ?? '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Worldview by class</h3>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      {#each $population.classes as c}
        <div class="border-2 border-border p-2 flex flex-col items-center">
          <div class="text-xs uppercase tracking-widest mb-1">{c.name}</div>
          <RadarChart
            axes={AXIS_LABELS.map((a) => ({ label: a, value: c.worldview[a] }))}
            size={140}
          />
        </div>
      {/each}
    </div>
  {/if}
</section>
```

- [ ] **Step 10: Wire route in `src/App.svelte`**

Replace the `/population` line in the routes object:

```javascript
import Population from './routes/Population.svelte';

const routes = {
  '/': Status,
  '/map': EmptyPage,
  '/population': Population,
  // ...rest unchanged
};
```

- [ ] **Step 11: Re-sync against fixture and verify in dev**

```bash
uv run python scripts/sync_sheet.py --xlsx /tmp/test_wb.xlsx --out-dir public/data
npm run dev
```

Open `/#/population`, verify the class table renders 11 rows, share% sums to ~100%, radar charts visible.

- [ ] **Step 12: Commit**

```bash
git add tests/fixtures/build_test_workbook.py scripts/extractors/population.py tests/extractors/test_population.py scripts/sync_sheet.py scripts/validate_schema.py src/lib/stores/population.js src/routes/Population.svelte src/App.svelte
git commit -m "feat: population page with class table and per-class worldview radars"
```

---

### Task 19: Pops Detailed page

The richest data page — per-class drilldown with income (pre/post-tax), wealth, additional income, status (radicalisation etc.), and satisfaction.

**Files:**
- Modify: `tests/fixtures/build_test_workbook.py` (add Wealth & Income, Status, Wages & Welfare blocks)
- Create: `scripts/extractors/pops.py`
- Create: `tests/extractors/test_pops.py`
- Create: `src/lib/stores/pops.js`
- Create: `src/routes/Pops.svelte`
- Modify: `scripts/sync_sheet.py`
- Modify: `scripts/validate_schema.py`
- Modify: `src/App.svelte`

- [ ] **Step 1: Extend the fixture builder**

Append to `build_test_workbook.py`'s `build()` function:

```python
    # Popsim Wealth & Income block (rows 61-75: cols A name, B gross/cap, D income tax/cap,
    # E wealth tax/cap, F effective rate, G disposable/cap, I wealth/cap, J total class income).
    # Also Standard of Living rows 97-111, Social Privileges rows 79-93, Status rows 133-147,
    # Satisfaction M151:M165. We won't reproduce real backend formulas — just write
    # deterministic numbers so the extractor has something to read.
    for i, (name, _, p, _w) in enumerate(classes, start=61):
        pop.cell(row=i, column=1, value=name)
        gross = 12.0 + (i - 61)
        pop.cell(row=i, column=2, value=gross)
        pop.cell(row=i, column=4, value=gross * 0.10)  # income tax/cap
        pop.cell(row=i, column=5, value=gross * 0.02)  # wealth tax/cap
        pop.cell(row=i, column=6, value=0.12)          # effective rate
        pop.cell(row=i, column=7, value=gross * 0.88)  # disposable/cap
        pop.cell(row=i, column=9, value=gross * 4)     # wealth/cap
        pop.cell(row=i, column=10, value=gross * 0.88 * p)  # total class income (post-tax)
    _add_name(wb, "PopsimGrossPerCap", "Popsim!$B$61:$B$75")
    _add_name(wb, "PopsimDisposablePerCap", "Popsim!$G$61:$G$75")
    _add_name(wb, "PopsimWealthPerCap", "Popsim!$I$61:$I$75")

    # Standard of Living: rows 97-111, cols B (SoL), C (Expected SoL).
    for i, _ in enumerate(classes, start=97):
        pop.cell(row=i, column=1, value=classes[i - 97][0])
        pop.cell(row=i, column=2, value=0.42 + (i - 97) * 0.01)
        pop.cell(row=i, column=3, value=0.55)
    _add_name(wb, "PopsimSoL", "Popsim!$B$97:$B$111")
    _add_name(wb, "PopsimExpectedSoL", "Popsim!$C$97:$C$111")

    # Social Privileges: rows 79-93, col B.
    for i, _ in enumerate(classes, start=79):
        pop.cell(row=i, column=1, value=classes[i - 79][0])
        pop.cell(row=i, column=2, value=0.30 + (i - 79) * 0.02)
    _add_name(wb, "PopsimSocialPrivileges", "Popsim!$B$79:$B$93")

    # Status block: rows 133-147. C radicalisation, E abject poverty, G organisation, H literacy,
    # J vote eligibility, L votes total, M vote share.
    for i, _ in enumerate(classes, start=133):
        pop.cell(row=i, column=1, value=classes[i - 133][0])
        pop.cell(row=i, column=3, value=0.20 + (i - 133) * 0.01)  # radicalisation
        pop.cell(row=i, column=5, value=0.10)                      # abject poverty
        pop.cell(row=i, column=7, value=0.30)                      # organisation
        pop.cell(row=i, column=8, value=0.65)                      # literacy
        pop.cell(row=i, column=10, value=0.85)                     # vote eligibility
        pop.cell(row=i, column=12, value=int(classes[i - 133][2] * 0.85))  # votes total
        pop.cell(row=i, column=13, value=0.10)                     # vote share
    _add_name(wb, "PopsimRadicalisation", "Popsim!$C$133:$C$147")
    _add_name(wb, "PopsimAbjectPoverty", "Popsim!$E$133:$E$147")
    _add_name(wb, "PopsimOrganisation", "Popsim!$G$133:$G$147")
    _add_name(wb, "PopsimLiteracy", "Popsim!$H$133:$H$147")
    _add_name(wb, "PopsimVotesTotal", "Popsim!$L$133:$L$147")
    _add_name(wb, "PopsimVoteShare", "Popsim!$M$133:$M$147")

    # Satisfaction M151:M165
    for i, _ in enumerate(classes, start=151):
        pop.cell(row=i, column=13, value=0.40)
    _add_name(wb, "PopsimSatisfaction", "Popsim!$M$151:$M$165")

    # ---- Wages & Welfare sheet ----
    ww = wb.create_sheet("Wages & Welfare")
    # AdditionalIncomeRange = H23:I37 — col H per-class total Additional Income, col I label.
    # For test purposes, we fake the breakdown across cols B-E for rows 23-37,
    # with the total in col F mirrored to H.
    for i, _ in enumerate(classes, start=23):
        ww.cell(row=i, column=1, value=classes[i - 23][0])
        ww.cell(row=i, column=2, value=0.5)   # welfare
        ww.cell(row=i, column=3, value=0.0)   # dividends
        ww.cell(row=i, column=4, value=0.2)   # subsidies
        ww.cell(row=i, column=5, value=0.0)   # other
        ww.cell(row=i, column=6, value=0.7)   # total
        ww.cell(row=i, column=8, value=0.7)   # mirror for AdditionalIncomeRange
        ww.cell(row=i, column=9, value="total")
    _add_name(wb, "AdditionalIncomeRange", "'Wages & Welfare'!$H$23:$I$37")
    # Per-class breakdown read directly (cols B-E) — track via an aux range too.
    _add_name(wb, "AdditionalIncomeBreakdown", "'Wages & Welfare'!$A$23:$F$37")
```

- [ ] **Step 2: Write the failing extractor test**

`tests/extractors/test_pops.py`:

```python
"""Tests for the Pops Detailed page extractor."""
from __future__ import annotations

from extractors.pops import extract


def test_extract_returns_class_records(wb):
    result = extract(wb)
    assert len(result["classes"]) == 11


def test_extract_income_block_complete(wb):
    result = extract(wb)
    bureaucrats = result["classes"][0]
    inc = bureaucrats["income"]
    assert inc["gross_per_cap"] == 12.0
    assert inc["income_tax_per_cap"] == 1.2
    assert inc["wealth_tax_per_cap"] == 0.24
    assert inc["effective_tax_rate"] == 0.12
    assert inc["disposable_per_cap"] == 12.0 * 0.88
    # Total income before tax = pop * gross_per_cap
    assert inc["total_gross"] == bureaucrats["pop"] * 12.0


def test_extract_status_block_complete(wb):
    result = extract(wb)
    bureaucrats = result["classes"][0]
    s = bureaucrats["status"]
    assert s["radicalisation"] == 0.20
    assert s["abject_poverty"] == 0.10
    assert s["organisation"] == 0.30
    assert s["literacy"] == 0.65


def test_extract_additional_income_breakdown(wb):
    result = extract(wb)
    a = result["classes"][0]["additional_income"]
    assert a["welfare"] == 0.5
    assert a["subsidies"] == 0.2
    assert a["total"] == 0.7


def test_extract_satisfaction_present(wb):
    result = extract(wb)
    assert result["classes"][0]["satisfaction"] == 0.40


def test_extract_living_standards_block(wb):
    result = extract(wb)
    b = result["classes"][0]
    assert b["standard_of_living"] == 0.42
    assert b["expected_sol"] == 0.55
    assert b["social_privileges"] == 0.30
```

- [ ] **Step 3: Run test to verify it fails**

```bash
uv run pytest tests/extractors/test_pops.py -v
```

Expected: FAIL with module-not-found.

- [ ] **Step 4: Write `scripts/extractors/pops.py`**

```python
"""Extract data for the Pops Detailed (per-class drilldown) page."""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, filter_blank_rows, read_named_range


def extract(wb) -> dict[str, Any]:
    classes = filter_blank_rows(read_named_range(wb, "ClassTable"))
    pops = read_named_range(wb, "PopsimPop")

    sol = read_named_range(wb, "PopsimSoL")
    expected_sol = read_named_range(wb, "PopsimExpectedSoL")
    sp = read_named_range(wb, "PopsimSocialPrivileges")
    gross = read_named_range(wb, "PopsimGrossPerCap")
    disposable = read_named_range(wb, "PopsimDisposablePerCap")
    wealth_pc = read_named_range(wb, "PopsimWealthPerCap")
    radical = read_named_range(wb, "PopsimRadicalisation")
    poverty = read_named_range(wb, "PopsimAbjectPoverty")
    org = read_named_range(wb, "PopsimOrganisation")
    lit = read_named_range(wb, "PopsimLiteracy")
    votes_total = read_named_range(wb, "PopsimVotesTotal")
    vote_share = read_named_range(wb, "PopsimVoteShare")
    sat = read_named_range(wb, "PopsimSatisfaction")
    add_income = read_named_range(wb, "AdditionalIncomeBreakdown")

    # Read tax/cap & effective-rate via direct cell access — these aren't named ranges
    # but live at known offsets in the Wealth & Income block (rows 61-75).
    income_tax = [coerce_number(wb["Popsim"].cell(row=61 + i, column=4).value) for i in range(15)]
    wealth_tax = [coerce_number(wb["Popsim"].cell(row=61 + i, column=5).value) for i in range(15)]
    effective_rate = [coerce_number(wb["Popsim"].cell(row=61 + i, column=6).value) for i in range(15)]
    total_post_tax = [coerce_number(wb["Popsim"].cell(row=61 + i, column=10).value) for i in range(15)]

    out: list[dict[str, Any]] = []
    for i, row in enumerate(classes):
        name = row[0]
        pop = coerce_number(pops[i][0]) if i < len(pops) else None
        if pop is None:
            continue
        g = coerce_number(gross[i][0]) if i < len(gross) else None
        d = coerce_number(disposable[i][0]) if i < len(disposable) else None
        out.append({
            "name": name,
            "pop": int(pop),
            "standard_of_living": coerce_number(sol[i][0]) if i < len(sol) else None,
            "expected_sol": coerce_number(expected_sol[i][0]) if i < len(expected_sol) else None,
            "social_privileges": coerce_number(sp[i][0]) if i < len(sp) else None,
            "income": {
                "gross_per_cap": g,
                "total_gross": (pop * g) if (pop is not None and g is not None) else None,
                "income_tax_per_cap": income_tax[i],
                "wealth_tax_per_cap": wealth_tax[i],
                "effective_tax_rate": effective_rate[i],
                "disposable_per_cap": d,
                "total_disposable": total_post_tax[i],
            },
            "wealth": {
                "per_cap": coerce_number(wealth_pc[i][0]) if i < len(wealth_pc) else None,
                "total": (coerce_number(wealth_pc[i][0]) * pop) if (i < len(wealth_pc) and wealth_pc[i][0] is not None) else None,
            },
            "additional_income": _additional_income_row(add_income, i),
            "status": {
                "radicalisation": coerce_number(radical[i][0]) if i < len(radical) else None,
                "abject_poverty": coerce_number(poverty[i][0]) if i < len(poverty) else None,
                "organisation": coerce_number(org[i][0]) if i < len(org) else None,
                "literacy": coerce_number(lit[i][0]) if i < len(lit) else None,
                "votes_total": coerce_number(votes_total[i][0]) if i < len(votes_total) else None,
                "vote_share": coerce_number(vote_share[i][0]) if i < len(vote_share) else None,
            },
            "satisfaction": coerce_number(sat[i][0]) if i < len(sat) else None,
        })

    return {"classes": out}


def _additional_income_row(rows, i):
    if i >= len(rows):
        return {"welfare": None, "dividends": None, "subsidies": None, "other": None, "total": None}
    r = rows[i]
    return {
        "welfare": coerce_number(r[1]) if len(r) > 1 else None,
        "dividends": coerce_number(r[2]) if len(r) > 2 else None,
        "subsidies": coerce_number(r[3]) if len(r) > 3 else None,
        "other": coerce_number(r[4]) if len(r) > 4 else None,
        "total": coerce_number(r[5]) if len(r) > 5 else None,
    }
```

- [ ] **Step 5: Register extractor and add required ranges**

In `scripts/sync_sheet.py`:
```python
from extractors import pops as ex_pops
# ...
extractors = [
    ("status", ex_status.extract),
    ("population", ex_population.extract),
    ("pops", ex_pops.extract),
]
```

In `scripts/validate_schema.py`, append to `BASE_REQUIRED_RANGES`:
```python
    "PopsimGrossPerCap",
    "PopsimDisposablePerCap",
    "PopsimWealthPerCap",
    "PopsimSoL",
    "PopsimExpectedSoL",
    "PopsimSocialPrivileges",
    "PopsimRadicalisation",
    "PopsimAbjectPoverty",
    "PopsimOrganisation",
    "PopsimLiteracy",
    "PopsimVotesTotal",
    "PopsimVoteShare",
    "PopsimSatisfaction",
    "AdditionalIncomeBreakdown",
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
uv run pytest tests/extractors/test_pops.py -v
```

Expected: 6 tests PASS.

- [ ] **Step 7: Write `src/lib/stores/pops.js`**

```javascript
import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const pops = writable(null);
export const popsError = writable(null);

export async function loadPops(syncedAt) {
  try {
    pops.set(await fetchPage('pops', syncedAt));
  } catch (err) {
    popsError.set(err.message);
  }
}
```

- [ ] **Step 8: Write `src/routes/Pops.svelte`**

```svelte
<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { pops, popsError, loadPops } from '../lib/stores/pops.js';

  let selected = null;

  onMount(() => {
    if ($meta?.synced_at) loadPops($meta.synced_at);
  });

  $: if ($pops && !selected) selected = $pops.classes[0]?.name;
  $: current = $pops?.classes.find((c) => c.name === selected) ?? null;
  $: critRad = current && current.status.radicalisation > 0.5;
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider mb-4 border-b-4 border-border pb-2">
    Pops Detailed
  </h2>

  {#if $popsError}
    <p class="text-crit">{$popsError}</p>
  {:else if !$pops}
    <p class="text-muted">Loading…</p>
  {:else}
    <div class="flex flex-wrap gap-2 mb-6">
      {#each $pops.classes as c}
        <button
          class="px-3 py-1 border-2 border-border font-mono text-xs uppercase tracking-widest"
          class:bg-border={selected === c.name}
          class:text-bg={selected === c.name}
          on:click={() => (selected = c.name)}
        >
          {c.name}
        </button>
      {/each}
    </div>

    {#if current}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="border-2 border-border p-3">
          <h3 class="text-xs uppercase tracking-widest text-muted mb-2">Living Standards</h3>
          <dl class="space-y-1 text-sm">
            <div class="flex justify-between"><dt>Standard of Living</dt><dd>{current.standard_of_living?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Expected SoL</dt><dd>{current.expected_sol?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Social Privileges</dt><dd>{current.social_privileges?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Satisfaction</dt><dd>{current.satisfaction?.toFixed(2)}</dd></div>
          </dl>
        </div>

        <div class="border-2 border-border p-3">
          <h3 class="text-xs uppercase tracking-widest text-muted mb-2">Income (per cap)</h3>
          <dl class="space-y-1 text-sm">
            <div class="flex justify-between"><dt>Gross / cap</dt><dd>{current.income.gross_per_cap?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Income Tax / cap</dt><dd>{current.income.income_tax_per_cap?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Wealth Tax / cap</dt><dd>{current.income.wealth_tax_per_cap?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Effective Tax Rate</dt><dd>{(current.income.effective_tax_rate * 100).toFixed(1)}%</dd></div>
            <div class="flex justify-between"><dt>Disposable / cap</dt><dd>{current.income.disposable_per_cap?.toFixed(2)}</dd></div>
          </dl>
        </div>

        <div class="border-2 border-border p-3">
          <h3 class="text-xs uppercase tracking-widest text-muted mb-2">Income (totals)</h3>
          <dl class="space-y-1 text-sm">
            <div class="flex justify-between"><dt>Total Pre-tax</dt><dd>{current.income.total_gross?.toFixed(0)}</dd></div>
            <div class="flex justify-between"><dt>Total Post-tax</dt><dd>{current.income.total_disposable?.toFixed(0)}</dd></div>
            <div class="flex justify-between"><dt>Class Wealth</dt><dd>{current.wealth.total?.toFixed(0)}</dd></div>
            <div class="flex justify-between"><dt>Wealth / cap</dt><dd>{current.wealth.per_cap?.toFixed(2)}</dd></div>
          </dl>
        </div>

        <div class="border-2 border-border p-3">
          <h3 class="text-xs uppercase tracking-widest text-muted mb-2">Additional Income</h3>
          <dl class="space-y-1 text-sm">
            <div class="flex justify-between"><dt>Welfare</dt><dd>{current.additional_income.welfare?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Dividends</dt><dd>{current.additional_income.dividends?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Subsidies</dt><dd>{current.additional_income.subsidies?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Other</dt><dd>{current.additional_income.other?.toFixed(2)}</dd></div>
            <div class="flex justify-between font-bold"><dt>Total</dt><dd>{current.additional_income.total?.toFixed(2)}</dd></div>
          </dl>
        </div>

        <div class="border-2 border-border p-3" class:border-crit={critRad}>
          <h3 class="text-xs uppercase tracking-widest text-muted mb-2">Status</h3>
          <dl class="space-y-1 text-sm">
            <div class="flex justify-between" class:text-crit={critRad}><dt>Radicalisation</dt><dd>{current.status.radicalisation?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Abject Poverty</dt><dd>{current.status.abject_poverty?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Organisation</dt><dd>{current.status.organisation?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Literacy</dt><dd>{current.status.literacy?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Vote Share</dt><dd>{(current.status.vote_share * 100)?.toFixed(1)}%</dd></div>
          </dl>
        </div>
      </div>
    {/if}
  {/if}
</section>
```

- [ ] **Step 9: Wire route in `src/App.svelte`**

```javascript
import Pops from './routes/Pops.svelte';
// ...
'/pops': Pops,
```

- [ ] **Step 10: Re-sync + verify in dev**

```bash
uv run python scripts/sync_sheet.py --xlsx /tmp/test_wb.xlsx --out-dir public/data
npm run dev
```

`/#/pops` shows class chips, click each to switch — all five panels populate.

- [ ] **Step 11: Commit**

```bash
git add tests/fixtures/build_test_workbook.py scripts/extractors/pops.py tests/extractors/test_pops.py scripts/sync_sheet.py scripts/validate_schema.py src/lib/stores/pops.js src/routes/Pops.svelte src/App.svelte
git commit -m "feat: pops detailed page with class chips and 5-panel drilldown"
```

---

### Task 20: GoIs page

**Files:**
- Modify: `tests/fixtures/build_test_workbook.py` (add Politics GoI block + GoI Modifiers + GoI Benefits)
- Create: `scripts/extractors/gois.py`
- Create: `tests/extractors/test_gois.py`
- Create: `src/lib/stores/gois.js`
- Create: `src/routes/GoIs.svelte`
- Modify: `scripts/sync_sheet.py`, `scripts/validate_schema.py`, `src/App.svelte`

- [ ] **Step 1: Extend the fixture**

Append to `build()`:

```python
    # Politics GoI block: rows 24-31 (8 slots, 4 live + 4 blank)
    gois = [
        ("Founders", "Bureaucrats", 0.30, 0.55, "Reformist"),
        ("Capitalists", "Capitalists", 0.28, 0.50, "Pragmatic"),
        ("Security", "Security", 0.20, 0.60, "Defensive"),
        ("Unionists", "Industrial Workers", 0.22, 0.45, "Activist"),
    ]
    for i, (name, main_class, infl, appr, approach) in enumerate(gois, start=24):
        pol.cell(row=i, column=1, value=name)
        pol.cell(row=i, column=2, value=infl)        # GM-override influence
        pol.cell(row=i, column=6, value=appr)        # Approval (col F)
        pol.cell(row=i, column=9, value=int(8 * infl))  # Council seats (col I)
        # Effective worldview cols K-P (11-16)
        for axis in range(6):
            pol.cell(row=i, column=11 + axis, value=4.0 + (i - 24) * 0.2 + axis * 0.1)
        pol.cell(row=i, column=17, value=0.10 + (i - 24) * 0.05)  # Mad Index col Q
        pol.cell(row=i, column=18, value=approach)                # Approach col R
        pol.cell(row=i, column=19, value=infl)                    # Derived Influence col S
        pol.cell(row=i, column=20, value=f"{i - 23} / 3 unlocked")  # Active Benefits col T
    _add_name(wb, "GoINames", "Politics!$A$24:$A$31")
    _add_name(wb, "GoIDerivedInfluence", "Politics!$S$24:$S$31")
    _add_name(wb, "GoIApproval", "Politics!$F$24:$F$31")
    _add_name(wb, "GoIEffectiveWorldview", "Politics!$K$24:$P$31")
    _add_name(wb, "GoIMadIndex", "Politics!$Q$24:$Q$31")
    _add_name(wb, "GoIApproach", "Politics!$R$24:$R$31")
    _add_name(wb, "GoIActiveBenefits", "Politics!$T$24:$T$31")

    # Sub-faction detail block (per spec §3.5: range deferred to extraction-time;
    # for the fixture we put it at U24:AC31 so test asserts can pin it).
    sub_factions = [
        ("Founders", "Constitutional Loyalists", 0.40, 0.5, "Defend constitution"),
        ("Founders", "Reformist Founders", 0.35, 0.6, "Modernise institutions"),
        ("Founders", "Hardliner Founders", 0.25, 0.4, "Restore order"),
        ("Capitalists", "Industrialists", 0.40, 0.5, "Heavy industry growth"),
        ("Capitalists", "Extraction Cartels", 0.35, 0.4, "Mining priority"),
    ]
    for i, (parent, sf_name, infl, appr, goal) in enumerate(sub_factions, start=24):
        pol.cell(row=i, column=21, value=parent)        # U
        pol.cell(row=i, column=22, value=sf_name)       # V
        pol.cell(row=i, column=23, value=infl)          # W influence
        pol.cell(row=i, column=24, value=appr)          # X approval
        pol.cell(row=i, column=25, value=goal)          # Y minor goal 1
    _add_name(wb, "SubFactionsBlock", "Politics!$U$24:$Y$36")

    # GoI Modifiers: PopCaptureBase B5:E15 (11 classes × 4 GoIs)
    gm = wb.create_sheet("GoI Modifiers")
    for i, (name, _, _, _) in enumerate(classes, start=5):
        gm.cell(row=i, column=1, value=name)
        for j in range(4):
            gm.cell(row=i, column=2 + j, value=0.20 + (j * 0.10))
    _add_name(wb, "PopCaptureBase", "'GoI Modifiers'!$B$5:$E$15")

    # GoI Benefits: A4:D15
    gb = wb.create_sheet("GoI Benefits")
    benefits = [
        ("Founders", 0.30, "Tax Holiday", "10% reduction"),
        ("Founders", 0.45, "Free Press", "Public approval +"),
        ("Founders", 0.60, "Constitutional Reform", "Stability +"),
        ("Capitalists", 0.30, "Subsidy", "Industry yield +"),
        ("Capitalists", 0.45, "Deregulation", "Crisis +"),
        ("Capitalists", 0.60, "Charter", "New corp"),
        ("Security", 0.30, "Patrol", "Security yield +"),
        ("Security", 0.45, "Curfew", "Stability + / approval -"),
        ("Security", 0.60, "Martial Law", "Big stab + / approval --"),
        ("Unionists", 0.30, "Min Wage", "Bargain +"),
        ("Unionists", 0.45, "Strike Right", "Bargain ++ / Crisis +"),
        ("Unionists", 0.60, "Co-op Charter", "New worker co-op"),
    ]
    for i, (goi, thresh, name, desc) in enumerate(benefits, start=4):
        gb.cell(row=i, column=1, value=goi)
        gb.cell(row=i, column=2, value=thresh)
        gb.cell(row=i, column=3, value=name)
        gb.cell(row=i, column=4, value=desc)
    _add_name(wb, "GoIBenefitsTable", "'GoI Benefits'!$A$4:$D$15")
```

- [ ] **Step 2: Write the failing extractor test**

`tests/extractors/test_gois.py`:

```python
"""Tests for the GoIs page extractor."""
from __future__ import annotations

from extractors.gois import extract


def test_extract_returns_live_gois_only(wb):
    result = extract(wb)
    # Fixture has 4 live + 4 blank slots.
    assert len(result["gois"]) == 4
    assert result["gois"][0]["name"] == "Founders"


def test_extract_goi_record_shape(wb):
    g = extract(wb)["gois"][0]
    assert g["main_class"] == "Bureaucrats"
    assert g["derived_influence"] == 0.30
    assert g["approval"] == 0.55
    assert g["approach"] == "Reformist"
    assert isinstance(g["effective_worldview"], dict)
    assert g["mad_index"] == 0.10


def test_extract_active_benefits_parsed(wb):
    g = extract(wb)["gois"][0]
    assert g["active_benefits"]["unlocked"] == 1
    assert g["active_benefits"]["total"] == 3
    assert isinstance(g["active_benefits"]["unlocked_list"], list)


def test_extract_sub_factions_grouped_under_parent(wb):
    result = extract(wb)
    founders = next(g for g in result["gois"] if g["name"] == "Founders")
    sf_names = [s["name"] for s in founders["sub_factions"]]
    assert "Constitutional Loyalists" in sf_names
    assert len(founders["sub_factions"]) == 3


def test_extract_pop_capture_matrix_shape(wb):
    matrix = extract(wb)["pop_capture_matrix"]
    assert len(matrix["classes"]) == 11
    assert len(matrix["gois"]) == 4
    assert len(matrix["values"]) == 11
    assert all(len(row) == 4 for row in matrix["values"])
```

- [ ] **Step 3: Run test (FAILS — module missing)**

```bash
uv run pytest tests/extractors/test_gois.py -v
```

- [ ] **Step 4: Write `scripts/extractors/gois.py`**

```python
"""Extract data for the GoIs page."""
from __future__ import annotations

import re
from typing import Any

from extractors._common import coerce_number, filter_blank_rows, read_named_range

WORLDVIEW_AXES = ["expansion", "authority", "corporate", "technocratic", "faith", "materialist"]


def extract(wb) -> dict[str, Any]:
    names = [r[0] for r in read_named_range(wb, "GoINames")]
    derived = read_named_range(wb, "GoIDerivedInfluence")
    approval = read_named_range(wb, "GoIApproval")
    worldview = read_named_range(wb, "GoIEffectiveWorldview")
    mad = read_named_range(wb, "GoIMadIndex")
    approach = read_named_range(wb, "GoIApproach")
    benefits_raw = read_named_range(wb, "GoIActiveBenefits")
    sub_factions_block = read_named_range(wb, "SubFactionsBlock")
    benefits_table = read_named_range(wb, "GoIBenefitsTable")
    capture = read_named_range(wb, "PopCaptureBase")
    classes = filter_blank_rows(read_named_range(wb, "ClassTable"))

    # Determine which GoI rows are live (non-blank name).
    live_indices = [i for i, n in enumerate(names) if n not in (None, "")]
    live_names = [names[i] for i in live_indices]

    # Look up each live GoI's main_class via the sub-faction parent col is wrong;
    # main_class is hard-coded on the design — derive it from the spec list.
    # For accuracy at sync time, prefer to read from a dedicated named range if/when added.
    # Until then, derive from the GoI Modifiers sheet's first column on a per-GoI basis.
    main_classes = _infer_main_classes(live_names, capture, classes)

    out_gois: list[dict[str, Any]] = []
    for live_pos, src_idx in enumerate(live_indices):
        wv_row = worldview[src_idx] if src_idx < len(worldview) else [None] * 6
        out_gois.append({
            "name": names[src_idx],
            "main_class": main_classes.get(names[src_idx]),
            "derived_influence": coerce_number(derived[src_idx][0]) if src_idx < len(derived) else None,
            "approval": coerce_number(approval[src_idx][0]) if src_idx < len(approval) else None,
            "approach": approach[src_idx][0] if src_idx < len(approach) else None,
            "mad_index": coerce_number(mad[src_idx][0]) if src_idx < len(mad) else None,
            "effective_worldview": {axis: coerce_number(wv_row[i]) for i, axis in enumerate(WORLDVIEW_AXES)},
            "active_benefits": _parse_active_benefits(
                benefits_raw[src_idx][0] if src_idx < len(benefits_raw) else None,
                names[src_idx],
                benefits_table,
            ),
            "sub_factions": _sub_factions_for(names[src_idx], sub_factions_block),
        })

    return {
        "gois": out_gois,
        "pop_capture_matrix": {
            "classes": [c[0] for c in classes],
            "gois": live_names,
            "values": _capture_values(capture, len(classes), live_indices),
        },
    }


_BENEFIT_COUNT_RE = re.compile(r"(\d+)\s*/\s*(\d+)")


def _parse_active_benefits(text, goi_name, benefits_table):
    if not text:
        return {"unlocked": 0, "total": 0, "unlocked_list": []}
    m = _BENEFIT_COUNT_RE.search(str(text))
    unlocked = int(m.group(1)) if m else 0
    total = int(m.group(2)) if m else 0
    matches = [r for r in benefits_table if r and r[0] == goi_name]
    unlocked_list = [r[2] for r in matches[:unlocked]]
    return {"unlocked": unlocked, "total": total, "unlocked_list": unlocked_list}


def _sub_factions_for(goi_name, block):
    out = []
    for r in block:
        if not r or r[0] != goi_name:
            continue
        out.append({
            "name": r[1] if len(r) > 1 else None,
            "influence": coerce_number(r[2]) if len(r) > 2 else None,
            "approval": coerce_number(r[3]) if len(r) > 3 else None,
            "minor_goals": [r[4]] if (len(r) > 4 and r[4]) else [],
        })
    return out


def _infer_main_classes(live_names, capture_matrix, classes):
    """Best-effort: pick the class with the highest base capture for each GoI."""
    if not capture_matrix or not classes:
        return {}
    out = {}
    for j, name in enumerate(live_names):
        best_i = max(range(len(capture_matrix)), key=lambda i: coerce_number(capture_matrix[i][j]) or 0)
        out[name] = classes[best_i][0] if best_i < len(classes) else None
    return out


def _capture_values(capture, n_classes, live_indices):
    rows = []
    for i in range(n_classes):
        if i >= len(capture):
            rows.append([None] * len(live_indices))
            continue
        row = [coerce_number(capture[i][j]) for j in live_indices]
        rows.append(row)
    return rows
```

- [ ] **Step 5: Register extractor + named ranges**

In `sync_sheet.py`:
```python
from extractors import gois as ex_gois
# ...
("gois", ex_gois.extract),
```

In `validate_schema.py`, append:
```python
    "GoINames",
    "GoIDerivedInfluence",
    "GoIApproval",
    "GoIEffectiveWorldview",
    "GoIMadIndex",
    "GoIApproach",
    "GoIActiveBenefits",
    "SubFactionsBlock",
    "GoIBenefitsTable",
    "PopCaptureBase",
```

- [ ] **Step 6: Run extractor tests**

```bash
uv run pytest tests/extractors/test_gois.py -v
```

Expected: 5 PASS.

- [ ] **Step 7: Write `src/lib/stores/gois.js`**

```javascript
import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const gois = writable(null);
export const goisError = writable(null);

export async function loadGois(syncedAt) {
  try {
    gois.set(await fetchPage('gois', syncedAt));
  } catch (err) {
    goisError.set(err.message);
  }
}
```

- [ ] **Step 8: Write `src/routes/GoIs.svelte`**

```svelte
<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { gois, goisError, loadGois } from '../lib/stores/gois.js';
  import RadarChart from '../lib/components/RadarChart.svelte';
  import Heatmap from '../lib/components/Heatmap.svelte';

  onMount(() => {
    if ($meta?.synced_at) loadGois($meta.synced_at);
  });

  const AXES = ['expansion', 'authority', 'corporate', 'technocratic', 'faith', 'materialist'];
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider mb-4 border-b-4 border-border pb-2">
    Groups of Interest
  </h2>

  {#if $goisError}
    <p class="text-crit">{$goisError}</p>
  {:else if !$gois}
    <p class="text-muted">Loading…</p>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      {#each $gois.gois as g}
        <div class="border-4 border-border p-4">
          <div class="flex justify-between items-baseline mb-2">
            <h3 class="font-mono font-extrabold text-lg uppercase tracking-wider">{g.name}</h3>
            <span class="text-xs text-muted">{g.main_class ?? '—'}</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-xs mb-3">
            <div><div class="text-muted uppercase tracking-widest">Influence</div><div class="font-bold text-base">{(g.derived_influence * 100).toFixed(0)}%</div></div>
            <div><div class="text-muted uppercase tracking-widest">Approval</div><div class="font-bold text-base">{(g.approval * 100).toFixed(0)}%</div></div>
            <div><div class="text-muted uppercase tracking-widest">Mad Index</div><div class="font-bold text-base">{g.mad_index?.toFixed(2)}</div></div>
          </div>
          <div class="text-xs text-muted uppercase tracking-widest mb-2">{g.approach}</div>
          <div class="flex gap-3 mb-3">
            <RadarChart axes={AXES.map((a) => ({ label: a, value: g.effective_worldview[a] }))} size={140} />
            <div class="flex-1 text-xs">
              <div class="text-muted uppercase tracking-widest mb-1">Active Benefits</div>
              <div class="font-bold mb-1">{g.active_benefits.unlocked} / {g.active_benefits.total} unlocked</div>
              <ul class="list-disc list-inside">
                {#each g.active_benefits.unlocked_list as b}
                  <li>{b}</li>
                {/each}
              </ul>
            </div>
          </div>
          {#if g.sub_factions.length > 0}
            <div class="text-xs">
              <div class="text-muted uppercase tracking-widest mb-1">Sub-factions</div>
              <ul class="space-y-1">
                {#each g.sub_factions as s}
                  <li class="flex justify-between border-b border-border/30 pb-1">
                    <span>{s.name}</span>
                    <span class="text-muted">{(s.influence * 100).toFixed(0)}% · approval {(s.approval * 100).toFixed(0)}%</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Pop Capture Base</h3>
    <Heatmap
      rowLabels={$gois.pop_capture_matrix.classes}
      colLabels={$gois.pop_capture_matrix.gois}
      values={$gois.pop_capture_matrix.values}
    />
  {/if}
</section>
```

- [ ] **Step 9: Wire route + re-sync + verify**

```javascript
// src/App.svelte
import GoIs from './routes/GoIs.svelte';
'/gois': GoIs,
```

```bash
uv run python scripts/sync_sheet.py --xlsx /tmp/test_wb.xlsx --out-dir public/data
npm run dev
```

`/#/gois` shows 4 GoI panels with radars, active benefits, sub-factions; PopCapture heatmap below.

- [ ] **Step 10: Commit**

```bash
git add tests/fixtures/build_test_workbook.py scripts/extractors/gois.py tests/extractors/test_gois.py scripts/sync_sheet.py scripts/validate_schema.py src/lib/stores/gois.js src/routes/GoIs.svelte src/App.svelte
git commit -m "feat: gois page with 4 panels, radar, sub-factions, popcapture heatmap"
```

---

### Task 21: Parties page

**Files:**
- Modify: `tests/fixtures/build_test_workbook.py` (Parties sheet, 15 slots, default blank)
- Create: `scripts/extractors/parties.py`
- Create: `tests/extractors/test_parties.py`
- Create: `src/lib/stores/parties.js`
- Create: `src/routes/Parties.svelte`
- Modify: `scripts/sync_sheet.py`, `scripts/validate_schema.py`, `src/App.svelte`

- [ ] **Step 1: Extend the fixture**

Append to `build()`:

```python
    # Parties sheet: 15 slots rows 4-18. Two seeded for tests; the rest blank.
    pa = wb.create_sheet("Parties")
    pa["A1"] = "Parties Master"
    seeded = [
        # name, founded, establishment, 6-axis stance, weighted stance(6), Mad, ClosestGoI, Compat[4], ClassCompat[15], Estimated, VoteShare
        ("Liberty Now", True, 0.55, [5, 5, 4, 5, 4, 4]),
        ("People's Voice", True, 0.40, [3, 3, 6, 3, 4, 5]),
    ]
    for slot, (name, founded, est, stance) in enumerate(seeded):
        row = 4 + slot
        pa.cell(row=row, column=1, value=name)
        pa.cell(row=row, column=2, value=founded)
        pa.cell(row=row, column=3, value=est)
        for k, v in enumerate(stance):
            pa.cell(row=row, column=4 + k, value=v)
        # Weighted stance cols J-O (10-15) — same numbers for fixture
        for k, v in enumerate(stance):
            pa.cell(row=row, column=10 + k, value=v)
        pa.cell(row=row, column=16, value=0.15)              # Mad Index P
        pa.cell(row=row, column=17, value=["Founders", "Unionists"][slot])  # Closest GoI Q
        # GoI compat R-Y (cols 18-21 for 4 live GoIs)
        for j in range(4):
            pa.cell(row=row, column=18 + j, value=0.6 - j * 0.1 if slot == 0 else 0.3 + j * 0.1)
        # Class compat Z-AN (cols 26-40 for 15 class slots)
        for j in range(15):
            pa.cell(row=row, column=26 + j, value=0.5)
        pa.cell(row=row, column=41, value=0.30 if slot == 0 else 0.25)  # Estimated Support AO
        pa.cell(row=row, column=42, value=0.28 if slot == 0 else 0.22)  # Vote Share AP
    _add_name(wb, "PartiesBlock", "Parties!$A$4:$AP$18")
```

- [ ] **Step 2: Write the failing extractor test**

`tests/extractors/test_parties.py`:

```python
"""Tests for the Parties page extractor."""
from __future__ import annotations

from extractors.parties import extract


def test_extract_returns_only_founded_parties(wb):
    result = extract(wb)
    # Fixture: 2 seeded, 13 blank.
    assert len(result["parties"]) == 2
    assert result["parties"][0]["name"] == "Liberty Now"


def test_extract_party_record_shape(wb):
    p = extract(wb)["parties"][0]
    assert p["founded"] is True
    assert p["establishment"] == 0.55
    assert isinstance(p["stance"], dict)
    assert set(p["stance"].keys()) == {"expansion", "authority", "corporate", "technocratic", "faith", "materialist"}
    assert p["closest_goi"] == "Founders"
    assert p["estimated_support"] == 0.30
    assert p["vote_share"] == 0.28


def test_extract_compat_matrices_shape(wb):
    result = extract(wb)
    goi_compat = result["goi_compat_matrix"]
    assert len(goi_compat["parties"]) == 2
    assert len(goi_compat["gois"]) == 4
    assert len(goi_compat["values"]) == 2
    assert len(goi_compat["values"][0]) == 4

    class_compat = result["class_compat_matrix"]
    assert len(class_compat["parties"]) == 2
    assert len(class_compat["classes"]) == 11  # blanks filtered
    assert len(class_compat["values"]) == 2
    assert len(class_compat["values"][0]) == 11


def test_extract_empty_state_when_no_parties_founded(wb):
    # Wipe out the founded flag in both seeded rows.
    wb["Parties"]["B4"].value = False
    wb["Parties"]["B5"].value = False
    result = extract(wb)
    assert result["parties"] == []
    assert result["goi_compat_matrix"]["parties"] == []
```

- [ ] **Step 3: Run test (FAILS)**

```bash
uv run pytest tests/extractors/test_parties.py -v
```

- [ ] **Step 4: Write `scripts/extractors/parties.py`**

```python
"""Extract data for the Parties page."""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, filter_blank_rows, read_named_range

AXES = ["expansion", "authority", "corporate", "technocratic", "faith", "materialist"]


def extract(wb) -> dict[str, Any]:
    block = read_named_range(wb, "PartiesBlock")
    goi_names = [r[0] for r in read_named_range(wb, "GoINames") if r and r[0]]
    classes = filter_blank_rows(read_named_range(wb, "ClassTable"))

    # Live class slot indices (relative to the 15-slot ClassTable) so we can
    # subset the 15-col class-compat block down to live classes.
    full_class_block = read_named_range(wb, "ClassTable")
    live_class_indices = [i for i, r in enumerate(full_class_block) if r and r[0] not in (None, "")]

    parties_out: list[dict[str, Any]] = []
    for r in block:
        if not r or not r[0] or r[1] is not True:
            continue  # Skip blank slots and non-founded slots.
        stance = {axis: coerce_number(r[3 + i]) for i, axis in enumerate(AXES)}
        goi_compat_full = [coerce_number(r[17 + j]) for j in range(8)]
        class_compat_full = [coerce_number(r[25 + j]) for j in range(15)]
        parties_out.append({
            "name": r[0],
            "founded": True,
            "establishment": coerce_number(r[2]),
            "stance": stance,
            "weighted_stance": {axis: coerce_number(r[9 + i]) for i, axis in enumerate(AXES)},
            "mad_index": coerce_number(r[15]),
            "closest_goi": r[16],
            "goi_compat": goi_compat_full[: len(goi_names)],
            "class_compat": [class_compat_full[i] for i in live_class_indices],
            "estimated_support": coerce_number(r[40]),
            "vote_share": coerce_number(r[41]),
        })

    return {
        "parties": parties_out,
        "goi_compat_matrix": {
            "parties": [p["name"] for p in parties_out],
            "gois": goi_names,
            "values": [p["goi_compat"] for p in parties_out],
        },
        "class_compat_matrix": {
            "parties": [p["name"] for p in parties_out],
            "classes": [c[0] for c in classes],
            "values": [p["class_compat"] for p in parties_out],
        },
    }
```

- [ ] **Step 5: Register + add `PartiesBlock` to required ranges**

```python
# scripts/sync_sheet.py
from extractors import parties as ex_parties
("parties", ex_parties.extract),
```

```python
# scripts/validate_schema.py — append to BASE_REQUIRED_RANGES
"PartiesBlock",
```

- [ ] **Step 6: Run extractor tests**

```bash
uv run pytest tests/extractors/test_parties.py -v
```

Expected: 4 PASS.

- [ ] **Step 7: Write `src/lib/stores/parties.js`**

```javascript
import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const parties = writable(null);
export const partiesError = writable(null);

export async function loadParties(syncedAt) {
  try {
    parties.set(await fetchPage('parties', syncedAt));
  } catch (err) {
    partiesError.set(err.message);
  }
}
```

- [ ] **Step 8: Write `src/routes/Parties.svelte`**

```svelte
<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { parties, partiesError, loadParties } from '../lib/stores/parties.js';
  import RadarChart from '../lib/components/RadarChart.svelte';
  import Heatmap from '../lib/components/Heatmap.svelte';

  onMount(() => {
    if ($meta?.synced_at) loadParties($meta.synced_at);
  });

  const AXES = ['expansion', 'authority', 'corporate', 'technocratic', 'faith', 'materialist'];
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider mb-4 border-b-4 border-border pb-2">
    Parties
  </h2>

  {#if $partiesError}
    <p class="text-crit">{$partiesError}</p>
  {:else if !$parties}
    <p class="text-muted">Loading…</p>
  {:else if $parties.parties.length === 0}
    <p class="text-muted">No parties founded yet — players form parties during play.</p>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
      {#each $parties.parties as p}
        <div class="border-4 border-border p-3">
          <h3 class="font-mono font-extrabold text-base uppercase tracking-wider mb-2">{p.name}</h3>
          <div class="grid grid-cols-2 gap-2 text-xs mb-2">
            <div><div class="text-muted uppercase tracking-widest">Establishment</div><div class="font-bold">{(p.establishment * 100).toFixed(0)}%</div></div>
            <div><div class="text-muted uppercase tracking-widest">Closest GoI</div><div class="font-bold">{p.closest_goi}</div></div>
            <div><div class="text-muted uppercase tracking-widest">Vote Share</div><div class="font-bold">{(p.vote_share * 100).toFixed(0)}%</div></div>
            <div><div class="text-muted uppercase tracking-widest">Mad Index</div><div class="font-bold">{p.mad_index?.toFixed(2)}</div></div>
          </div>
          <RadarChart axes={AXES.map((a) => ({ label: a, value: p.stance[a] }))} size={140} />
        </div>
      {/each}
    </div>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">GoI–Party Compatibility</h3>
    <div class="mb-6">
      <Heatmap
        rowLabels={$parties.goi_compat_matrix.parties}
        colLabels={$parties.goi_compat_matrix.gois}
        values={$parties.goi_compat_matrix.values}
      />
    </div>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Class–Party Compatibility</h3>
    <Heatmap
      rowLabels={$parties.class_compat_matrix.parties}
      colLabels={$parties.class_compat_matrix.classes}
      values={$parties.class_compat_matrix.values}
    />
  {/if}
</section>
```

- [ ] **Step 9: Wire route + re-sync + verify**

```javascript
import Parties from './routes/Parties.svelte';
'/parties': Parties,
```

```bash
uv run python scripts/sync_sheet.py --xlsx /tmp/test_wb.xlsx --out-dir public/data
npm run dev
```

`/#/parties` shows 2 founded party cards with radars + the two compat heatmaps.

- [ ] **Step 10: Commit**

```bash
git add tests/fixtures/build_test_workbook.py scripts/extractors/parties.py tests/extractors/test_parties.py scripts/sync_sheet.py scripts/validate_schema.py src/lib/stores/parties.js src/routes/Parties.svelte src/App.svelte
git commit -m "feat: parties page with cards, stance radars, two compat heatmaps"
```

---

### Task 22: Map extractor

The map extractor reads 11 sheets per coordinate and zips the layers into one record per `(x, y)`.

**Files:**
- Modify: `tests/fixtures/build_test_workbook.py` (add 11 map sheets, sparse population)
- Create: `scripts/extractors/map.py`
- Create: `tests/extractors/test_map.py`
- Modify: `scripts/sync_sheet.py`, `scripts/validate_schema.py`

- [ ] **Step 1: Extend the fixture**

Append to `build()`:

```python
    # 11 map sheets, 40×40 each. Mostly empty terrain; a few seeded tiles.
    map_sheets = ["Terrain", "Features", "Resources", "Slots", "Improvements",
                  "Yield - Food", "Yield - Materials", "Yield - Ore",
                  "Yield - Energy", "Yield - Housing", "Yield - Water"]
    for sheet_name in map_sheets:
        ms = wb.create_sheet(sheet_name)
        for r in range(1, 41):
            for c in range(1, 41):
                if sheet_name == "Terrain":
                    ms.cell(row=r, column=c, value="Crater Floor" if (r + c) % 2 == 0 else "Mare Plain")
                elif sheet_name == "Slots":
                    ms.cell(row=r, column=c, value=2)
                elif sheet_name == "Features" and (r, c) == (5, 5):
                    ms.cell(row=r, column=c, value="Lava Tube")
                elif sheet_name == "Resources" and (r, c) == (10, 10):
                    ms.cell(row=r, column=c, value="He-3")
                elif sheet_name == "Improvements" and (r, c) == (10, 10):
                    ms.cell(row=r, column=c, value="HE3-1")
                elif sheet_name == "Yield - Energy" and (r, c) == (10, 10):
                    ms.cell(row=r, column=c, value=-1)
                else:
                    ms.cell(row=r, column=c, value=0 if sheet_name.startswith("Yield") else "")

    # Improvements manifest cols AO:AR (41-44) starting row 5.
    imp = wb["Improvements"]
    imp.cell(row=5, column=41, value="J10")           # Tile
    imp.cell(row=5, column=42, value="Helium-3 Mine")  # Improvement Type
    imp.cell(row=5, column=43, value="Corporate")      # Ownership Type
    imp.cell(row=5, column=44, value="Lunar Extractives")  # Owner

    # Lookup helper for terrain → palette colour.
    pal = wb.create_sheet("MapPalette")
    palette = [
        ("Crater Floor", "#5a4a3a"),
        ("Mare Plain", "#3c3a3a"),
        ("Crater Rim", "#8a7560"),
        ("Polar Ice Plain", "#c8d8e8"),
        ("Empty", "#1a1a1a"),
    ]
    for i, (name, hex_) in enumerate(palette, start=1):
        pal.cell(row=i, column=1, value=name)
        pal.cell(row=i, column=2, value=hex_)
    _add_name(wb, "TerrainPalette", "MapPalette!$A$1:$B$10")
```

- [ ] **Step 2: Write the failing extractor test**

`tests/extractors/test_map.py`:

```python
"""Tests for the Map page extractor."""
from __future__ import annotations

from extractors.map import extract


def test_extract_dimensions(wb):
    result = extract(wb)
    assert result["width"] == 40
    assert result["height"] == 40
    assert len(result["tiles"]) == 1600


def test_extract_tile_record_shape(wb):
    result = extract(wb)
    # Tile (0, 0) — top-left corner
    t = result["tiles"][0]
    assert t["x"] == 0
    assert t["y"] == 0
    assert t["terrain"] in {"Crater Floor", "Mare Plain"}
    assert t["feature"] is None
    assert t["resource"] is None
    assert t["slots"] == 2
    assert t["improvement"] is None
    assert "yields" in t
    assert set(t["yields"].keys()) == {"food", "materials", "ore", "energy", "housing", "water"}


def test_extract_seeded_he3_tile(wb):
    """Tile at (9, 9) — 0-indexed coords for sheet row 10, col 10."""
    result = extract(wb)
    tile = next(t for t in result["tiles"] if t["x"] == 9 and t["y"] == 9)
    assert tile["resource"] == "He-3"
    assert tile["improvement"] is not None
    assert tile["improvement"]["name"] == "Helium-3 Mine"
    assert tile["improvement"]["owner"] == "Lunar Extractives"
    assert tile["improvement"]["ownership_type"] == "Corporate"
    assert tile["yields"]["energy"] == -1


def test_extract_includes_palette(wb):
    result = extract(wb)
    assert "palettes" in result
    assert "terrain" in result["palettes"]
    assert result["palettes"]["terrain"]["Crater Floor"] == "#5a4a3a"
```

- [ ] **Step 3: Run test (FAILS)**

```bash
uv run pytest tests/extractors/test_map.py -v
```

- [ ] **Step 4: Write `scripts/extractors/map.py`**

```python
"""Extract data for the Map page (40×40 tile grid, 11-layer composition)."""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, read_named_range

WIDTH = 40
HEIGHT = 40

YIELD_SHEETS = {
    "food": "Yield - Food",
    "materials": "Yield - Materials",
    "ore": "Yield - Ore",
    "energy": "Yield - Energy",
    "housing": "Yield - Housing",
    "water": "Yield - Water",
}


def extract(wb) -> dict[str, Any]:
    terrain = _read_grid(wb, "Terrain")
    features = _read_grid(wb, "Features")
    resources = _read_grid(wb, "Resources")
    slots = _read_grid(wb, "Slots")
    improvements = _read_grid(wb, "Improvements")
    yields = {key: _read_grid(wb, sheet) for key, sheet in YIELD_SHEETS.items()}

    manifest = _read_improvement_manifest(wb)

    tiles = []
    for y in range(HEIGHT):
        for x in range(WIDTH):
            terrain_v = _cell_str(terrain, x, y)
            feature_v = _cell_str(features, x, y)
            resource_v = _cell_str(resources, x, y)
            slots_v = _cell_int(slots, x, y)
            imp_id = _cell_str(improvements, x, y)
            tile_yields = {key: coerce_number(grid[y][x]) or 0 for key, grid in yields.items()}
            tiles.append({
                "x": x,
                "y": y,
                "terrain": terrain_v or None,
                "feature": feature_v or None,
                "resource": resource_v or None,
                "slots": slots_v,
                "improvement": _improvement_for(imp_id, x, y, manifest),
                "yields": tile_yields,
            })

    return {
        "width": WIDTH,
        "height": HEIGHT,
        "tiles": tiles,
        "palettes": {"terrain": _palette(wb, "TerrainPalette")},
    }


def _read_grid(wb, sheet_name):
    """Read a 40×40 grid. Uses iter_rows for ~10× speedup over per-cell .cell() calls."""
    ws = wb[sheet_name]
    grid = []
    for row in ws.iter_rows(min_row=1, max_row=HEIGHT, min_col=1, max_col=WIDTH, values_only=True):
        grid.append(list(row))
    return grid


def _cell_str(grid, x, y):
    v = grid[y][x]
    if v is None or v == "":
        return None
    return str(v)


def _cell_int(grid, x, y):
    v = grid[y][x]
    return int(v) if isinstance(v, (int, float)) else None


def _read_improvement_manifest(wb):
    """Manifest in cols AO:AR starting row 5. Returns dict keyed by tile_id."""
    ws = wb["Improvements"]
    out = {}
    r = 5
    while True:
        tile = ws.cell(row=r, column=41).value
        if tile in (None, ""):
            break
        out[str(tile)] = {
            "name": ws.cell(row=r, column=42).value,
            "ownership_type": ws.cell(row=r, column=43).value,
            "owner": ws.cell(row=r, column=44).value,
        }
        r += 1
    return out


def _improvement_for(imp_id, x, y, manifest):
    """Resolve the improvement-grid value (e.g. 'HE3-1') to manifest entry, falling
    back to a coordinate-based lookup ('J10' for x=9 y=9) if no per-id key matches.
    """
    if not imp_id:
        return None
    if imp_id in manifest:
        return manifest[imp_id]
    # Coordinate fallback: spreadsheet-style address (cols A-AN, 1-indexed rows).
    col_letter = _col_letter(x + 1)
    addr = f"{col_letter}{y + 1}"
    if addr in manifest:
        return manifest[addr]
    return {"name": imp_id, "owner": None, "ownership_type": None}


def _col_letter(n):
    s = ""
    while n > 0:
        n, rem = divmod(n - 1, 26)
        s = chr(65 + rem) + s
    return s


def _palette(wb, named_range):
    rows = read_named_range(wb, named_range)
    return {r[0]: r[1] for r in rows if r and r[0]}
```

- [ ] **Step 5: Register extractor + add required range**

```python
# scripts/sync_sheet.py
from extractors import map as ex_map
("map", ex_map.extract),
```

```python
# scripts/validate_schema.py
"TerrainPalette",
```

- [ ] **Step 6: Run extractor tests**

```bash
uv run pytest tests/extractors/test_map.py -v
```

Expected: 4 PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/fixtures/build_test_workbook.py scripts/extractors/map.py tests/extractors/test_map.py scripts/sync_sheet.py scripts/validate_schema.py
git commit -m "feat(sync): map extractor — 11-layer composition, 1600-tile flat array"
```

---

### Task 23: Map page (Canvas + SVG overlay + side panel + heatmap toggle)

**Files:**
- Create: `src/lib/components/MapCanvas.svelte`
- Create: `src/lib/stores/map.js`
- Create: `src/routes/Map.svelte`
- Modify: `src/App.svelte`

- [ ] **Step 1: Write `src/lib/stores/map.js`**

```javascript
import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const map = writable(null);
export const mapError = writable(null);

export async function loadMap(syncedAt) {
  try {
    map.set(await fetchPage('map', syncedAt));
  } catch (err) {
    mapError.set(err.message);
  }
}
```

- [ ] **Step 2: Write `src/lib/components/MapCanvas.svelte`**

This is the central component — Canvas terrain layer + SVG overlay for icons + hover/focus state.

```svelte
<script>
  import { createEventDispatcher, onMount, tick } from 'svelte';

  /** @type {{tiles: any[], width: number, height: number, palettes: any}} */
  export let mapData;
  /** active heatmap layer name, e.g. "terrain" | "food" | "energy" | ... */
  export let layer = 'terrain';

  const TILE_SIZE = 16;
  const dispatch = createEventDispatcher();

  let canvas;
  let focused = { x: 0, y: 0 };

  $: width = mapData.width * TILE_SIZE;
  $: height = mapData.height * TILE_SIZE;
  $: viewBox = `0 0 ${width} ${height}`;
  $: drawTerrain(mapData, layer);

  function tileColor(tile, layer, palettes) {
    if (layer === 'terrain') {
      return palettes.terrain[tile.terrain] || '#1a1a1a';
    }
    const v = tile.yields?.[layer] ?? 0;
    // Green for positive, red for negative, neutral for zero.
    if (v > 0) {
      const t = Math.min(1, v / 5);
      return `color-mix(in srgb, #38d39f ${t * 100}%, var(--bg))`;
    } else if (v < 0) {
      const t = Math.min(1, -v / 5);
      return `color-mix(in srgb, var(--crit) ${t * 100}%, var(--bg))`;
    }
    return 'var(--bg)';
  }

  async function drawTerrain(mapData, layer) {
    if (!mapData) return;
    await tick();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    for (const t of mapData.tiles) {
      ctx.fillStyle = tileColor(t, layer, mapData.palettes);
      ctx.fillRect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  function handleMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * mapData.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * mapData.height);
    focused = { x, y };
    dispatch('hover', tileAt(x, y));
  }

  function handleKey(e) {
    let { x, y } = focused;
    if (e.key === 'ArrowLeft') x = Math.max(0, x - 1);
    else if (e.key === 'ArrowRight') x = Math.min(mapData.width - 1, x + 1);
    else if (e.key === 'ArrowUp') y = Math.max(0, y - 1);
    else if (e.key === 'ArrowDown') y = Math.min(mapData.height - 1, y + 1);
    else if (e.key === 'Enter' || e.key === ' ') { dispatch('pin', tileAt(x, y)); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    focused = { x, y };
    dispatch('hover', tileAt(x, y));
  }

  function tileAt(x, y) {
    return mapData.tiles[y * mapData.width + x] ?? null;
  }

  function handleClick(e) {
    handleMove(e);
    dispatch('pin', tileAt(focused.x, focused.y));
  }
</script>

<div class="relative inline-block border-4 border-border" style="width: {width}px; height: {height}px;">
  <canvas
    bind:this={canvas}
    {width}
    {height}
    role="application"
    aria-label="Colony map: {mapData.width} by {mapData.height} grid"
    tabindex="0"
    on:mousemove={handleMove}
    on:click={handleClick}
    on:keydown={handleKey}
    class="block w-full h-full cursor-crosshair focus:outline focus:outline-2 focus:outline-accent"
  ></canvas>
  <svg {viewBox} class="absolute inset-0 pointer-events-none w-full h-full">
    <!-- Improvement icons (rendered as small inline glyphs by category). -->
    {#each mapData.tiles as t}
      {#if t.improvement}
        <text
          x={t.x * TILE_SIZE + TILE_SIZE / 2}
          y={t.y * TILE_SIZE + TILE_SIZE / 2}
          font-size={TILE_SIZE * 0.7}
          text-anchor="middle"
          dominant-baseline="central"
          fill="var(--fg)"
          opacity="0.85"
        >▣</text>
      {:else if t.feature}
        <text
          x={t.x * TILE_SIZE + TILE_SIZE / 2}
          y={t.y * TILE_SIZE + TILE_SIZE / 2}
          font-size={TILE_SIZE * 0.6}
          text-anchor="middle"
          dominant-baseline="central"
          fill="var(--accent)"
          opacity="0.85"
        >◆</text>
      {/if}
    {/each}
    <!-- Focus highlight -->
    <rect
      x={focused.x * TILE_SIZE}
      y={focused.y * TILE_SIZE}
      width={TILE_SIZE}
      height={TILE_SIZE}
      fill="none"
      stroke="var(--accent)"
      stroke-width="2"
    />
  </svg>
</div>
```

- [ ] **Step 3: Write `src/routes/Map.svelte`**

```svelte
<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { map, mapError, loadMap } from '../lib/stores/map.js';
  import MapCanvas from '../lib/components/MapCanvas.svelte';

  let layer = 'terrain';
  let hoverTile = null;
  let pinnedTile = null;

  onMount(() => {
    if ($meta?.synced_at) loadMap($meta.synced_at);
  });

  const LAYERS = [
    { value: 'terrain', label: 'Terrain' },
    { value: 'food', label: 'Food yield' },
    { value: 'materials', label: 'Materials yield' },
    { value: 'ore', label: 'Ore yield' },
    { value: 'energy', label: 'Energy yield' },
    { value: 'housing', label: 'Housing yield' },
    { value: 'water', label: 'Water yield' },
  ];
</script>

<section class="p-6">
  <div class="flex justify-between items-baseline mb-4 border-b-4 border-border pb-2">
    <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider">Map</h2>
    <label class="font-mono text-xs uppercase tracking-widest">
      Layer:
      <select bind:value={layer} class="bg-bg text-fg border-2 border-border ml-2 px-2 py-1">
        {#each LAYERS as l}
          <option value={l.value}>{l.label}</option>
        {/each}
      </select>
    </label>
  </div>

  {#if $mapError}
    <p class="text-crit">{$mapError}</p>
  {:else if !$map}
    <p class="text-muted">Loading map…</p>
  {:else}
    <div class="flex gap-4 items-start">
      <MapCanvas
        mapData={$map}
        {layer}
        on:hover={(e) => (hoverTile = e.detail)}
        on:pin={(e) => (pinnedTile = e.detail)}
      />
      <aside class="border-4 border-border p-4 min-w-[220px] font-mono text-sm">
        {@const t = pinnedTile ?? hoverTile}
        {#if !t}
          <p class="text-muted">Hover or arrow-key over a tile to inspect.</p>
        {:else}
          <h3 class="text-xs uppercase tracking-widest text-muted mb-2">
            Tile ({t.x}, {t.y})
          </h3>
          <dl class="space-y-1">
            <div class="flex justify-between"><dt>Terrain</dt><dd>{t.terrain ?? '—'}</dd></div>
            <div class="flex justify-between"><dt>Feature</dt><dd>{t.feature ?? '—'}</dd></div>
            <div class="flex justify-between"><dt>Resource</dt><dd>{t.resource ?? '—'}</dd></div>
            <div class="flex justify-between"><dt>Slots</dt><dd>{t.slots ?? '—'}</dd></div>
          </dl>
          {#if t.improvement}
            <h4 class="mt-3 text-xs uppercase tracking-widest text-muted">Improvement</h4>
            <dl class="space-y-1">
              <div class="flex justify-between"><dt>Name</dt><dd>{t.improvement.name}</dd></div>
              <div class="flex justify-between"><dt>Owner</dt><dd>{t.improvement.owner ?? '—'}</dd></div>
              <div class="flex justify-between"><dt>Type</dt><dd>{t.improvement.ownership_type ?? '—'}</dd></div>
            </dl>
          {/if}
          <h4 class="mt-3 text-xs uppercase tracking-widest text-muted">Yields</h4>
          <dl class="space-y-1">
            {#each Object.entries(t.yields) as [k, v]}
              <div class="flex justify-between"><dt class="capitalize">{k}</dt><dd class:text-crit={v < 0}>{v}</dd></div>
            {/each}
          </dl>
        {/if}
      </aside>
    </div>
  {/if}
</section>
```

- [ ] **Step 4: Wire route + re-sync + verify**

```javascript
import Map from './routes/Map.svelte';
'/map': Map,
```

```bash
uv run python scripts/sync_sheet.py --xlsx /tmp/test_wb.xlsx --out-dir public/data
npm run dev
```

`/#/map` shows 40×40 grid; hover updates side panel; arrow keys move focus; layer dropdown recolours map.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/MapCanvas.svelte src/lib/stores/map.js src/routes/Map.svelte src/App.svelte
git commit -m "feat(ui): interactive map with canvas terrain, svg overlay, side panel, heatmap toggle"
```

---

### Task 24: Senate page (sheet-flag gated, Coalitions + GoI capture %)

**Files:**
- Modify: `tests/fixtures/build_test_workbook.py` (add Coalitions sheet)
- Create: `scripts/extractors/senate.py`
- Create: `tests/extractors/test_senate.py`
- Create: `src/lib/stores/senate.js`
- Create: `src/routes/Senate.svelte`
- Modify: `scripts/sync_sheet.py`, `scripts/validate_schema.py`, `src/App.svelte`

- [ ] **Step 1: Extend the fixture**

Append to `build()`:

```python
    # Coalitions sheet: 5 slots, rows 4-8.
    # Cols: A name, B-P (15) party-membership flags, then derived aggregates.
    co = wb.create_sheet("Coalitions")
    co["A1"] = "Coalitions"
    coalitions = [
        ("Big Tent", [True, True] + [False] * 13, 2, 0.95, 0.50, "Reformist"),
        ("Workers' Bloc", [False, True] + [False] * 13, 1, 0.40, 0.22, "Activist"),
    ]
    for slot, (name, flags, members, est, vote, approach) in enumerate(coalitions):
        row = 4 + slot
        co.cell(row=row, column=1, value=name)
        for j, flag in enumerate(flags):
            co.cell(row=row, column=2 + j, value=flag)
        # Derived cols: Q=member count, R=total establishment, S=total vote share,
        # T-Y=worldview centroid, Z=mad index, AA=approach
        co.cell(row=row, column=17, value=members)
        co.cell(row=row, column=18, value=est)
        co.cell(row=row, column=19, value=vote)
        for axis in range(6):
            co.cell(row=row, column=20 + axis, value=4.0 + slot * 0.5)
        co.cell(row=row, column=26, value=0.10)
        co.cell(row=row, column=27, value=approach)
    _add_name(wb, "CoalitionsBlock", "Coalitions!$A$4:$AA$8")
```

- [ ] **Step 2: Write the failing extractor test**

`tests/extractors/test_senate.py`:

```python
"""Tests for the Senate page extractor."""
from __future__ import annotations

import openpyxl
import pytest

from extractors.senate import extract


@pytest.fixture
def wb_senate_on(fixture_workbook_path):
    wb = openpyxl.load_workbook(fixture_workbook_path, data_only=True)
    wb["Variable"]["B1"].value = True
    return wb


def test_extract_returns_coalitions(wb_senate_on):
    result = extract(wb_senate_on)
    assert len(result["coalitions"]) == 2
    assert result["coalitions"][0]["name"] == "Big Tent"


def test_extract_coalition_member_parties_resolved(wb_senate_on):
    result = extract(wb_senate_on)
    big_tent = result["coalitions"][0]
    # Both slot-0 (Liberty Now) and slot-1 (People's Voice) flags TRUE.
    assert "Liberty Now" in big_tent["member_parties"]
    assert "People's Voice" in big_tent["member_parties"]


def test_extract_filters_empty_coalition_slots(wb_senate_on):
    """Slots 3-5 of Coalitions are blank; should be filtered."""
    result = extract(wb_senate_on)
    assert all(c["member_count"] > 0 for c in result["coalitions"])


def test_extract_goi_capture_matrix_present(wb_senate_on):
    result = extract(wb_senate_on)
    matrix = result["goi_capture_matrix"]
    assert len(matrix["parties"]) == 2
    assert len(matrix["gois"]) == 4
    # Sum of capture across parties per GoI should equal 1.0 (normalised).
    for j in range(4):
        col_sum = sum(matrix["values"][i][j] for i in range(len(matrix["parties"])))
        assert abs(col_sum - 1.0) < 1e-6


def test_extract_seats_are_placeholder_nulls(wb_senate_on):
    result = extract(wb_senate_on)
    seats = result["seats_by_party"]
    assert all(s["seats"] is None for s in seats)


def test_extract_returns_empty_capture_when_no_vote_share(wb_senate_on):
    """Empty-state guard: zero out vote share, expect empty matrix not div-by-zero."""
    wb_senate_on["Parties"]["AP4"].value = 0
    wb_senate_on["Parties"]["AP5"].value = 0
    result = extract(wb_senate_on)
    assert result["goi_capture_matrix"]["values"] == []
```

- [ ] **Step 3: Write `scripts/extractors/senate.py`**

```python
"""Extract data for the Senate page (sheet-flag gated)."""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number, read_named_range


def extract(wb) -> dict[str, Any]:
    coalitions = _coalitions(wb)
    capture = _goi_capture(wb)
    seats = [{"party": p, "seats": None} for p in capture["parties"]]
    return {
        "coalitions": coalitions,
        "goi_capture_matrix": capture,
        "seats_by_party": seats,
        "placeholder_note": "Seat data coming once Council Members sheet adds Seat # and Party fields.",
    }


def _coalitions(wb) -> list[dict[str, Any]]:
    block = read_named_range(wb, "CoalitionsBlock")
    parties_block = read_named_range(wb, "PartiesBlock")
    party_names = [r[0] for r in parties_block if r and r[0] and r[1] is True]

    out = []
    for r in block:
        if not r or not r[0]:
            continue
        member_count = coerce_number(r[16])
        if not member_count:
            continue
        flags = r[1:16]  # 15 boolean flags into Parties slots 0..14
        members = []
        for slot_idx, flag in enumerate(flags):
            if flag is True and slot_idx < len(party_names):
                members.append(party_names[slot_idx])
        out.append({
            "name": r[0],
            "member_parties": members,
            "member_count": int(member_count),
            "total_establishment": coerce_number(r[17]),
            "total_vote_share": coerce_number(r[18]),
            "worldview_centroid": {
                axis: coerce_number(r[19 + i]) for i, axis in enumerate(
                    ["expansion", "authority", "corporate", "technocratic", "faith", "materialist"]
                )
            },
            "mad_index": coerce_number(r[25]),
            "approach": r[26],
        })
    return out


def _goi_capture(wb) -> dict[str, Any]:
    parties_block = read_named_range(wb, "PartiesBlock")
    goi_names = [r[0] for r in read_named_range(wb, "GoINames") if r and r[0]]

    parties = []
    raw = []  # list of (name, vote_share, [compat per goi])
    for r in parties_block:
        if not r or not r[0] or r[1] is not True:
            continue
        name = r[0]
        vote = coerce_number(r[41]) or 0.0
        compat = [coerce_number(r[17 + j]) or 0.0 for j in range(len(goi_names))]
        parties.append(name)
        raw.append((name, vote, compat))

    if not raw or all(v == 0 for _, v, _ in raw):
        return {"parties": parties, "gois": goi_names, "values": []}

    # Per-party per-GoI raw weight = compat × vote_share. Normalise per GoI.
    raw_matrix = [[c[j] * v for j in range(len(goi_names))] for _, v, c in raw]
    col_sums = [sum(row[j] for row in raw_matrix) for j in range(len(goi_names))]
    normalised = [
        [
            (raw_matrix[i][j] / col_sums[j]) if col_sums[j] > 0 else 0.0
            for j in range(len(goi_names))
        ]
        for i in range(len(raw))
    ]
    return {"parties": parties, "gois": goi_names, "values": normalised}
```

- [ ] **Step 4: Register extractor (with conditional gating)**

In `scripts/sync_sheet.py`, the senate extractor should only run when the flag is on. Update `run_sync()`:

```python
from extractors import senate as ex_senate

# Inside run_sync, after extractors loop:
if senate_enabled:
    try:
        data = ex_senate.extract(wb)
        write_json_atomic(out_dir / "senate.json", data)
    except Exception as exc:
        logger.error("Senate extractor failed: %s", exc)
        partial_failures.append("senate")
else:
    # Make sure stale senate.json from a prior ON state is removed.
    senate_path = out_dir / "senate.json"
    if senate_path.exists():
        senate_path.unlink()
```

- [ ] **Step 5: Run tests**

```bash
uv run pytest tests/extractors/test_senate.py -v
```

Expected: 6 PASS.

- [ ] **Step 6: Add a sync-level test for the deletion behaviour**

Append to `tests/test_sync_sheet.py`:

```python
def test_run_sync_deletes_stale_senate_json_when_flag_off(tmp_path, fixture_workbook_path):
    out_dir = tmp_path / "data"
    out_dir.mkdir()
    # Simulate prior ON state by writing a stub senate.json.
    (out_dir / "senate.json").write_text('{"old": "data"}')
    run_sync(fixture_workbook_path, out_dir)
    assert not (out_dir / "senate.json").exists()
```

```bash
uv run pytest tests/test_sync_sheet.py -v
```

Expected: 8 PASS now.

- [ ] **Step 7: Write `src/lib/stores/senate.js`**

```javascript
import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const senate = writable(null);
export const senateError = writable(null);

export async function loadSenate(syncedAt) {
  try {
    senate.set(await fetchPage('senate', syncedAt));
  } catch (err) {
    senateError.set(err.message);
  }
}
```

- [ ] **Step 8: Write `src/routes/Senate.svelte`**

```svelte
<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { senate, senateError, loadSenate } from '../lib/stores/senate.js';
  import Heatmap from '../lib/components/Heatmap.svelte';

  onMount(() => {
    if ($meta?.synced_at) loadSenate($meta.synced_at);
  });
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider mb-4 border-b-4 border-border pb-2">
    Senate
  </h2>

  {#if $senateError}
    <p class="text-crit">{$senateError}</p>
  {:else if !$senate}
    <p class="text-muted">Loading…</p>
  {:else}
    <div class="border-2 border-accent bg-bg p-3 mb-6 text-sm">
      <strong class="uppercase tracking-widest text-xs text-muted">Note</strong>
      <p>{$senate.placeholder_note}</p>
    </div>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Coalitions</h3>
    <table class="w-full border-collapse mb-6 font-mono text-xs">
      <thead>
        <tr class="border-b-2 border-border">
          <th class="text-left p-2 uppercase tracking-widest">Coalition</th>
          <th class="text-left p-2 uppercase tracking-widest">Members</th>
          <th class="text-right p-2 uppercase tracking-widest">Count</th>
          <th class="text-right p-2 uppercase tracking-widest">Establishment</th>
          <th class="text-right p-2 uppercase tracking-widest">Vote Share</th>
          <th class="text-left p-2 uppercase tracking-widest">Approach</th>
        </tr>
      </thead>
      <tbody>
        {#each $senate.coalitions as c}
          <tr class="border-b border-border/30">
            <td class="p-2 font-bold">{c.name}</td>
            <td class="p-2">{c.member_parties.join(', ')}</td>
            <td class="p-2 text-right">{c.member_count}</td>
            <td class="p-2 text-right">{(c.total_establishment * 100).toFixed(0)}%</td>
            <td class="p-2 text-right">{(c.total_vote_share * 100).toFixed(0)}%</td>
            <td class="p-2">{c.approach}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">GoI Capture % by Party</h3>
    {#if $senate.goi_capture_matrix.values.length === 0}
      <p class="text-muted text-sm">No party-level capture data — no parties have measured vote share yet.</p>
    {:else}
      <Heatmap
        rowLabels={$senate.goi_capture_matrix.parties}
        colLabels={$senate.goi_capture_matrix.gois}
        values={$senate.goi_capture_matrix.values}
      />
    {/if}
  {/if}
</section>
```

- [ ] **Step 9: Wire route + verify with flag ON**

```javascript
import Senate from './routes/Senate.svelte';
'/senate': Senate,
```

```bash
# Flip the flag in the fixture by editing it manually or rebuilding with the flag on.
uv run python -c "
import openpyxl
wb = openpyxl.load_workbook('/tmp/test_wb.xlsx')
wb['Variable']['B1'].value = True
wb.save('/tmp/test_wb.xlsx')
"
uv run python scripts/sync_sheet.py --xlsx /tmp/test_wb.xlsx --out-dir public/data
npm run dev
```

`/#/senate` shows the placeholder banner, Coalitions table, GoI capture heatmap. Senate IS in the nav (flag is now TRUE).

Restore the flag for the OFF path:
```bash
uv run python -c "
import openpyxl
wb = openpyxl.load_workbook('/tmp/test_wb.xlsx')
wb['Variable']['B1'].value = False
wb.save('/tmp/test_wb.xlsx')
"
uv run python scripts/sync_sheet.py --xlsx /tmp/test_wb.xlsx --out-dir public/data
```

Reload — senate.json deleted, Senate disappears from nav.

- [ ] **Step 10: Commit**

```bash
git add tests/fixtures/build_test_workbook.py scripts/extractors/senate.py tests/extractors/test_senate.py scripts/sync_sheet.py scripts/validate_schema.py tests/test_sync_sheet.py src/lib/stores/senate.js src/routes/Senate.svelte src/App.svelte
git commit -m "feat: senate page (gated) — coalitions + goi capture %, deletes JSON when flag off"
```

---

### Task 25: Situations page (Wave-2-ready, empty-state-friendly)

**Files:**
- Create: `src/lib/components/SituationCard.svelte`
- Create: `src/lib/components/TierLadder.svelte`
- Create: `scripts/extractors/situations.py`
- Create: `tests/extractors/test_situations.py`
- Create: `src/lib/stores/situations.js`
- Create: `src/routes/Situations.svelte`
- Modify: `scripts/sync_sheet.py`, `src/App.svelte`

The extractor must tolerate the backend-prerequisite sheets being absent (Wave 1) and degrade to an empty-state JSON.

- [ ] **Step 1: Write `scripts/extractors/situations.py`**

```python
"""Extract data for the Situations page.

Wave 1: Situations / Stability Modifiers / Tier Ladder sheets may not exist yet —
the extractor returns empty arrays instead of crashing, so the frontend can render
an empty-state.
"""
from __future__ import annotations

from typing import Any

from extractors._common import coerce_number


def extract(wb) -> dict[str, Any]:
    return {
        "active": _active(wb),
        "ended": _ended(wb),
        "stability_modifiers": _stab_mods(wb),
        "tier_ladder": _tier_ladder(wb),
    }


def _situations_rows(wb):
    if "Situations" not in wb.sheetnames:
        return []
    ws = wb["Situations"]
    out = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[0] in (None, ""):
            continue
        name, desc, crisis = (list(row) + [None, None, None])[:3]
        out.append({"name": name, "description": desc, "crisis_factor_raw": crisis})
    return out


def _active(wb):
    return [
        {"name": r["name"], "description": r["description"],
         "crisis_factor": coerce_number(r["crisis_factor_raw"])}
        for r in _situations_rows(wb)
        if r["crisis_factor_raw"] != "Ended"
    ]


def _ended(wb):
    return [
        {"name": r["name"], "description": r["description"], "crisis_factor": None}
        for r in _situations_rows(wb)
        if r["crisis_factor_raw"] == "Ended"
    ]


def _stab_mods(wb):
    if "Stability Modifiers" not in wb.sheetnames:
        return []
    ws = wb["Stability Modifiers"]
    out = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[0] in (None, ""):
            continue
        out.append({"name": row[0], "description": row[1] if len(row) > 1 else None,
                    "factor": coerce_number(row[2]) if len(row) > 2 else None})
    return out


def _tier_ladder(wb):
    if "Tier Ladder" not in wb.sheetnames:
        return []
    ws = wb["Tier Ladder"]
    out = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[0] in (None, ""):
            continue
        tier, active, consequence = (list(row) + [None, None, None])[:3]
        out.append({"tier": tier, "active": bool(active), "consequence": consequence})
    return out
```

- [ ] **Step 2: Write the failing extractor test**

`tests/extractors/test_situations.py`:

```python
"""Tests for the Situations page extractor."""
from __future__ import annotations

import openpyxl
import pytest

from extractors.situations import extract


def test_extract_returns_empty_when_sheets_missing(wb):
    result = extract(wb)
    assert result == {
        "active": [],
        "ended": [],
        "stability_modifiers": [],
        "tier_ladder": [],
    }


def test_extract_reads_situations_sheet_when_present(wb):
    ws = wb.create_sheet("Situations")
    ws["A1"], ws["B1"], ws["C1"] = "Name", "Description", "Crisis Factor"
    ws["A2"], ws["B2"], ws["C2"] = "The Fall", "Earth has fallen", 0.05
    ws["A3"], ws["B3"], ws["C3"] = "Old Crisis", "Resolved already", "Ended"
    result = extract(wb)
    assert len(result["active"]) == 1
    assert result["active"][0]["name"] == "The Fall"
    assert result["active"][0]["crisis_factor"] == 0.05
    assert len(result["ended"]) == 1
    assert result["ended"][0]["name"] == "Old Crisis"


def test_extract_reads_stability_modifiers(wb):
    ws = wb.create_sheet("Stability Modifiers")
    ws["A1"], ws["B1"], ws["C1"] = "Name", "Description", "Factor"
    ws["A2"], ws["B2"], ws["C2"] = "Cohesive Founders", "Strong norms", 0.05
    ws["A3"], ws["B3"], ws["C3"] = "Worker Unrest", "Striking", -0.10
    result = extract(wb)
    assert len(result["stability_modifiers"]) == 2
    assert result["stability_modifiers"][1]["factor"] == -0.10


def test_extract_reads_tier_ladder(wb):
    ws = wb.create_sheet("Tier Ladder")
    ws["A1"], ws["B1"], ws["C1"] = "Tier", "Active", "Consequence"
    rows = [("I", False, "Civil unrest"), ("II", True, "Riots"), ("III", False, "Strikes")]
    for i, (t, a, c) in enumerate(rows, start=2):
        ws.cell(row=i, column=1, value=t)
        ws.cell(row=i, column=2, value=a)
        ws.cell(row=i, column=3, value=c)
    result = extract(wb)
    assert len(result["tier_ladder"]) == 3
    assert result["tier_ladder"][1]["active"] is True
    assert result["tier_ladder"][1]["tier"] == "II"
```

- [ ] **Step 3: Run tests**

```bash
uv run pytest tests/extractors/test_situations.py -v
```

Expected: 4 PASS.

- [ ] **Step 4: Register extractor (no required ranges to add — sheets are optional)**

```python
# scripts/sync_sheet.py
from extractors import situations as ex_situations
("situations", ex_situations.extract),
```

- [ ] **Step 5: Write `src/lib/components/SituationCard.svelte`**

```svelte
<script>
  export let name;
  export let description;
  export let crisis_factor = null;
  export let ended = false;
</script>

<div class="border-4 border-border p-3" class:opacity-50={ended}>
  <div class="flex justify-between items-baseline mb-1">
    <h4 class="font-mono font-extrabold text-sm uppercase tracking-wider">{name}</h4>
    {#if !ended && crisis_factor != null}
      <span class="text-xs font-bold text-crit uppercase tracking-widest">+{crisis_factor.toFixed(2)} CRISIS</span>
    {:else if ended}
      <span class="text-xs uppercase tracking-widest text-muted">ENDED</span>
    {/if}
  </div>
  <p class="text-sm">{description ?? ''}</p>
</div>
```

- [ ] **Step 6: Write `src/lib/components/TierLadder.svelte`**

```svelte
<script>
  /** @type {{tier: string, active: boolean, consequence: string}[]} */
  export let tiers = [];
</script>

<ol class="font-mono text-sm space-y-1">
  {#each tiers as t}
    <li
      class="border-2 border-border p-2 flex justify-between"
      class:bg-crit={t.active}
      class:text-bg={t.active}
    >
      <span class="font-extrabold uppercase tracking-widest">Tier {t.tier}</span>
      <span class="flex-1 mx-3 text-muted" class:text-bg={t.active}>{t.consequence}</span>
      {#if t.active}<span class="font-extrabold uppercase tracking-widest">ACTIVE</span>{/if}
    </li>
  {/each}
</ol>
```

- [ ] **Step 7: Write `src/lib/stores/situations.js`**

```javascript
import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const situations = writable(null);
export const situationsError = writable(null);

export async function loadSituations(syncedAt) {
  try {
    situations.set(await fetchPage('situations', syncedAt));
  } catch (err) {
    situationsError.set(err.message);
  }
}
```

- [ ] **Step 8: Write `src/routes/Situations.svelte`**

```svelte
<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { situations, situationsError, loadSituations } from '../lib/stores/situations.js';
  import SituationCard from '../lib/components/SituationCard.svelte';
  import TierLadder from '../lib/components/TierLadder.svelte';

  let showEnded = false;

  onMount(() => {
    if ($meta?.synced_at) loadSituations($meta.synced_at);
  });

  $: empty = $situations &&
    $situations.active.length === 0 &&
    $situations.ended.length === 0 &&
    $situations.stability_modifiers.length === 0 &&
    $situations.tier_ladder.length === 0;
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider mb-4 border-b-4 border-border pb-2">
    Situations
  </h2>

  {#if $situationsError}
    <p class="text-crit">{$situationsError}</p>
  {:else if !$situations}
    <p class="text-muted">Loading…</p>
  {:else if empty}
    <p class="text-muted">
      Backend sheets pending — once the GM adds the <code>Situations</code>,
      <code>Stability Modifiers</code>, and <code>Tier Ladder</code> sheets, this page will populate.
    </p>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div>
        <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Active Situations</h3>
        <div class="space-y-2">
          {#each $situations.active as s}
            <SituationCard name={s.name} description={s.description} crisis_factor={s.crisis_factor} />
          {/each}
          {#if $situations.active.length === 0}
            <p class="text-muted text-sm">No active situations.</p>
          {/if}
        </div>
        {#if $situations.ended.length > 0}
          <button
            class="mt-3 text-xs uppercase tracking-widest border-2 border-border px-2 py-1"
            on:click={() => (showEnded = !showEnded)}
          >
            {showEnded ? 'Hide' : 'Show'} Ended ({$situations.ended.length})
          </button>
          {#if showEnded}
            <div class="space-y-2 mt-3">
              {#each $situations.ended as s}
                <SituationCard name={s.name} description={s.description} ended={true} />
              {/each}
            </div>
          {/if}
        {/if}
      </div>

      <div>
        <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">National Stability Modifiers</h3>
        <ul class="space-y-1 text-sm">
          {#each $situations.stability_modifiers as m}
            <li class="flex justify-between border-b border-border/30 pb-1">
              <span><strong>{m.name}</strong> — {m.description}</span>
              <span class="font-bold ml-2" class:text-crit={m.factor < 0}>{m.factor > 0 ? '+' : ''}{m.factor?.toFixed(2)}</span>
            </li>
          {/each}
          {#if $situations.stability_modifiers.length === 0}
            <li class="text-muted">No long-term modifiers.</li>
          {/if}
        </ul>
      </div>
    </div>

    {#if $situations.tier_ladder.length > 0}
      <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Crisis Tier Ladder</h3>
      <TierLadder tiers={$situations.tier_ladder} />
    {/if}
  {/if}
</section>
```

- [ ] **Step 9: Wire route + verify**

```javascript
import Situations from './routes/Situations.svelte';
'/situations': Situations,
```

```bash
uv run python scripts/sync_sheet.py --xlsx /tmp/test_wb.xlsx --out-dir public/data
npm run dev
```

`/#/situations` renders the empty-state (fixture has no Situations / Stability Modifiers / Tier Ladder sheets in default mode).

- [ ] **Step 10: Commit**

```bash
git add scripts/extractors/situations.py tests/extractors/test_situations.py scripts/sync_sheet.py src/lib/components/SituationCard.svelte src/lib/components/TierLadder.svelte src/lib/stores/situations.js src/routes/Situations.svelte src/App.svelte
git commit -m "feat: situations page (active/ended toggle, stab mods, tier ladder, wave-2-ready)"
```

---

### Task 26: Phase 2 deploy + sub-faction range pin

Per the spec's reviewer nit: lock the sub-faction detail range against the live workbook.

- [ ] **Step 1: Open the live Google Sheet, navigate to the Politics tab.**

- [ ] **Step 2: Locate the sub-faction names column.** This is whatever column has the human-readable sub-faction names ("Constitutional Loyalists" etc.).

- [ ] **Step 3: Record the actual range** in `scripts/extractors/gois.py`'s docstring at the top of `_sub_factions_for()`. If the named range `SubFactionsBlock` exists in the live workbook, prefer it; otherwise hardcode the discovered range with a comment pointing to the issue tracker.

- [ ] **Step 4: If the range differs from the fixture's `Politics!$U$24:$Y$36`, file a small issue:** "Backend sub-faction block range moved — update fixture builder to match if rebuilding from scratch."

- [ ] **Step 5: Re-deploy + verify all pages render**

```bash
gh workflow run sync.yml
# Wait for run to complete; deploy will trigger automatically.
```

Visit the deployed dashboard, click each page in turn:

- Status: live data
- Map: 40×40 grid renders, hover updates side panel
- Population: real classes
- Pops: real classes drilldown
- GoIs: 4 panels with real data
- Parties: real parties (or empty state)
- Senate: visible only if flag is ON
- Situations: empty-state until backend sheets land

- [ ] **Step 6: Commit any extractor adjustments**

```bash
git add scripts/extractors/gois.py
git commit -m "fix(sync): pin sub-faction range against live workbook"
```

---

## Phase 3: Polish

### Task 27: robots.txt + favicon + page titles

**Files:**
- Create: `public/robots.txt`
- Create: `public/favicon.svg`
- Modify: `src/App.svelte` (set per-route document titles)

- [ ] **Step 1: Write `public/robots.txt`**

```
User-agent: *
Disallow: /
```

- [ ] **Step 2: Write `public/favicon.svg`** (small mono glyph)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#0d0a05"/>
  <text x="16" y="22" font-family="monospace" font-size="20" font-weight="900" text-anchor="middle" fill="#ffb000">▣</text>
</svg>
```

- [ ] **Step 3: Reference the favicon in `index.html` `<head>`**

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

- [ ] **Step 4: Add per-route titles via a tiny store**

Create `src/lib/page-title.js`:

```javascript
import { writable } from 'svelte/store';

export const pageTitle = writable('Colony Status');

pageTitle.subscribe((t) => {
  document.title = `${t} · SCORP Colony`;
});
```

- [ ] **Step 5: Each route component sets its title on mount**

In each `src/routes/*.svelte`, add to the `<script>`:

```javascript
import { pageTitle } from '../lib/page-title.js';
import { onMount } from 'svelte';

onMount(() => {
  pageTitle.set('Status');  // Replace per page: 'Map', 'Population', 'Pops', 'GoIs', 'Parties', 'Senate', 'Situations'.
});
```

- [ ] **Step 6: Build + verify**

```bash
npm run build
ls dist/
```

Check `dist/robots.txt` and `dist/favicon.svg` are present. Open `dist/index.html` and confirm the `<link rel="icon">` survived the build.

- [ ] **Step 7: Commit**

```bash
git add public/robots.txt public/favicon.svg index.html src/lib/page-title.js src/routes/Status.svelte src/routes/Map.svelte src/routes/Population.svelte src/routes/Pops.svelte src/routes/GoIs.svelte src/routes/Parties.svelte src/routes/Senate.svelte src/routes/Situations.svelte
git commit -m "chore: robots noindex + favicon + per-route page titles"
```

---

### Task 28: Mobile responsive — nav collapse + grid collapse

**Files:**
- Modify: `src/lib/components/NavBar.svelte`
- Verify: page routes already use `md:` Tailwind breakpoints (they do)

- [ ] **Step 1: Replace `src/lib/components/NavBar.svelte`** with a version that collapses on small viewports

```svelte
<script>
  import { meta } from '../stores/meta.js';
  import ThemeToggle from './ThemeToggle.svelte';
  import SyncChip from './SyncChip.svelte';
  import { link, location } from 'svelte-spa-router';

  const ALL_PAGES = [
    { path: '/', label: 'Status' },
    { path: '/map', label: 'Map' },
    { path: '/population', label: 'Population' },
    { path: '/pops', label: 'Pops' },
    { path: '/gois', label: 'GoIs' },
    { path: '/parties', label: 'Parties' },
    { path: '/senate', label: 'Senate', requiresSenate: true },
    { path: '/situations', label: 'Situations' },
  ];

  let menuOpen = false;
  $: pages = ALL_PAGES.filter((p) => !p.requiresSenate || $meta?.senate_visible);
</script>

<nav class="border-b-4 border-border bg-bg">
  <div class="px-4 md:px-6 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3 md:gap-6">
      <span class="font-mono font-bold uppercase tracking-widest text-accent text-sm md:text-base">
        Colony ▌ T-43
      </span>
      <button
        class="md:hidden border-2 border-border px-2 py-1 text-xs uppercase tracking-widest"
        on:click={() => (menuOpen = !menuOpen)}
        aria-label="Toggle nav"
        aria-expanded={menuOpen}
      >
        {menuOpen ? '✕' : '☰'}
      </button>
      <ul class="hidden md:flex gap-3 font-mono text-xs uppercase tracking-widest">
        {#each pages as p}
          <li>
            <a
              href={p.path}
              use:link
              class="px-2 py-1 border-2 border-transparent hover:border-border"
              class:border-border={$location === p.path}
              class:bg-border={$location === p.path}
              class:text-bg={$location === p.path}
            >
              {p.label}
            </a>
          </li>
        {/each}
      </ul>
    </div>
    <div class="flex items-center gap-2 md:gap-3">
      <SyncChip />
      <ThemeToggle />
    </div>
  </div>
  {#if menuOpen}
    <ul class="md:hidden border-t-2 border-border font-mono text-xs uppercase tracking-widest">
      {#each pages as p}
        <li>
          <a
            href={p.path}
            use:link
            on:click={() => (menuOpen = false)}
            class="block px-4 py-2 border-b border-border/30"
            class:bg-border={$location === p.path}
            class:text-bg={$location === p.path}
          >
            {p.label}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</nav>
```

- [ ] **Step 2: Verify mobile layout**

```bash
npm run dev
```

Open the dev URL in the browser, open DevTools, set viewport to 375×667 (iPhone SE). Verify:
- Hamburger replaces nav links.
- Tapping the hamburger reveals a vertical list.
- Status page tiles collapse to 1-col.
- Pops Detailed panels stack vertically.
- Map shrinks (still 40×40 cells but smaller — acceptable for v1).

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/NavBar.svelte
git commit -m "feat(ui): mobile-responsive navbar with hamburger collapse"
```

---

### Task 29: WCAG AA accessibility verification (Playwright + axe-core)

**Files:**
- Modify: `package.json` (add Playwright + axe deps)
- Create: `playwright.config.js`
- Create: `tests-e2e/a11y.spec.js`
- Modify: `.github/workflows/deploy-pages.yml` (gate deploy on a11y test)

- [ ] **Step 1: Install Playwright + axe**

```bash
npm install -D @playwright/test @axe-core/playwright
npx playwright install chromium
```

- [ ] **Step 2: Add test scripts to `package.json`**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 3: Write `playwright.config.js`**

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-e2e',
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run preview',
    port: 4173,
    timeout: 30000,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 4: Write `tests-e2e/a11y.spec.js`**

```javascript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/#/map', '/#/population', '/#/pops', '/#/gois', '/#/parties', '/#/situations'];
const THEMES = ['light', 'dark'];

for (const theme of THEMES) {
  for (const path of PAGES) {
    test(`a11y: ${theme} theme — ${path}`, async ({ page }) => {
      await page.goto('/');
      await page.evaluate((t) => {
        localStorage.setItem('theme', t);
      }, theme);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
}
```

- [ ] **Step 5: Run a11y tests locally**

```bash
npm run build
npm run test:e2e
```

Expected: all pages × both themes pass with zero violations. If contrast violations appear in dark theme, adjust the dark `--accent` / `--fg` in `src/styles/global.css` to hit AA (use Chrome DevTools Lighthouse or [a11y color contrast calculator](https://webaim.org/resources/contrastchecker/)).

- [ ] **Step 6: Add a CI job that runs a11y tests on PRs**

Append a job to a new workflow `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
        with:
          version: "0.4.18"
      - run: uv python install 3.11
      - run: uv sync --frozen
      - run: uv run pytest -v

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test -- --run

      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm run test:e2e
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json playwright.config.js tests-e2e/a11y.spec.js .github/workflows/ci.yml
git commit -m "test(a11y): add playwright + axe wcag-aa tests + ci job"
```

---

### Task 30: Schema-mismatch deliberate-break test

The spec's acceptance criterion #5 says: "Schema validator catches a deliberately-renamed named range during a test sync."

**Files:**
- Create: `tests/test_schema_break_smoke.py`

- [ ] **Step 1: Write the failing test**

```python
"""Smoke test: deliberately remove a required range and verify the validator catches it."""
from __future__ import annotations

from pathlib import Path

import openpyxl
import pytest

from sync_sheet import run_sync
from validate_schema import SchemaValidationError


def test_deliberately_renaming_required_range_breaks_sync(fixture_workbook_path, tmp_path):
    # Load the fixture, delete a required name, save to a temp copy, re-run sync.
    wb = openpyxl.load_workbook(fixture_workbook_path)
    del wb.defined_names["PopsimSatisfaction"]
    broken = tmp_path / "broken.xlsx"
    wb.save(broken)
    out = tmp_path / "data"
    out.mkdir()
    with pytest.raises(SchemaValidationError, match="PopsimSatisfaction"):
        run_sync(broken, out)
```

- [ ] **Step 2: Run + verify**

```bash
uv run pytest tests/test_schema_break_smoke.py -v
```

Expected: PASS — sync raises `SchemaValidationError` mentioning `PopsimSatisfaction`.

- [ ] **Step 3: Commit**

```bash
git add tests/test_schema_break_smoke.py
git commit -m "test(sync): smoke test for schema-mismatch detection"
```

---

### Task 31: README + CLAUDE.md final pass

**Files:**
- Modify: `README.md`
- Create: `CLAUDE.md`

- [ ] **Step 1: Replace `README.md` with the full version**

```markdown
# SCORP Colony Player Dashboard

Player-facing static dashboard for the SCORP Colony tabletop campaign. Reads from a live Google Sheet (the export-public mirror of the `scorp_colony` GM workbook), syncs hourly via GitHub Action, and serves an 8-page Svelte SPA on GitHub Pages.

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

## Pages (8)

| Page | Route | Notes |
|---|---|---|
| Status | `/` | Treasury, Stab/Crisis, resources, Overton, situations banner |
| Map | `/#/map` | 40×40 interactive, terrain base + icons + heatmap toggle |
| Population | `/#/population` | 11 classes, table + per-class worldview radars |
| Pops Detailed | `/#/pops` | Per-class drilldown — income, wealth, status, satisfaction |
| GoIs | `/#/gois` | 4 panels + sub-factions + PopCapture matrix |
| Parties | `/#/parties` | Founded parties + GoI/Class compat heatmaps |
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
```

- [ ] **Step 2: Write `CLAUDE.md`** (project memory for future Claude sessions)

```markdown
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

## Where to read more

- Spec: `docs/superpowers/specs/2026-05-01-scorp-dashboard-design.md`
- Plan: `docs/superpowers/plans/2026-05-01-scorp-dashboard-implementation.md`
- Backend: `../scorp_colony/CLAUDE.md`
```

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: full readme and project claude.md"
```

---

### Task 32: Final acceptance verification

Walk the spec's Wave 1 acceptance criteria checklist against the deployed dashboard.

- [ ] **Step 1: Trigger a clean sync + deploy from main.**

- [ ] **Step 2: For each Wave 1 criterion (spec §Acceptance criteria), verify in the deployed app:**

  1. ✅ Status / Map / Population / Pops / GoIs / Parties pages all render real data.
  2. ✅ Senate flag round-trip: ON → page appears + senate.json present; OFF → page gone + senate.json absent.
  3. ✅ Situations renders empty-state ("Backend sheets pending").
  4. ✅ Theme toggle persists across hard reload, no flash of wrong theme.
  5. ✅ Schema-break smoke test passes (Task 30).
  6. ✅ Forced-failure produces Telegram message with run URL.
  7. ✅ Playwright + axe a11y CI job is green for both themes.
  8. ✅ Map keyboard nav: arrow keys move focus, Enter pins.
  9. ✅ Coalition flag→name resolution renders correctly (verified by tests + visual check on Senate page).
  10. ✅ Sync chip turns red when manually backdated.
  11. ✅ README documents setup + manual sync + schema bump + privacy caveats.

- [ ] **Step 3: For each missing/failing criterion, file a follow-up task.** Don't mark Phase 3 complete until the gap is resolved or explicitly deferred.

- [ ] **Step 4: Tag the release**

```bash
git tag -a v1.0.0 -m "Wave 1 ship: 7 of 8 pages live; Situations gated on Wave-2 backend sheets"
git push --tags
```

---

## Self-review checklist

Run by the plan author before handing off.

### 1. Spec coverage

| Spec section | Plan task(s) |
|---|---|
| §2 Architecture | Tasks 1, 2, 8, 9 |
| §2.1 Backend prerequisites | Task 15 (Wave 1 step 1: add `Var_SenatePageVisible`); Task 25 (Wave 2 sheets read with degrade) |
| §3.1 Status | Tasks 7, 13, 14 |
| §3.2 Map | Tasks 22, 23 |
| §3.3 Population | Task 18 |
| §3.4 Pops Detailed | Task 19 |
| §3.5 GoIs | Task 20 (with sub-faction range deferral resolved in Task 26) |
| §3.6 Parties | Task 21 |
| §3.7 Senate | Task 24 |
| §3.8 Situations | Task 25 |
| §4.1 Sync ordering (flag → conditional validate → extract → atomic write) | Task 8, refined in Task 24 step 4 |
| §4.2 GitHub Action | Task 9 |
| §4.3 JSON contract + cache-bust + schema_version | Tasks 8, 11, 14 |
| §5.1 Themes | Tasks 2 (CSS variables), 10 (toggle), 14 (no-flash on load) |
| §5.2 Type/layout/components | Tasks 13, 16, 17, 18, 19, 20, 21, 23, 24, 25 (per-component) |
| §5.3 Responsive | Task 28 |
| §5.4 Accessibility (WCAG AA + keyboard) | Tasks 23 (map keyboard), 29 (axe AA in CI) |
| §6 Privacy caveats | Task 31 (README) |
| §7 Operational concerns | Tasks 6, 9, 12, 27, 28 |
| §10 Risks | Mitigations baked into Tasks 5 (schema validate), 8 (retry backoff + atomic write), 11 (cache-bust), 12 (sync chip), 24 (senate boundary) |
| Wave 1 acceptance | Tasks 15 (manual end-to-end), 30 (schema break smoke), 32 (final walk) |
| Wave 2 acceptance | Task 25 (extractor + page tolerate empty backend; populate when sheets land) |

### 2. Placeholder scan

No "TBD"/"TODO"/"implement later" in any task body. The "Backend sheets pending" empty-state on Situations is the spec's intended Wave-2 deferral, not a plan placeholder.

### 3. Type consistency

- `extract(wb)` is the extractor entry point in every module.
- JSON keys are lower_snake_case throughout.
- Store names: `meta`, `status`, `map`, `population`, `pops`, `gois`, `parties`, `senate`, `situations` — consistent with their JSON files and route names.
- `loadX(syncedAt)` is the loader signature for every page store.
- `read_named_range`, `coerce_number`, `filter_blank_rows` — names match across `_common.py`, all extractors, and all tests.

### 4. Spec-to-plan gaps found in self-review

None found. The sub-faction range nit from spec self-review is resolved by Task 26 step 1-3 (lock-against-live-workbook step).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-01-scorp-dashboard-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?






