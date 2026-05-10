import { describe, expect, test, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import Cropsim from './Cropsim.svelte';
import { meta } from '../lib/stores/meta.js';
import { cropsim, cropsimError } from '../lib/stores/cropsim.js';
import { status, statusError } from '../lib/stores/status.js';

const baseCropsim = {
  metrics: {
    total_supply: 821.4679696,
    total_demand: 997.225,
    balance: -175.7570304,
    security_ratio: 0.8237538867,
    per_cap: 0.01080878907,
    variety_index: 0.03404682807,
    production_types: 1,
    demand_classes: 1,
  },
  production: [
    { food_type: 'Greens', total_units: 185.2963774, calorie_mult: 1, share: 1 },
  ],
  demand: [
    { class_name: 'Botanists', pop: 7300, per_cap_demand: 0.011, total_demand: 80.3, share: 1 },
  ],
};

describe('Cropsim page', () => {
  beforeEach(() => {
    meta.set(null);
    cropsim.set(null);
    cropsimError.set(null);
    status.set(null);
    statusError.set(null);
  });

  test('shows the current food reserve with supply and demand flows', () => {
    cropsim.set(baseCropsim);
    status.set({
      resources: [
        { name: 'Food', current: 1000, income: 821.4679696, upkeep: 997.225, delta: -175.7570304 },
      ],
    });

    render(Cropsim);

    const reserveKpi = screen.getByText('Food Reserve').closest('.kpi-block');
    expect(within(reserveKpi).getByText('1,000')).toBeTruthy();
    expect(within(reserveKpi).getByText('+821')).toBeTruthy();
    expect(within(reserveKpi).getByText('-997')).toBeTruthy();
    expect(within(reserveKpi).queryByText('Supply +821')).toBeNull();
    expect(within(reserveKpi).queryByText('Demand -997')).toBeNull();
  });

  test('labels the per-turn supply minus demand KPI as net per turn', () => {
    cropsim.set(baseCropsim);
    status.set({ resources: [] });

    render(Cropsim);

    expect(screen.getByText('Net/Turn')).toBeTruthy();
    expect(screen.queryByText('Balance')).toBeNull();
  });
});
