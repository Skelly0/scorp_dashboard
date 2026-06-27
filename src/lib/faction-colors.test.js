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
  it('pins Discord role colours by exact current party name', () => {
    expect(PARTY_COLORS).toMatchObject({
      'Lunar Reconstruction Association': '#b8893e',
      'The All Lunar Labor Bund': '#ff474c',
      'All Lunar Labor Bund': '#ff474c',
      'Selenite Rose Front': '#960202',
      'Development League': '#3498db',
      'Developmental League': '#3498db',
      'Novus Chrysalis Collective': '#3a9443',
      'Education Party': '#003366',
    });
  });

  it('keeps current election parties visually distinct', () => {
    const currentElectionColours = [
      'Lunar Reconstruction Association',
      'The All Lunar Labor Bund',
      'Selenite Rose Front',
      'Development League',
      'Novus Chrysalis Collective',
      'Education Party',
    ].map(partyColor);

    expect(new Set(currentElectionColours).size).toBe(currentElectionColours.length);
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
