"""Per-year historical snapshot writer.

Each successful sync writes (or overwrites) `history/year-NNN.json`,
indexed by the colony year read from Var_Year. While the year holds steady,
each sync overwrites the same file with the latest snapshot — once the
year ticks over, the previous file is no longer touched and effectively
becomes a frozen archival record.

`history/index.json` lists every year present so the frontend can fetch
without enumerating the directory. Skipped silently when year is None,
so workbooks that haven't added Var_Year keep syncing.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def write_snapshot(out_dir: Path, year: int | None, status_data: dict[str, Any], synced_at: str) -> bool:
    """Write the per-year snapshot. Returns True if a snapshot was written."""
    if year is None:
        return False

    history_dir = out_dir / "history"
    history_dir.mkdir(parents=True, exist_ok=True)

    snapshot = {
        "year": year,
        "synced_at": synced_at,
        "treasury": status_data.get("treasury"),
        "stability": status_data.get("stability"),
        "crisis_factor": status_data.get("crisis_factor"),
        "population_total": status_data.get("population_total"),
        "resources": status_data.get("resources", []),
        "overton": status_data.get("overton", {}),
    }
    _write_json_atomic(history_dir / f"year-{year:03d}.json", snapshot)
    _update_index(history_dir, year)
    return True


def _update_index(history_dir: Path, year: int) -> None:
    index_path = history_dir / "index.json"
    years: list[int] = []
    if index_path.exists():
        try:
            existing = json.loads(index_path.read_text())
            years = list(existing.get("years", []))
        except (json.JSONDecodeError, OSError):
            years = []
    if year not in years:
        years.append(year)
    years = sorted(set(int(y) for y in years))
    payload = {
        "years": years,
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }
    _write_json_atomic(index_path, payload)


def _write_json_atomic(path: Path, data: dict | list) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True))
    tmp.replace(path)
