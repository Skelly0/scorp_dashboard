import { describe, it, expect } from 'vitest';
import { CONTROL_COLORS, resolveControlColor } from './faction-colors.js';

describe('control colors', () => {
  it('pins the map control palette for major institutions', () => {
    expect(CONTROL_COLORS).toMatchObject({
      Administration: '#38d39f',
      Corporations: '#ffd84d',
      Unions: '#ff5544',
      Research: '#5ec3ff',
    });
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
