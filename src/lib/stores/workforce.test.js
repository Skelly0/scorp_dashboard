import { describe, it, expect } from 'vitest';
import { get, writable } from 'svelte/store';

// Use a re-import pattern so we can swap the upstream `pops` store for tests.
// The store under test imports `pops` from './pops.js'; tests mock that module.
import { vi } from 'vitest';

vi.mock('./pops.js', () => {
  return { pops: writable(null) };
});

const { pops } = await import('./pops.js');
const { workforce } = await import('./workforce.js');

const sample = (overrides = {}) => ({
  classes: [
    { name: 'A', unemployed_count: 0, workforce: { demand: 100, supply: 80 } },
    { name: 'B', unemployed_count: 50, workforce: { demand: 200, supply: 250 } },
    { name: 'C', unemployed_count: 30, workforce: { demand: 50, supply: 40 } },
    ...((overrides.classes) ?? []),
  ],
  ...overrides,
});

describe('workforce derived store', () => {
  it('returns null when pops is null', () => {
    pops.set(null);
    expect(get(workforce)).toBeNull();
  });

  it('returns null when classes is empty', () => {
    pops.set({ classes: [] });
    expect(get(workforce)).toBeNull();
  });

  it('sums demand/supply/unemployed across classes', () => {
    pops.set(sample());
    const w = get(workforce);
    expect(w.totalDemand).toBe(350);
    expect(w.totalSupply).toBe(370);
    expect(w.totalUnemployed).toBe(80);
  });

  it('computes fillRatio as totalSupply/totalDemand', () => {
    pops.set(sample());
    expect(get(workforce).fillRatio).toBeCloseTo(370 / 350, 5);
  });

  it('returns null fillRatio when totalDemand is zero', () => {
    pops.set({ classes: [{ name: 'X', unemployed_count: 0, workforce: { demand: 0, supply: 0 } }] });
    expect(get(workforce).fillRatio).toBeNull();
  });

  it('shortage uses per-class summed shortage, not colony net', () => {
    // A: short by 20, B: surplus 50, C: short by 10. Net = -20 (surplus).
    // Per-class summed shortage = 20 + 0 + 10 = 30.
    pops.set(sample());
    expect(get(workforce).shortage).toBe(30);
  });

  it('topUnemployed lists top-2 by count, descending', () => {
    pops.set(sample());
    const top = get(workforce).topUnemployed;
    expect(top).toEqual([
      { name: 'B', count: 50 },
      { name: 'C', count: 30 },
    ]);
  });

  it('topShortage lists top-2 short classes, descending, ignores oversupplied', () => {
    pops.set(sample());
    const top = get(workforce).topShortage;
    expect(top).toEqual([
      { name: 'A', count: 20 },
      { name: 'C', count: 10 },
    ]);
  });

  it('mismatch is true only when both totalUnemployed > 0 and shortage > 0', () => {
    pops.set(sample());
    expect(get(workforce).mismatch).toBe(true);

    // No unemployment → no mismatch.
    pops.set({
      classes: [
        { name: 'A', unemployed_count: 0, workforce: { demand: 100, supply: 80 } },
      ],
    });
    expect(get(workforce).mismatch).toBe(false);

    // No shortage → no mismatch.
    pops.set({
      classes: [
        { name: 'A', unemployed_count: 50, workforce: { demand: 100, supply: 200 } },
      ],
    });
    expect(get(workforce).mismatch).toBe(false);
  });

  it('handles missing workforce/unemployed_count fields safely', () => {
    pops.set({
      classes: [
        { name: 'A' },
        { name: 'B', workforce: {} },
        { name: 'C', unemployed_count: null, workforce: { demand: null, supply: null } },
      ],
    });
    const w = get(workforce);
    expect(w.totalDemand).toBe(0);
    expect(w.totalSupply).toBe(0);
    expect(w.totalUnemployed).toBe(0);
    expect(w.fillRatio).toBeNull();
    expect(w.shortage).toBe(0);
    expect(w.mismatch).toBe(false);
  });
});
