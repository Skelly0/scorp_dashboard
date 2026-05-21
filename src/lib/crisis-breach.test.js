import { describe, expect, test } from 'vitest';
import { computeCrisisBreach, crisisGaugeGeometry, sumSituationLoad, CRISIS_GAUGE_MAX, CRISIS_INTENSITY_FLOOR, CRISIS_INTENSITY_RAMP } from './crisis-breach.js';

describe('computeCrisisBreach', () => {
  test('null factor is not breached', () => {
    expect(computeCrisisBreach(null)).toEqual({ factor: null, breached: false, surplus: 0, intensity: 0 });
  });

  test('non-finite factor is treated as null', () => {
    expect(computeCrisisBreach(NaN).breached).toBe(false);
    expect(computeCrisisBreach(undefined).factor).toBe(null);
  });

  test('high-but-under-1 load is not breached', () => {
    const r = computeCrisisBreach(0.84);
    expect(r.breached).toBe(false);
    expect(r.surplus).toBe(0);
    expect(r.intensity).toBe(0);
  });

  test('exactly 1.0 is NOT breached (strictly over 1)', () => {
    expect(computeCrisisBreach(1.0).breached).toBe(false);
  });

  test('over 1.0 is breached with surplus and ramped intensity', () => {
    const r = computeCrisisBreach(1.18);
    expect(r.breached).toBe(true);
    expect(r.surplus).toBeCloseTo(0.18, 5);
    expect(r.intensity).toBeCloseTo(CRISIS_INTENSITY_FLOOR + 0.18 * CRISIS_INTENSITY_RAMP, 5);
  });

  test('intensity is capped at 1', () => {
    expect(computeCrisisBreach(2.0).intensity).toBe(1);
  });
});

describe('crisisGaugeGeometry', () => {
  test('1.0 tick sits at 1/1.5 of the track', () => {
    expect(crisisGaugeGeometry(0).tickPct).toBeCloseTo((1 / CRISIS_GAUGE_MAX) * 100, 5);
  });

  test('1.18 fills solid to capacity and shows surplus segment', () => {
    const g = crisisGaugeGeometry(1.18);
    expect(g.solidPct).toBeCloseTo((1 / 1.5) * 100, 5);
    expect(g.surplusPct).toBeCloseTo((0.18 / 1.5) * 100, 5);
    expect(g.surplus).toBeCloseTo(0.18, 5);
  });

  test('under 1.0 fills proportionally with no surplus', () => {
    const g = crisisGaugeGeometry(0.6);
    expect(g.solidPct).toBeCloseTo((0.6 / 1.5) * 100, 5);
    expect(g.surplusPct).toBe(0);
  });
});

describe('sumSituationLoad', () => {
  test('non-array returns null', () => {
    expect(sumSituationLoad(null)).toBe(null);
    expect(sumSituationLoad(undefined)).toBe(null);
  });
  test('empty array sums to 0', () => {
    expect(sumSituationLoad([])).toBe(0);
  });
  test('sums crisis_factor across active situations (incl. negatives)', () => {
    expect(sumSituationLoad([{ crisis_factor: 0.65 }, { crisis_factor: 0.5 }, { crisis_factor: -0.05 }]))
      .toBeCloseTo(1.10, 5);
  });
  test('ignores non-numeric contributions', () => {
    expect(sumSituationLoad([{ crisis_factor: 0.7 }, { crisis_factor: null }, { foo: 1 }]))
      .toBeCloseTo(0.7, 5);
  });
});
