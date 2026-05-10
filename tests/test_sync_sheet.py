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
    assert meta["schema_version"] == 10
    assert "synced_at" in meta


def test_run_sync_does_not_write_senate_when_flag_off(tmp_path, fixture_workbook_path):
    out_dir = tmp_path / "data"
    out_dir.mkdir()
    run_sync(fixture_workbook_path, out_dir)
    assert not (out_dir / "senate.json").exists()


def test_run_sync_deletes_stale_senate_json_when_flag_off(tmp_path, fixture_workbook_path):
    out_dir = tmp_path / "data"
    out_dir.mkdir()
    # Simulate prior ON state by writing a stub senate.json.
    (out_dir / "senate.json").write_text('{"old": "data"}')
    run_sync(fixture_workbook_path, out_dir)
    assert not (out_dir / "senate.json").exists()


def test_run_sync_writes_history_snapshot(tmp_path, fixture_workbook_path):
    out_dir = tmp_path / "data"
    out_dir.mkdir()
    run_sync(fixture_workbook_path, out_dir)
    # Fixture sets Var_Year = 12.
    assert (out_dir / "history" / "year-012.json").exists()
    index = json.loads((out_dir / "history" / "index.json").read_text())
    assert index["years"] == [12]
    meta = json.loads((out_dir / "meta.json").read_text())
    assert meta["history_year"] == 12


def test_run_sync_skips_history_when_year_missing(tmp_path, fixture_workbook_path):
    """If the workbook predates Var_Year, sync still succeeds — history dir
    just isn't created. Newer workbooks add the named range; older ones don't."""
    import openpyxl
    wb = openpyxl.load_workbook(fixture_workbook_path, data_only=True)
    del wb.defined_names["Var_Year"]
    stripped_path = tmp_path / "no_year.xlsx"
    wb.save(stripped_path)

    out_dir = tmp_path / "data"
    out_dir.mkdir()
    run_sync(stripped_path, out_dir)
    assert not (out_dir / "history").exists()
    meta = json.loads((out_dir / "meta.json").read_text())
    assert meta["history_year"] is None


def test_run_sync_writes_demographics_json(fixture_workbook_path, tmp_path):
    from sync_sheet import run_sync
    out_dir = tmp_path / "data"
    out_dir.mkdir()
    run_sync(fixture_workbook_path, out_dir)
    assert (out_dir / "demographics.json").exists()
    import json
    payload = json.loads((out_dir / "demographics.json").read_text())
    assert "totals" in payload
    assert "housing" in payload
    assert "food" in payload


def test_run_sync_writes_tech_json(fixture_workbook_path, tmp_path):
    out_dir = tmp_path / "data"
    out_dir.mkdir()
    run_sync(fixture_workbook_path, out_dir)
    assert (out_dir / "tech.json").exists()
    payload = json.loads((out_dir / "tech.json").read_text())
    assert "techs" in payload
    assert "branches" in payload
    assert payload["research_points"] == {"accrued": 375}
    # Fixture seeds 4 named techs across Agriculture (3) + Industry (1).
    assert len(payload["techs"]) == 4
    assert payload["branches"] == ["Agriculture", "Industry"]


def test_run_sync_writes_cropsim_json(fixture_workbook_path, tmp_path):
    out_dir = tmp_path / "data"
    out_dir.mkdir()
    run_sync(fixture_workbook_path, out_dir)
    assert (out_dir / "cropsim.json").exists()
    payload = json.loads((out_dir / "cropsim.json").read_text())
    assert payload["metrics"]["total_supply"] == pytest.approx(188.5275)
    assert len(payload["production"]) == 5
    assert len(payload["demand"]) == 11
