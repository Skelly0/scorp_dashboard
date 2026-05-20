import { describe, expect, test, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import GoIs from './GoIs.svelte';
import { meta } from '../lib/stores/meta.js';
import { gois, goisError } from '../lib/stores/gois.js';

const baseGois = {
  gois: [],
  pop_capture_matrix: {
    classes: ['Security'],
    gois: ['Administration'],
    values: [[1974]],
  },
};

describe('GoIs page', () => {
  beforeEach(() => {
    meta.set(null);
    gois.set(null);
    goisError.set(null);
  });

  test('labels the captured-pop heatmap with the workbook table name', () => {
    gois.set(baseGois);

    render(GoIs);

    expect(screen.getByText('GOI VALUE CAPTURED POP')).toBeTruthy();
    expect(screen.getByText('1,974')).toBeTruthy();
    expect(screen.queryByText('Pop Capture Matrix')).toBeNull();
  });

  test('shows benefit descriptions and active state', () => {
    gois.set({
      ...baseGois,
      gois: [
        {
          name: 'Administration',
          main_class: 'Bureaucrats',
          approach: 'Centrist',
          derived_influence: 0.2,
          approval: 0.5,
          mad_index: 0.1,
          effective_worldview: {},
          sub_factions: [],
          active_benefits: {
            unlocked: 1,
            total: 3,
            unlocked_list: ['Charter Draft'],
            items: [
              {
                name: 'Charter Draft',
                description: 'Stability +',
                threshold: 0.3,
                active: true,
              },
              {
                name: 'Civil Service',
                description: 'Admin capacity +',
                threshold: 0.45,
                active: false,
              },
            ],
          },
        },
      ],
    });

    render(GoIs);

    expect(screen.getByText('Benefits 1/3 active')).toBeTruthy();
    expect(screen.getByText('Charter Draft')).toBeTruthy();
    expect(screen.getByText('Stability +')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Civil Service')).toBeTruthy();
    expect(screen.getByText('Admin capacity +')).toBeTruthy();
    expect(screen.getByText('Inactive')).toBeTruthy();
  });
});
