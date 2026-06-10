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

const minimalGoi = {
  name: 'Administration',
  main_class: 'Bureaucrats',
  approach: 'Centrist',
  derived_influence: 0.2,
  approval: 0.5,
  mad_index: 0.1,
  effective_worldview: {},
  sub_factions: [],
  active_benefits: { unlocked: 0, total: 0, unlocked_list: [], items: [] },
};

describe('GoIs page', () => {
  beforeEach(() => {
    meta.set(null);
    gois.set(null);
    goisError.set(null);
  });

  test('labels the captured-pop heatmap with the workbook table name', () => {
    gois.set({ ...baseGois, gois: [minimalGoi] });

    render(GoIs);

    expect(screen.getByText('GOI VALUE CAPTURED POP')).toBeTruthy();
    expect(screen.getByText('1,974')).toBeTruthy();
    expect(screen.queryByText('Pop Capture Matrix')).toBeNull();
  });

  test('zero GoIs renders only the empty state — no heatmap or rail', () => {
    gois.set(baseGois);

    render(GoIs);

    expect(screen.getByText('No GoIs recorded in this sync.')).toBeTruthy();
    expect(screen.queryByText('GOI VALUE CAPTURED POP')).toBeNull();
    expect(screen.queryByText('Inspect a sub-faction')).toBeNull();
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

  test('does not render nameless sub-faction rows', () => {
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
          active_benefits: { unlocked: 0, total: 0, unlocked_list: [], items: [] },
          sub_factions: [
            { name: null, influence: null, approval: null },
            { name: '', influence: 0.3, approval: 0.4 },
            { name: 'Legal Professionals', influence: 0.5, approval: 0.57 },
          ],
        },
      ],
    });

    const { container } = render(GoIs);

    expect(screen.getByText('Legal Professionals')).toBeTruthy();
    expect(container.querySelectorAll('.goi-subfaction-button')).toHaveLength(1);
  });
});
