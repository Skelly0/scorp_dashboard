"""Tests for the per-year history snapshot writer."""
from __future__ import annotations

import json
from pathlib import Path

from history import write_snapshot


SAMPLE_STATUS: dict = {
    "year": 12,
    "treasury": {"money": 13650.0, "delta": 57087.95},
    "stability": 0.4,
    "crisis_factor": 0.0,
    "population_total": 15000,
    "resources": [
        {"name": "Food", "current": 0.0, "delta": 179.75},
        {"name": "Materials", "current": 3000.0, "delta": -32.25},
    ],
    "overton": {
        "expansion": 5.0,
        "authority": 4.5,
        "corporate": 5.0,
        "technocratic": 4.0,
        "faith": 4.0,
        "materialist": 4.0,
    },
}


def test_write_snapshot_skipped_when_year_missing(tmp_path: Path):
    wrote = write_snapshot(tmp_path, None, SAMPLE_STATUS, "2026-05-03T17:00:00Z")
    assert wrote is False
    assert not (tmp_path / "history").exists()


def test_write_snapshot_creates_year_file(tmp_path: Path):
    wrote = write_snapshot(tmp_path, 12, SAMPLE_STATUS, "2026-05-03T17:00:00Z")
    assert wrote is True
    snap = tmp_path / "history" / "year-012.json"
    assert snap.exists()
    body = json.loads(snap.read_text())
    assert body["year"] == 12
    assert body["synced_at"] == "2026-05-03T17:00:00Z"
    assert body["treasury"] == SAMPLE_STATUS["treasury"]
    assert body["resources"] == SAMPLE_STATUS["resources"]
    assert body["overton"] == SAMPLE_STATUS["overton"]


def test_write_snapshot_pads_year_to_three_digits(tmp_path: Path):
    write_snapshot(tmp_path, 7, SAMPLE_STATUS, "2026-05-03T17:00:00Z")
    assert (tmp_path / "history" / "year-007.json").exists()


def test_write_snapshot_overwrites_same_year(tmp_path: Path):
    write_snapshot(tmp_path, 12, SAMPLE_STATUS, "2026-05-03T17:00:00Z")
    later = dict(SAMPLE_STATUS, treasury={"money": 99999, "delta": 0})
    write_snapshot(tmp_path, 12, later, "2026-05-03T18:00:00Z")
    body = json.loads((tmp_path / "history" / "year-012.json").read_text())
    assert body["treasury"]["money"] == 99999
    assert body["synced_at"] == "2026-05-03T18:00:00Z"


def test_index_records_each_unique_year(tmp_path: Path):
    write_snapshot(tmp_path, 10, SAMPLE_STATUS, "t1")
    write_snapshot(tmp_path, 11, SAMPLE_STATUS, "t2")
    write_snapshot(tmp_path, 12, SAMPLE_STATUS, "t3")
    write_snapshot(tmp_path, 11, SAMPLE_STATUS, "t4")  # duplicate
    index = json.loads((tmp_path / "history" / "index.json").read_text())
    assert index["years"] == [10, 11, 12]
    assert "updated_at" in index


def test_index_recovers_from_corrupt_existing_file(tmp_path: Path):
    history_dir = tmp_path / "history"
    history_dir.mkdir()
    (history_dir / "index.json").write_text("not-valid-json{{{")
    wrote = write_snapshot(tmp_path, 5, SAMPLE_STATUS, "2026-05-03T17:00:00Z")
    assert wrote is True
    index = json.loads((history_dir / "index.json").read_text())
    assert index["years"] == [5]
