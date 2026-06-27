import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ClassDetail from './ClassDetail.svelte';

const baseClass = {
  name: 'Bureaucrats',
  standard_of_living: 0.42,
  expected_sol: 0.55,
  social_privileges: 0.3,
  income: {},
  wealth: {},
  additional_income: {},
  consumption: {
    water: { per_cap: 0.005, total_per_turn: 5.146 },
    energy: { per_cap: 0.025, total_per_turn: 32.1625 },
    materials: { per_cap: 0.008, total_per_turn: 20.584 },
  },
  status: {},
  workforce: {},
  satisfaction: 0.4,
  satisfaction_breakdown: {},
};

describe('ClassDetail', () => {
  test('renders social privileges as a 0 to 10 standing score', () => {
    render(ClassDetail, {
      props: { cls: { ...baseClass, social_privileges: 5 }, populationProfile: null },
    });

    expect(screen.getByText('5/10')).toBeTruthy();
    expect(screen.queryByText('500%')).toBeNull();
  });

  test('renders per-class consumption values', () => {
    render(ClassDetail, {
      props: { cls: baseClass, populationProfile: null },
    });

    expect(screen.getByText('Consumption')).toBeTruthy();
    expect(screen.getByText('0.005')).toBeTruthy();
    expect(screen.getByText('5.15')).toBeTruthy();
    expect(screen.getByText('0.025')).toBeTruthy();
    expect(screen.getByText('32.16')).toBeTruthy();
    expect(screen.getByText('0.008')).toBeTruthy();
    expect(screen.getByText('20.58')).toBeTruthy();
  });

  test('renders worldview radar on the shared 1-7 scale', () => {
    const { container } = render(ClassDetail, {
      props: {
        cls: baseClass,
        populationProfile: {
          name: 'Industrial Workers',
          tier: 'Lower',
          pop: 21896,
          share: 0.218,
          political_weight: 1.15,
          worldview: {
            expansion: 1,
            authority: 7,
            corporate: 7,
            technocratic: 7,
            faith: 7,
            materialist: 7,
          },
        },
      },
    });

    const dataPath = container.querySelector('svg path');

    expect(dataPath?.getAttribute('d')).toContain('M 85.0 85.0');
  });
});
