// Pure per-year "frame" assembly for the Colony Command timeline. No Svelte,
// no DOM — unit-testable in isolation.
//
// A frame is the normalized read of the colony at one year. The timeline is
// built from two sources that the GM pipeline already produces:
//   - history/year-NNN.json snapshots → ARCHIVE years (frozen). These lack
//     births and any situation record (the workbook never stored per-year
//     situations), so those fields come back null/empty.
//   - status.json → the LIVE (latest) year. It is the richest source and is a
//     superset of the snapshot shape, so the live frame's numbers are
//     byte-identical to what the old Status page rendered. This is the parity
//     anchor: build the live year from status, never from its own snapshot.
//
// Money and Housing are kept out of the `resources` display list (their
// magnitude would dominate the shared bar scale); they are exposed separately
// as `money` and `housing` for the Treasury vital and the population drill-down.

import { RESOURCE_ORDER, resourceColor } from './resource-colors.js';
import { projectedGrowthRateFromStatus, populationDeltaFromStatus } from './status-metrics.js';

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeResource(raw) {
  if (!raw) return null;
  const income = num(raw.income);
  const upkeep = num(raw.upkeep);
  const delta = num(raw.delta);
  return {
    name: raw.name,
    color: resourceColor(raw.name),
    current: num(raw.current),
    income,
    upkeep,
    delta,
    net: delta != null ? delta : income != null || upkeep != null ? (income ?? 0) - (upkeep ?? 0) : null,
  };
}

// Returns { byName, display }. `byName` is keyed lowercase for lookup; `display`
// is the ordered bar list (RESOURCE_ORDER first, then any extra live resources),
// always excluding Money and Housing.
function indexResources(rawList) {
  const list = Array.isArray(rawList) ? rawList : [];
  const byName = {};
  for (const raw of list) {
    const key = String(raw?.name ?? '').toLowerCase();
    if (key) byName[key] = normalizeResource(raw);
  }
  const display = [];
  const seen = new Set(['money', 'housing']);
  for (const name of RESOURCE_ORDER) {
    const key = name.toLowerCase();
    if (byName[key] && !display.includes(byName[key])) {
      display.push(byName[key]);
      seen.add(key);
    }
  }
  for (const raw of list) {
    const key = String(raw?.name ?? '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    display.push(normalizeResource(raw));
  }
  return { byName, display };
}

export function frameFromStatus(status) {
  if (!status) return null;
  const demo = status.demographics ?? {};
  const { byName, display } = indexResources(status.resources);
  return {
    year: num(status.year),
    isLive: true,
    population: num(status.population_total),
    stability: num(status.stability),
    crisis_factor: num(status.crisis_factor),
    gov_approval: num(status.gov_approval),
    avg_satisfaction: num(demo.avg_satisfaction ?? status.avg_satisfaction),
    housing_util: num(demo.housing_util ?? status.housing_util),
    net_delta_pct: num(demo.net_delta_pct ?? status.net_delta_pct),
    total_deaths: num(demo.total_deaths),
    total_births: num(demo.total_births),
    // Parity with the old Status page (CLAUDE.md #24): the live Population KPI
    // delta is births − deaths, NOT year-over-year population change.
    population_birth_death_net: populationDeltaFromStatus(status),
    projected_growth_rate: projectedGrowthRateFromStatus(status),
    money: byName.money ?? null,
    housing: byName.housing ?? null,
    resources: display,
    resourcesByName: byName,
    overton: { ...(status.overton ?? {}) },
  };
}

export function frameFromSnapshot(snapshot) {
  if (!snapshot) return null;
  const { byName, display } = indexResources(snapshot.resources);
  return {
    year: num(snapshot.year),
    isLive: false,
    population: num(snapshot.population_total),
    stability: num(snapshot.stability),
    crisis_factor: num(snapshot.crisis_factor),
    gov_approval: num(snapshot.gov_approval),
    avg_satisfaction: num(snapshot.avg_satisfaction),
    housing_util: num(snapshot.housing_util),
    net_delta_pct: num(snapshot.net_delta_pct),
    total_deaths: num(snapshot.total_deaths),
    total_births: null, // archive years never stored births
    population_birth_death_net: null, // → consumers fall back to YoY pop delta
    projected_growth_rate: null,
    money: byName.money ?? null,
    housing: byName.housing ?? null,
    resources: display,
    resourcesByName: byName,
    overton: { ...(snapshot.overton ?? {}) },
  };
}

// Build the ordered (ascending year) frame array. The live year is taken from
// `status` even if a same-year snapshot also exists, so the live frame stays
// the richest/authoritative read. `idx` is assigned after ordering.
export function buildFrames(history, status) {
  const snapshots = Array.isArray(history?.snapshots) ? history.snapshots.filter(Boolean) : [];
  const byYear = new Map();
  for (const snap of snapshots) {
    const year = num(snap?.year);
    if (year != null) byYear.set(year, snap);
  }

  const liveYear = num(status?.year);
  const years = new Set(byYear.keys());
  if (liveYear != null) years.add(liveYear);
  const ordered = [...years].sort((a, b) => a - b);

  const frames = ordered
    .map((year) =>
      liveYear != null && year === liveYear && status
        ? frameFromStatus(status)
        : frameFromSnapshot(byYear.get(year)),
    )
    .filter(Boolean);

  frames.forEach((frame, i) => {
    frame.idx = i;
  });
  return frames;
}
