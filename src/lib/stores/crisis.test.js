import { afterEach, describe, expect, test } from 'vitest';
import { get } from 'svelte/store';
import { status } from './status.js';
import { crisisBreach } from './crisis.js';

afterEach(() => status.set(null));

describe('crisisBreach store', () => {
  test('null status is not breached', () => {
    status.set(null);
    expect(get(crisisBreach).breached).toBe(false);
  });

  test('derives breach from status.crisis_factor', () => {
    status.set({ crisis_factor: 1.2 });
    const r = get(crisisBreach);
    expect(r.breached).toBe(true);
    expect(r.surplus).toBeCloseTo(0.2, 5);
  });

  test('under-1 crisis_factor is not breached', () => {
    status.set({ crisis_factor: 0.84 });
    expect(get(crisisBreach).breached).toBe(false);
  });
});
