import { describe, it, expect } from 'vitest';
import {
  CONTROL_COLORS,
  FEDERATION_COLORS,
  GOI_COLORS,
  PARTY_COLORS,
  federationColor,
  goiColor,
  partyColor,
  resolveControlColor,
} from './faction-colors.js';

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
      Proletariat: '#ff5544',
      'White Collar': '#ffd84d',
      Research: '#5ec3ff',
      Congregations: '#c44dff',
      'Outcast Dissidents': '#ff8c42',
    });
    expect(goiColor('Administration')).not.toBe('var(--accent)');
    expect(goiColor('Outcast Dissidents')).not.toBe('var(--accent)');
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

  it('pins the Education Party turquoise', () => {
    expect(partyColor('Education Party')).toBe('#1abc9c');
  });

  it('returns null for parties without a Discord role so callers can fall back', () => {
    expect(partyColor('Independent')).toBeNull();
    expect(partyColor('Unknown Party')).toBeNull();
  });
});

describe('federation colors', () => {
  it('pins all eight live trade federations', () => {
    expect(Object.keys(FEDERATION_COLORS)).toHaveLength(8);
    expect(federationColor('Administration & Bureaucracy')).toBe('#ffb000');
    expect(federationColor('Industrial Production')).toBe('#38d39f');
    expect(federationColor('Service & Support Workers')).toBe('#a89567');
  });

  it('matches each 1:1 federation to its dominant member class colour', () => {
    expect(federationColor('Engineering')).toBe('#5ec3ff'); // Engineers
    expect(federationColor('Botany & Agriculture')).toBe('#7fc97f'); // Botanists
    expect(federationColor('Extraction & Mining')).toBe('#ff8c42'); // Extraction Workers
  });

  it('falls back to the theme accent for unknown federations', () => {
    expect(federationColor('Asteroid Wranglers')).toBe('var(--accent)');
  });
});
