import { describe, it, expect } from 'vitest';
import { buildFrames, frameFromStatus, frameFromSnapshot } from './timeline-frames.js';

const SNAPSHOT_2075 = {
  year: 2075,
  stability: 0.39,
  crisis_factor: 0.73,
  gov_approval: 0.55,
  avg_satisfaction: 0.31,
  housing_util: 1.03,
  net_delta_pct: -0.38,
  total_deaths: 1241,
  population_total: 92000,
  overton: { expansion: 5.0, authority: 3.0 },
  resources: [
    { name: 'Food', current: 1000, income: 993, upkeep: 1173, delta: -180 },
    { name: 'Money', current: 125000, income: 298615, upkeep: 123750, delta: 174865 },
    { name: 'Housing', current: 88890, income: 88890, upkeep: 92000, delta: -3110 },
  ],
};

const STATUS_2076 = {
  year: 2076,
  stability: 0.48,
  crisis_factor: 0.66,
  gov_approval: 0.54,
  population_total: 99163,
  overton: { expansion: 4.0, authority: 5.0 },
  resources: [
    { name: 'Food', current: 805, income: 977, upkeep: 1271, delta: -294 },
    { name: 'Money', current: 263711, income: 198098, upkeep: 132100, delta: 65998 },
    { name: 'Housing', current: 93100, income: 93100, upkeep: 99163, delta: -6063 },
  ],
  demographics: {
    total_births: 2154,
    total_deaths: 1499,
    housing_util: 1.065,
    avg_satisfaction: 0.259,
    net_delta_pct: -0.39,
  },
};

describe('buildFrames', () => {
  it('orders frames ascending and tags live vs archive', () => {
    const frames = buildFrames({ snapshots: [SNAPSHOT_2075] }, STATUS_2076);
    expect(frames.map((f) => f.year)).toEqual([2075, 2076]);
    expect(frames[0].isLive).toBe(false);
    expect(frames[1].isLive).toBe(true);
    expect(frames.map((f) => f.idx)).toEqual([0, 1]);
  });

  it('builds the live year from status (births present, parity delta = births − deaths)', () => {
    const frames = buildFrames({ snapshots: [SNAPSHOT_2075] }, STATUS_2076);
    const live = frames[1];
    expect(live.total_births).toBe(2154);
    expect(live.population_birth_death_net).toBe(655); // 2154 − 1499
    expect(live.projected_growth_rate).toBeCloseTo((655 / 99163) * 100, 5);
  });

  it('leaves births / situations-derived fields null on archive years', () => {
    const frames = buildFrames({ snapshots: [SNAPSHOT_2075] }, STATUS_2076);
    const archive = frames[0];
    expect(archive.total_births).toBeNull();
    expect(archive.population_birth_death_net).toBeNull();
    expect(archive.projected_growth_rate).toBeNull();
    expect(archive.total_deaths).toBe(1241);
  });

  it('excludes Money and Housing from the resource list but exposes them separately', () => {
    const live = buildFrames({ snapshots: [] }, STATUS_2076)[0];
    expect(live.resources.map((r) => r.name)).toEqual(['Food']);
    expect(live.money.current).toBe(263711);
    expect(live.housing.current).toBe(93100);
    expect(live.resources[0].net).toBe(977 - 1271);
  });

  it('prefers status over a same-year snapshot for the live frame', () => {
    const sameYearSnap = { ...SNAPSHOT_2075, year: 2076, population_total: 1 };
    const frames = buildFrames({ snapshots: [sameYearSnap] }, STATUS_2076);
    expect(frames).toHaveLength(1);
    expect(frames[0].population).toBe(99163);
    expect(frames[0].isLive).toBe(true);
  });

  it('handles missing status (all archive) and missing history (single live)', () => {
    expect(buildFrames({ snapshots: [SNAPSHOT_2075] }, null).map((f) => f.isLive)).toEqual([false]);
    expect(buildFrames(null, STATUS_2076).map((f) => f.isLive)).toEqual([true]);
    expect(buildFrames(null, null)).toEqual([]);
  });
});

describe('frame normalization', () => {
  it('frameFromSnapshot carries overton and coerces non-finite to null', () => {
    const f = frameFromSnapshot({ year: 2075, stability: 'nope', overton: { faith: 6 } });
    expect(f.stability).toBeNull();
    expect(f.overton).toEqual({ faith: 6 });
  });

  it('frameFromStatus returns null for missing input', () => {
    expect(frameFromStatus(null)).toBeNull();
  });
});
