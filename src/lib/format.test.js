import { describe, expect, test } from 'vitest';
import {
  fmtInt, fmtNum, fmtSignedInt, fmtSigned, fmtPct,
  chipSignedFlow, chipUpkeepFlow,
} from './format.js';

describe('display formatters (null → —)', () => {
  test('fmtInt rounds and groups', () => {
    expect(fmtInt(93100.4)).toBe('93,100');
    expect(fmtInt(0)).toBe('0');
    expect(fmtInt(null)).toBe('—');
    expect(fmtInt(NaN)).toBe('—');
  });

  test('fmtInt rejects non-numbers and non-finite values', () => {
    expect(fmtInt(undefined)).toBe('—');
    expect(fmtInt(Infinity)).toBe('—');
    expect(fmtInt('')).toBe('—');
  });

  test('negative zero normalizes to unsigned 0', () => {
    expect(fmtInt(-0.4)).toBe('0');
    expect(fmtSignedInt(-0.4)).toBe('0');
    expect(chipSignedFlow(-0.4)).toBe('0');
  });

  test('fmtNum fixes decimals', () => {
    expect(fmtNum(0.0099, 2)).toBe('0.01');
    expect(fmtNum(0.037, 2)).toBe('0.04');
    expect(fmtNum(833.3043, 1)).toBe('833.3');
    expect(fmtNum(0.769, 3)).toBe('0.769');
    expect(fmtNum(null)).toBe('—');
  });

  test('fmtSignedInt signs positives', () => {
    expect(fmtSignedInt(554)).toBe('+554');
    expect(fmtSignedInt(-12)).toBe('-12');
    expect(fmtSignedInt(0)).toBe('0');
    expect(fmtSignedInt(null)).toBe('—');
  });

  test('fmtSigned signs decimals', () => {
    expect(fmtSigned(-12.9456, 1)).toBe('-12.9');
    expect(fmtSigned(3.21, 1)).toBe('+3.2');
    expect(fmtSigned(0, 1)).toBe('0.0');
    expect(fmtSigned(null)).toBe('—');
  });

  test('fmtSigned takes its sign from the rounded value', () => {
    expect(fmtSigned(0.04, 1)).toBe('0.0');
    expect(fmtSigned(-0.04, 1)).toBe('0.0');
  });

  test('fmtPct converts 0..1 ratios', () => {
    expect(fmtPct(0.9847)).toBe('98%');
    expect(fmtPct(0.23)).toBe('23%');
    expect(fmtPct(1.2)).toBe('120%');
    expect(fmtPct(0.125, 1)).toBe('12.5%');
    expect(fmtPct(null)).toBe('—');
  });

  test('fmtPct normalizes tiny negatives that round to zero', () => {
    expect(fmtPct(-0.001)).toBe('0%');
    expect(fmtPct(-0.0004, 1)).toBe('0.0%');
    expect(fmtPct(-0.5)).toBe('-50%');
  });
});

describe('chip formatters (null → null, chip omitted)', () => {
  test('chipSignedFlow', () => {
    expect(chipSignedFlow(833.3)).toBe('+833');
    expect(chipSignedFlow(-1272)).toBe('-1,272');
    expect(chipSignedFlow(null)).toBeNull();
    expect(chipSignedFlow(undefined)).toBeNull();
  });

  test('chipUpkeepFlow renders positive upkeep as a cost', () => {
    expect(chipUpkeepFlow(846.25)).toBe('-846');
    expect(chipUpkeepFlow(-5)).toBe('+5');
    expect(chipUpkeepFlow(0)).toBe('0');
    expect(chipUpkeepFlow(null)).toBeNull();
  });
});
