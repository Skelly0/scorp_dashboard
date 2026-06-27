import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/svelte';
import VitalSigns from './VitalSigns.svelte';
import { status } from '../../stores/status.js';
import { history } from '../../stores/history.js';
import { situations } from '../../stores/situations.js';
import { parties } from '../../stores/parties.js';
import { selectedYearIdx } from '../../stores/timeline.js';

// Migrated parity coverage from the retired Status page: the headline economy
// metric is the Money resource reserve (not the colony resource total), and the
// population drill-down surfaces births + the projected-growth rate.
const SNAP_2075 = {
  year: 2075,
  stability: 0.39,
  crisis_factor: 0.73,
  gov_approval: 0.55,
  avg_satisfaction: 0.31,
  housing_util: 1.03,
  total_deaths: 1241,
  population_total: 92000,
  overton: {},
  resources: [{ name: 'Money', current: 100000, income: 1, upkeep: 1, delta: 0 }],
};

function liveStatus(over = {}) {
  return {
    year: 2076,
    stability: 0.48,
    crisis_factor: 0.66,
    gov_approval: 0.54,
    population_total: 92000,
    overton: {},
    // treasury.money is the all-resource total — must NOT be the headline.
    treasury: { money: 222465, delta: 0 },
    resources: [
      { name: 'Money', current: 125000, income: 429534.5245, upkeep: 107750, delta: 321784.5245 },
      { name: 'Food', current: 100, income: 12, upkeep: 7, delta: 5 },
      { name: 'Housing', current: 88890, income: 88890, upkeep: 92000, delta: -3110 },
    ],
    demographics: { total_births: 2046, total_deaths: 1276, housing_util: 0.82, avg_satisfaction: 0.3, net_delta_pct: -0.42 },
    ...over,
  };
}

function tile(label) {
  const labelNode = screen.getAllByText(label).find((n) => n.classList.contains('vital-label'));
  expect(labelNode).toBeTruthy();
  return labelNode.closest('.vital');
}

describe('VitalSigns (Command parity)', () => {
  beforeEach(() => {
    selectedYearIdx.set(null);
    history.set({ years: [2075], snapshots: [SNAP_2075] });
    status.set(liveStatus());
    situations.set({ active: [] });
    parties.set({ parties: [] });
  });

  it('uses the Money resource reserve as the Treasury headline, not treasury.money', () => {
    render(VitalSigns);
    const treasury = tile('Treasury');
    expect(
      within(treasury).getByText(
        (_, node) => node?.classList?.contains('vital-num') && node.textContent.trim() === '₡ 125,000',
      ),
    ).toBeTruthy();
    expect(within(treasury).queryByText('222,465')).toBeNull();
  });

  it('surfaces births and projected growth rate in the population drill-down', async () => {
    render(VitalSigns);
    const pop = tile('Population');
    await fireEvent.click(pop);
    expect(within(pop).getByText('Births / yr')).toBeTruthy();
    expect(within(pop).getByText('+2,046')).toBeTruthy();
    expect(within(pop).getByText('Projected growth')).toBeTruthy();
    expect(within(pop).getByText('+0.84%')).toBeTruthy(); // (2046-1276)/92000*100
  });

  it('flags the Crisis tile OVER 1.0 when situation load exceeds capacity', () => {
    situations.set({
      active: [
        { name: 'a', crisis_factor: 0.7, description: '' },
        { name: 'b', crisis_factor: 0.6, description: '' },
      ],
    });
    render(VitalSigns);
    expect(screen.getByText('OVER 1.0')).toBeTruthy();
  });

  it('does not flag OVER 1.0 when load is under capacity', () => {
    situations.set({ active: [{ name: 'a', crisis_factor: 0.3, description: '' }] });
    render(VitalSigns);
    expect(screen.queryByText('OVER 1.0')).toBeNull();
  });
});
