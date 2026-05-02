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


def test_run_sync_deletes_stale_senate_json_when_flag_off(tmp_path, fixture_workbook_path):
    out_dir = tmp_path / "data"
    out_dir.mkdir()
    # Simulate prior ON state by writing a stub senate.json.
    (out_dir / "senate.json").write_text('{"old": "data"}')
    run_sync(fixture_workbook_path, out_dir)
    assert not (out_dir / "senate.json").exists()
