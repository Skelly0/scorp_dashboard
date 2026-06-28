import { describe, expect, test } from 'vitest';
import { relativeLuminance, contrastInk, isHexColor } from './contrast.js';

describe('relativeLuminance', () => {
  test('white ≈ 1, black = 0', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 3);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 6);
  });
  test('returns null for non-hex tokens', () => {
    expect(relativeLuminance('var(--accent)')).toBeNull();
    expect(relativeLuminance('')).toBeNull();
    expect(relativeLuminance(null)).toBeNull();
  });
});

describe('contrastInk', () => {
  test('dark ink on light fills, light ink on dark fills', () => {
    expect(contrastInk('#ffd84d')).toBe('#10141b'); // bright yellow → dark text
    expect(contrastInk('#960202')).toBe('#f6f3ec'); // deep red → light text
  });
  test('null for non-hex so callers can fall back', () => {
    expect(contrastInk('var(--accent)')).toBeNull();
  });
});

describe('isHexColor', () => {
  test('accepts 6-digit hex with/without #, rejects tokens', () => {
    expect(isHexColor('#3a9443')).toBe(true);
    expect(isHexColor('3a9443')).toBe(true);
    expect(isHexColor('var(--accent)')).toBe(false);
    expect(isHexColor('#fff')).toBe(false);
  });
});
