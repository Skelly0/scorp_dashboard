import { afterEach, describe, expect, test } from 'vitest';
import { get } from 'svelte/store';
import { situations } from './situations.js';
import { crisisBreach, situationLoad } from './crisis.js';

afterEach(() => situations.set(null));

describe('situationLoad + crisisBreach store', () => {
  test('null situations -> load null, not breached', () => {
    situations.set(null);
    expect(get(situationLoad)).toBe(null);
    expect(get(crisisBreach).breached).toBe(false);
  });

  test('sums active situation crisis_factors and breaches over 1.0', () => {
    situations.set({ active: [{ crisis_factor: 0.65 }, { crisis_factor: 0.5 }, { crisis_factor: 0.1 }] });
    expect(get(situationLoad)).toBeCloseTo(1.25, 5);
    const r = get(crisisBreach);
    expect(r.breached).toBe(true);
    expect(r.surplus).toBeCloseTo(0.25, 5);
  });

  test('sub-1.0 load is not breached', () => {
    situations.set({ active: [{ crisis_factor: 0.65 }, { crisis_factor: 0.1 }] });
    expect(get(crisisBreach).breached).toBe(false);
  });
});
