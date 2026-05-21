import { describe, it, expect } from 'vitest';
import { CONTROL_COLORS, GOI_COLORS, PARTY_COLORS, goiColor, partyColor, resolveControlColor } from './faction-colors.js';

describe('control colors', () => {
  it('pins the map control palette for major institutions', () => {
    expect(CONTROL_COLORS).toMatchObject({
      Administration: '#38d39f',
      Corporate: '#ffd84d',
      Corporations: '#ffd84d',
      Unions: '#ff5544',
      Research: '#5ec3ff',
      Security: '#ff5544',
    });
  });

  it('pins live GoI accent colors', () => {
    expect(GOI_COLORS).toMatchObject({
      Administration: '#38d39f',
      Corporate: '#ffd84d',
      Unions: '#ff5544',
      Research: '#5ec3ff',
      Security: '#ff5544',
    });
    expect(goiColor('Administration')).not.toBe('var(--accent)');
  });

  it('uses canonical colors over stale generated palette defaults', () => {
    expect(resolveControlColor('Administration', {
      control: { Administration: '#5ec3ff' },
    })).toBe('#38d39f');
    expect(resolveControlColor('Unionists', {
      control: { Unionists: '#38d39f' },
    })).toBe('#ff5544');
  });

  it('preserves explicit workbook palette overrides', () => {
    expect(resolveControlColor('Administration', {
      control: { Administration: '#123456' },
    })).toBe('#123456');
  });
});

describe('party colors', () => {
  it('pins Discord role colours by exact party name', () => {
    expect(partyColor('Developmental League')).toBe('#3498db');
    expect(partyColor('Selenite Rose Front')).toBe('#e74c3c');
    expect(PARTY_COLORS['Novus Chrysalis Collective']).toBe('#2ecc71');
  });

  it('returns null for parties without a Discord role so callers can fall back', () => {
    expect(partyColor('Independent')).toBeNull();
    expect(partyColor('Unknown Party')).toBeNull();
  });
});
