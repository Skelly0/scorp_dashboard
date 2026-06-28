import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import FederationChamber from './FederationChamber.svelte';

const federations = {
  total_seats: 7,
  delegations: [
    {
      name: 'Industrial Production',
      seats: 4,
      parties: [
        { name: 'Lunar Survival League', seats: 2 },
        { name: 'Selenite Rose Front', seats: 2 },
      ],
    },
    {
      name: 'Engineering',
      seats: 3,
      parties: [
        { name: 'Independent', seats: 1 },
        { name: 'Novus Chrysalis Collective', seats: 1 },
        { name: 'Education Party', seats: 1 },
      ],
    },
  ],
};

describe('FederationChamber', () => {
  test('renders one dot per delegate and one arc band per federation', () => {
    const { container } = render(FederationChamber, { props: { federations } });
    expect(container.querySelectorAll('.parliament-dot')).toHaveLength(7);
    expect(container.querySelectorAll('.parliament-svg path')).toHaveLength(2);
  });

  test('keeps delegations in workbook order with seat counts and shares', () => {
    const { container } = render(FederationChamber, { props: { federations } });
    const names = [...container.querySelectorAll('.seat-row-name')].map((el) =>
      el.textContent.trim()
    );
    expect(names[0]).toMatch(/^Industrial Production/);
    expect(names[1]).toMatch(/^Engineering/);
    const counts = [...container.querySelectorAll('.seat-row b')].map((el) => el.textContent);
    expect(counts).toEqual(['4', '3']);
    const shares = [...container.querySelectorAll('.seat-row-share')].map((el) => el.textContent);
    expect(shares).toEqual(['57%', '43%']);
  });

  test('colours dots by party and the band by federation', () => {
    const { container } = render(FederationChamber, { props: { federations } });
    const dotFills = [...container.querySelectorAll('.parliament-dot')].map((c) =>
      c.getAttribute('fill')
    );
    // First wedge: Industrial Production = LSL 2 then SRF 2.
    expect(dotFills.slice(0, 4)).toEqual(['#95a5a6', '#95a5a6', '#960202', '#960202']);
    // Independent has no pinned party colour — theme accent fallback.
    expect(dotFills[4]).toBe('var(--accent)');
    const arcStrokes = [...container.querySelectorAll('.parliament-svg path')].map((p) =>
      p.getAttribute('stroke')
    );
    expect(arcStrokes).toEqual(['#38d39f', '#5ec3ff']);
  });

  test('repeats each party split as screen-reader text', () => {
    const { container } = render(FederationChamber, { props: { federations } });
    const srOnly = [...container.querySelectorAll('.seat-row .sr-only')].map(
      (el) => el.textContent
    );
    expect(srOnly[0]).toContain('Lunar Survival League 2');
    expect(srOnly[0]).toContain('Selenite Rose Front 2');
  });

  test('renders rows without a diagram when no delegation holds seats', () => {
    const empty = {
      total_seats: 0,
      delegations: [{ name: 'Engineering', seats: 0, parties: [] }],
    };
    const { container } = render(FederationChamber, { props: { federations: empty } });
    expect(container.querySelector('.parliament-svg')).toBeNull();
    expect(container.querySelectorAll('.seat-row.muted')).toHaveLength(1);
  });
});
