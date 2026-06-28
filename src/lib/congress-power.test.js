import { describe, expect, test } from 'vitest';
import {
  majorityQuota,
  banzhafPower,
  effectiveParties,
  coalitionSeats,
} from './congress-power.js';

describe('majorityQuota', () => {
  test('⌊n/2⌋+1 for odd and even chambers', () => {
    expect(majorityQuota(27)).toBe(14);
    expect(majorityQuota(10)).toBe(6);
    expect(majorityQuota(1)).toBe(1);
  });
  test('guards non-positive / non-finite', () => {
    expect(majorityQuota(0)).toBe(0);
    expect(majorityQuota(null)).toBe(0);
    expect(majorityQuota(NaN)).toBe(0);
  });
});

describe('banzhafPower', () => {
  test('a party holding a strict majority alone has all the power', () => {
    const parties = [{ seats: 14 }, { seats: 7 }, { seats: 6 }];
    const power = banzhafPower(parties, majorityQuota(27));
    expect(power.get(parties[0])).toBeCloseTo(1, 6);
    expect(power.get(parties[1])).toBeCloseTo(0, 6);
    expect(power.get(parties[2])).toBeCloseTo(0, 6);
  });

  test('three equal parties each carry equal power, summing to 1', () => {
    const parties = [{ seats: 9 }, { seats: 9 }, { seats: 9 }];
    const power = banzhafPower(parties, majorityQuota(27));
    const vals = parties.map((p) => power.get(p));
    vals.forEach((v) => expect(v).toBeCloseTo(1 / 3, 6));
    expect(vals.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });

  test('dummy parties (never critical) have zero power', () => {
    // 8/1/1 with quota 6: A wins alone, so the two single-seat parties never
    // swing any coalition and carry zero Banzhaf power.
    const parties = [{ seats: 8 }, { seats: 1 }, { seats: 1 }];
    const power = banzhafPower(parties, majorityQuota(10));
    expect(power.get(parties[0])).toBeCloseTo(1, 6);
    expect(power.get(parties[1])).toBeCloseTo(0, 6);
    expect(power.get(parties[2])).toBeCloseTo(0, 6);
  });

  test('all-zero (pre-election) chamber yields zero power, no throw', () => {
    const parties = [{ seats: 0 }, { seats: 0 }];
    const power = banzhafPower(parties, majorityQuota(0));
    expect(power.get(parties[0])).toBe(0);
    expect(power.get(parties[1])).toBe(0);
  });
});

describe('effectiveParties', () => {
  test('one dominant party → ~1', () => {
    expect(effectiveParties([{ seats: 27 }])).toBeCloseTo(1, 6);
  });
  test('k even parties → k', () => {
    expect(effectiveParties([{ seats: 5 }, { seats: 5 }, { seats: 5 }, { seats: 5 }])).toBeCloseTo(4, 6);
  });
  test('no seats → null', () => {
    expect(effectiveParties([{ seats: 0 }, { seats: 0 }])).toBeNull();
    expect(effectiveParties([])).toBeNull();
  });
});

describe('coalitionSeats', () => {
  test('sums rounded non-negative seats', () => {
    expect(coalitionSeats([{ seats: 5 }, { seats: 6.0 }, { seats: null }])).toBe(11);
    expect(coalitionSeats([])).toBe(0);
  });
});
