import { describe, expect, test } from 'vitest';
import {
  formatStatusPercent,
  populationDeltaFromStatus,
  projectedGrowthRateFromStatus,
  statusMetricTone,
} from './status-metrics.js';

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

describe('projectedGrowthRateFromStatus', () => {
  test('uses workbook total births and deaths over population instead of stale net_delta_pct', () => {
    const status = {
      population_total: 92_000,
      demographics: {
        total_births: 2046,
        total_deaths: 1276,
        net_delta_pct: -0.426956522,
      },
    };

    expect(projectedGrowthRateFromStatus(status)).toBeCloseTo(0.8369565217);
  });

  test('returns null when actual totals or population are missing', () => {
    expect(projectedGrowthRateFromStatus({
      population_total: 92_000,
      demographics: { total_deaths: 1276, net_delta_pct: -0.426956522 },
    })).toBeNull();
    expect(projectedGrowthRateFromStatus({
      population_total: 0,
      demographics: { total_births: 2046, total_deaths: 1276 },
    })).toBeNull();
  });
});

describe('formatStatusPercent', () => {
  test('renders ratio metrics as whole percents', () => {
    expect(formatStatusPercent(0.1372)).toBe('14%');
    expect(formatStatusPercent(0.625)).toBe('63%');
  });

  test('preserves negative ratio metrics and blanks missing values', () => {
    expect(formatStatusPercent(-0.2552)).toBe('-26%');
    expect(formatStatusPercent(null)).toBe('—');
  });
});

describe('statusMetricTone', () => {
  test('marks low values red, medium values yellow, and high values green', () => {
    expect(statusMetricTone(0.32)).toBe('crit');
    expect(statusMetricTone(0.33)).toBe('warn');
    expect(statusMetricTone(0.65)).toBe('warn');
    expect(statusMetricTone(0.66)).toBe('good');
  });

  test('can invert tones for metrics where lower values are better', () => {
    const lowerIsBetter = { lowerIsBetter: true };

    expect(statusMetricTone(0.32, lowerIsBetter)).toBe('good');
    expect(statusMetricTone(0.33, lowerIsBetter)).toBe('warn');
    expect(statusMetricTone(0.65, lowerIsBetter)).toBe('warn');
    expect(statusMetricTone(0.66, lowerIsBetter)).toBe('crit');
  });

  test('does not tone missing values', () => {
    expect(statusMetricTone(null)).toBe(null);
  });
});
