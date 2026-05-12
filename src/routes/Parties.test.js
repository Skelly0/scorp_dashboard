import { describe, expect, test, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Parties from './Parties.svelte';
import { meta } from '../lib/stores/meta.js';
import { parties, partiesError } from '../lib/stores/parties.js';
import { pops, popsError } from '../lib/stores/pops.js';

const baseParties = {
  parties: [
    {
      name: 'Developmental League',
      closest_goi: 'Hidden GoI Label',
      establishment: 0.6,
      vote_share: 0.21,
      estimated_support: 42599,
      mad_index: -0.075,
      stance: {
        expansion: 3,
        authority: 3,
        corporate: 4,
        technocratic: 3,
        faith: 7,
        materialist: 3,
      },
    },
    {
      name: 'Independent',
      closest_goi: 'Administration',
      establishment: 0.6,
      vote_share: 0.27,
      estimated_support: 54304,
      mad_index: -0.75,
      stance: {
        expansion: 5,
        authority: 3,
        corporate: 3.5,
        technocratic: 3.5,
        faith: 6,
        materialist: 4,
      },
    },
  ],
  goi_compat_matrix: {
    parties: ['Developmental League', 'Independent'],
    gois: ['Administration', 'Research'],
    values: [[0.27, 0.58], [0.59, 0.57]],
  },
  class_compat_matrix: {
    parties: ['Developmental League', 'Independent'],
    classes: ['Scientists', 'Bureaucrats'],
    values: [[0.56, 0.21], [0.41, 0.61]],
  },
  party_capture_pct_matrix: {
    classes: ['Scientists', 'Bureaucrats'],
    parties: ['Developmental League', 'Independent'],
    values: [[0.496, 0.361], [0.203, 0.578]],
  },
  party_capture_pop_matrix: {
    classes: ['Scientists', 'Bureaucrats'],
    parties: ['Developmental League', 'Independent'],
    values: [[4237, 3087], [1062, 3021]],
  },
};

describe('Parties page', () => {
  beforeEach(() => {
    meta.set(null);
    parties.set(null);
    partiesError.set(null);
    pops.set(null);
    popsError.set(null);
  });

  test('shows party supporters and class support split from capture data', () => {
    parties.set(baseParties);
    pops.set({ classes: [] });

    render(Parties);

    expect(screen.getAllByText('Supporters').length).toBeGreaterThan(0);
    expect(screen.getByText('5,299')).toBeTruthy();
    expect(screen.getAllByText('Top Classes').length).toBeGreaterThan(0);
    // The class×party heatmaps share a tabbed card; default tab is "Supporters"
    // (the authoritative people count per gotcha #44). The "% of Class" tab
    // button must also be present in the strip.
    expect(screen.getByText('Class × Party Support')).toBeTruthy();
    expect(screen.getByText('% of Class')).toBeTruthy();
    expect(screen.getAllByText('4,237').length).toBeGreaterThan(0);
    expect(screen.getByText('50% class')).toBeTruthy();
    expect(screen.queryByText('Hidden GoI Label')).toBeNull();
  });
});
