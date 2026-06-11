import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import SeatChamber from './SeatChamber.svelte';

const chamber = {
  total_seats: 27,
  parties: [
    { name: 'Education Party', seats: 2 },
    { name: 'Lunar Survival League', seats: 8 },
    { name: 'Selenite Rose Front', seats: 7 },
    { name: 'Novus Chrysalis Collective', seats: 6 },
    { name: 'Independent', seats: 4 },
    { name: 'Non-aligned', seats: 0 },
  ],
};

describe('SeatChamber', () => {
  test('sorts party rows by seats descending', () => {
    const { container } = render(SeatChamber, { props: { chamber } });
    const names = [...container.querySelectorAll('.seat-row-name')].map((el) => el.textContent);
    expect(names).toEqual([
      'Lunar Survival League',
      'Selenite Rose Front',
      'Novus Chrysalis Collective',
      'Independent',
      'Education Party',
      'Non-aligned',
    ]);
  });

  test('mutes zero-seat parties and omits them from the strip', () => {
    const { container } = render(SeatChamber, { props: { chamber } });
    expect(container.querySelectorAll('.seat-row.muted')).toHaveLength(1);
    expect(container.querySelector('.seat-row.muted .seat-row-name')?.textContent).toBe('Non-aligned');
    expect(container.querySelectorAll('.seat-strip > i')).toHaveLength(5);
  });

  test('renders the total seats KPI and share percentages', () => {
    const { container } = render(SeatChamber, { props: { chamber } });
    expect(container.querySelector('.kpi-num')?.textContent).toBe('27');
    const shares = [...container.querySelectorAll('.seat-row-share')].map((el) => el.textContent);
    expect(shares[0]).toBe('30%'); // 8 / 27 → fmtPct default 0 digits
  });
});
