import { describe, expect, test } from 'vitest';
import { INNER_RADIUS, dotRadius, groupArcs, rowCount, rowRadii, seatPositions } from './parliament.js';

const EPS = 1e-9;

describe('rowCount', () => {
  test('zero/invalid seat counts have no rows', () => {
    expect(rowCount(0)).toBe(0);
    expect(rowCount(-3)).toBe(0);
    expect(rowCount(NaN)).toBe(0);
  });

  test('grows gently with chamber size', () => {
    expect(rowCount(1)).toBe(1);
    expect(rowCount(27)).toBe(3); // the live 27-seat Congress
    expect(rowCount(100)).toBe(6);
  });
});

describe('seatPositions', () => {
  test('returns one position per seat', () => {
    expect(seatPositions(0)).toEqual([]);
    expect(seatPositions(27)).toHaveLength(27);
    expect(seatPositions(100)).toHaveLength(100);
  });

  test('a single seat sits at the top of the hemicycle', () => {
    const [seat] = seatPositions(1);
    expect(seat.angle).toBeCloseTo(Math.PI / 2);
    expect(seat.x).toBeCloseTo(0);
    expect(seat.y).toBeGreaterThan(0);
  });

  test('fills left to right within the unit hemicycle', () => {
    const seats = seatPositions(27);
    for (let i = 1; i < seats.length; i++) {
      expect(seats[i].angle).toBeLessThanOrEqual(seats[i - 1].angle + EPS);
    }
    expect(seats[0].x).toBeLessThan(0); // leftmost first
    expect(seats[seats.length - 1].x).toBeGreaterThan(0);
    for (const s of seats) {
      const r = Math.hypot(s.x, s.y);
      expect(s.y).toBeGreaterThanOrEqual(-EPS);
      expect(r).toBeGreaterThanOrEqual(INNER_RADIUS - EPS);
      expect(r).toBeLessThanOrEqual(1 + EPS);
    }
  });

  test('rowRadii spans inner radius to the rim', () => {
    expect(rowRadii(0)).toEqual([]);
    expect(rowRadii(1)).toEqual([(INNER_RADIUS + 1) / 2]);
    const three = rowRadii(3);
    expect(three[0]).toBeCloseTo(INNER_RADIUS);
    expect(three[2]).toBeCloseTo(1);
  });

  test('no two seats overlap at the suggested dot radius', () => {
    for (const n of [5, 27, 60]) {
      const seats = seatPositions(n);
      const d = dotRadius(n) * 2;
      for (let i = 0; i < seats.length; i++) {
        for (let j = i + 1; j < seats.length; j++) {
          const dist = Math.hypot(seats[i].x - seats[j].x, seats[i].y - seats[j].y);
          expect(dist).toBeGreaterThanOrEqual(d - EPS);
        }
      }
    }
  });
});

describe('groupArcs', () => {
  // The live chamber: 8 federation delegations of 3/3/3/3/3/4/4/4 seats.
  const sizes = [3, 3, 3, 3, 3, 4, 4, 4];

  test('produces contiguous wedges spanning the full hemicycle', () => {
    const positions = seatPositions(27);
    const arcs = groupArcs(positions, sizes);
    expect(arcs).toHaveLength(8);
    expect(arcs[0].start).toBeCloseTo(Math.PI);
    expect(arcs[7].end).toBe(0);
    for (let i = 0; i < arcs.length; i++) {
      expect(arcs[i].start).toBeGreaterThan(arcs[i].end);
      if (i > 0) expect(arcs[i].start).toBeCloseTo(arcs[i - 1].end);
    }
  });

  test('zero-size groups yield null without breaking neighbours', () => {
    const positions = seatPositions(6);
    const arcs = groupArcs(positions, [3, 0, 3]);
    expect(arcs[1]).toBeNull();
    expect(arcs[0].start).toBeCloseTo(Math.PI);
    expect(arcs[2].end).toBe(0);
    expect(arcs[0].end).toBeCloseTo(arcs[2].start);
  });

  test('a single group owns the whole arc', () => {
    const arcs = groupArcs(seatPositions(5), [5]);
    expect(arcs).toEqual([{ start: Math.PI, end: 0 }]);
  });
});
