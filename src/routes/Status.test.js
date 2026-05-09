import { describe, expect, test, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Status from './Status.svelte';
import { history } from '../lib/stores/history.js';
import { meta } from '../lib/stores/meta.js';
import { status, statusError } from '../lib/stores/status.js';

const baseStatus = {
  year: 2075,
  treasury: { money: 1200, delta: 40 },
  stability: 0.72,
  crisis_factor: 0.18,
  population_total: 61250,
  gov_approval: 0.65,
  demographics: {
    effective_growth_rate: 0.0096,
    total_births: 577,
    total_deaths: 488,
    net_delta_pct: 0.15,
    housing_util: 0.82,
  },
  resources: [],
  overton: {},
  active_situations: [],
};

describe('Status page', () => {
  beforeEach(() => {
    meta.set(null);
    history.set(null);
    status.set(null);
    statusError.set(null);
  });

  test('shows total births per year instead of growth rate percentage', () => {
    status.set(baseStatus);

    render(Status);

    expect(screen.getByText('Births / year')).toBeTruthy();
    expect(screen.getByText('577')).toBeTruthy();
    expect(screen.getByText('Projected Growth')).toBeTruthy();
    expect(screen.queryByText('Est. Net Δ%')).toBeNull();
    expect(screen.queryByText('Growth Rate %')).toBeNull();
    expect(screen.queryByText('0.96%')).toBeNull();
  });
});
