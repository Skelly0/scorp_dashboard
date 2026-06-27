import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import ResourceTelemetry from './ResourceTelemetry.svelte';
import { status } from '../../stores/status.js';
import { history } from '../../stores/history.js';
import { selectedYearIdx } from '../../stores/timeline.js';

// Migrated parity coverage from the retired Status page: resource rows show gross
// +income / -upkeep chips, Money and Housing are excluded from the list, and a
// 0/0 resource renders without crashing.
function rowByName(name) {
  const nameNode = screen.getAllByText(name).find((n) => n.classList.contains('rt-name'));
  expect(nameNode).toBeTruthy();
  return nameNode.closest('.rt-row');
}

describe('ResourceTelemetry (Command parity)', () => {
  beforeEach(() => {
    selectedYearIdx.set(null);
    history.set({ years: [], snapshots: [] });
  });

  it('shows +income / -upkeep chips and excludes Money and Housing', () => {
    status.set({
      year: 2076,
      overton: {},
      demographics: {},
      resources: [
        { name: 'Food', current: 100, income: 12, upkeep: 7, delta: 5 },
        { name: 'Materials', current: 800, income: 90, upkeep: 20, delta: 70 },
        { name: 'Money', current: 1200, income: 90, upkeep: 20, delta: 70 },
        { name: 'Housing', current: 88890, income: 88890, upkeep: 92000, delta: -3110 },
      ],
    });
    render(ResourceTelemetry);

    const food = rowByName('Food');
    expect(within(food).getByText(/^\+12 in\/yr$/)).toBeTruthy();
    expect(within(food).getByText(/7 out\/yr/)).toBeTruthy();

    const materials = rowByName('Materials');
    expect(within(materials).getByText(/^\+90 in\/yr$/)).toBeTruthy();
    expect(within(materials).getByText(/20 out\/yr/)).toBeTruthy();

    // Money & Housing are not listed (they would dominate the shared bar scale).
    expect(screen.queryAllByText('Money').filter((n) => n.classList.contains('rt-name'))).toHaveLength(0);
    expect(screen.queryAllByText('Housing').filter((n) => n.classList.contains('rt-name'))).toHaveLength(0);
  });

  it('renders a 0/0 resource without crashing', () => {
    status.set({
      year: 2076,
      overton: {},
      demographics: {},
      resources: [{ name: 'Helium-3', current: 0, income: 0, upkeep: 0, delta: 0 }],
    });
    render(ResourceTelemetry);

    const helium = rowByName('Helium-3');
    expect(within(helium).getByText(/^\+0 in\/yr$/)).toBeTruthy();
    expect(within(helium).getByText(/0 out\/yr/)).toBeTruthy();
  });
});
