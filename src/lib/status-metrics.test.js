import { describe, expect, test } from 'vitest';
import { populationDeltaFromStatus } from './status-metrics.js';

describe('populationDeltaFromStatus', () => {
  test('uses workbook total births minus deaths when available', () => {
    const status = {
      population_total: 17_850,
      demographics: {
        total_births: 849,
        total_deaths: 162,
        net_delta_pct: -0.375,
      },
    };

    expect(populationDeltaFromStatus(status)).toBe(687);
  });

  test('returns null instead of guessing when total births is missing', () => {
    const status = {
      population_total: 17_850,
      demographics: {
        total_deaths: 162,
        net_delta_pct: -0.375,
      },
    };

    expect(populationDeltaFromStatus(status)).toBeNull();
  });
});
