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
