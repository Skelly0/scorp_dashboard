import { describe, expect, test, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
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

  test('Roster tab shows supporters, top classes, and hides closest GoI', () => {
    parties.set(baseParties);
    pops.set({ classes: [] });

    render(Parties);

    // Roster is the default tab.
    expect(screen.getAllByText('Supporters').length).toBeGreaterThan(0);
    // Supporters = summed captured pop (4237 + 1062), not estimated_support.
    // Appears in the card stat and again in the vote-share legend.
    expect(screen.getAllByText('5,299').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Top Classes').length).toBeGreaterThan(0);
    expect(screen.getByText('50% class')).toBeTruthy();
    // closest_goi is never surfaced (gotcha #45).
    expect(screen.queryByText('Hidden GoI Label')).toBeNull();
  });

  test('Support tab exposes the class × party heatmaps', async () => {
    parties.set(baseParties);
    pops.set({ classes: [] });

    render(Parties);

    await fireEvent.click(screen.getByRole('tab', { name: 'Support' }));

    expect(screen.getByText('Class × Party Support')).toBeTruthy();
    // The class×party heatmaps share a tabbed card; default is "Supporters"
    // (authoritative per gotcha #44) and the "% of Class" tab is present.
    expect(screen.getByText('% of Class')).toBeTruthy();
    expect(screen.getAllByText('4,237').length).toBeGreaterThan(0);
  });
});
