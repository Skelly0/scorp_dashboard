import { describe, expect, test, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
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

function kpiBlockByLabel(label) {
  const labelNode = screen.getAllByText(label).find((node) => node.classList.contains('kpi-label'));
  expect(labelNode).toBeTruthy();
  return labelNode.closest('.kpi-block');
}

function statTileByLabel(label) {
  const labelNode = screen.getAllByText(label).find((node) => node.classList.contains('label'));
  expect(labelNode).toBeTruthy();
  return labelNode.closest('.stat-tile');
}

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

  test('uses Money resource as the headline instead of the colony resource total', () => {
    status.set({
      ...baseStatus,
      treasury: { money: 222465, delta: 321784.5245 },
      resources: [
        { name: 'Money', current: 125000, income: 429534.5245, upkeep: 107750, delta: 321784.5245 },
      ],
    });

    render(Status);

    expect(screen.queryByText('Government Revenue')).toBeNull();
    expect(screen.queryByText('Treasury balance')).toBeNull();
    expect(screen.queryByText('222,465')).toBeNull();

    const moneyHeadline = kpiBlockByLabel('Money');
    expect(within(moneyHeadline).getByText('Reserve')).toBeTruthy();
    expect(within(moneyHeadline).getByText((_, node) =>
      node?.classList?.contains('kpi-num') && node.textContent === '₡ 125,000'
    )).toBeTruthy();
    expect(within(moneyHeadline).getByText('+429,535')).toBeTruthy();
    expect(within(moneyHeadline).getByText('-107,750')).toBeTruthy();
    expect(within(moneyHeadline).getByText('▲ +321785')).toBeTruthy();
  });

  test('shows numeric resource inflows and upkeeps inside resource flow boxes', () => {
    status.set({
      ...baseStatus,
      resources: [
        { name: 'Food', current: 100, income: 12, upkeep: 7, delta: 5 },
        { name: 'Money', current: 1200, income: 90, upkeep: 20, delta: 70 },
      ],
    });

    render(Status);

    const foodTile = statTileByLabel('Food');
    expect(within(foodTile).getByText('+12')).toBeTruthy();
    expect(within(foodTile).getByText('-7')).toBeTruthy();
    expect(within(foodTile).queryByText('Yield +12')).toBeNull();
    expect(within(foodTile).queryByText('Upkeep -7')).toBeNull();
    expect(within(foodTile).queryByText((text) => text.includes('▲') && text.includes('+5'))).toBeNull();

    const moneyTile = statTileByLabel('Money');
    expect(within(moneyTile).getByText('+90')).toBeTruthy();
    expect(within(moneyTile).getByText('-20')).toBeTruthy();
    expect(within(moneyTile).queryByText('Income +90')).toBeNull();
    expect(within(moneyTile).queryByText('Upkeep -20')).toBeNull();
    expect(within(moneyTile).queryByText((text) => text.includes('▲') && text.includes('+70'))).toBeNull();
  });

  test('does not invent gross flow numbers for net-only resource data', () => {
    status.set({
      ...baseStatus,
      resources: [
        { name: 'Food', current: 100, delta: 5 },
        { name: 'Water', current: 250, delta: -3 },
      ],
    });

    render(Status);

    const foodTile = statTileByLabel('Food');
    expect(within(foodTile).queryByText('+5')).toBeNull();
    expect(within(foodTile).queryByText('0')).toBeNull();

    const waterTile = statTileByLabel('Water');
    expect(within(waterTile).queryByText('-3')).toBeNull();
    expect(within(waterTile).queryByText('0')).toBeNull();
  });

  test('renders zero income and zero upkeep without duplicate-key failures', () => {
    status.set({
      ...baseStatus,
      resources: [
        { name: 'Helium-3', current: 0, income: 0, upkeep: 0, delta: 0 },
      ],
    });

    render(Status);

    const heliumTile = statTileByLabel('Helium-3');
    expect(within(heliumTile).getAllByText('0').length).toBe(3);
  });
});
