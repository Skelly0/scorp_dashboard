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
