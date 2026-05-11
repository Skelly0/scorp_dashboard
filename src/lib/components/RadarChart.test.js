import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import RadarChart from './RadarChart.svelte';

const AXES = [
  { label: 'Conservation', value: 6 },
  { label: 'Democratic', value: 5 },
  { label: 'Communal', value: 4 },
  { label: 'Populist', value: 3 },
  { label: 'Reason', value: 2 },
  { label: 'Idealist', value: 1 },
];

describe('RadarChart', () => {
  test('renders full axis labels', () => {
    const { container } = render(RadarChart, {
      props: { axes: AXES, size: 140 },
    });

    const labels = [...container.querySelectorAll('text')].map((node) => node.textContent);

    expect(labels).toEqual(AXES.map((axis) => axis.label));
    expect(labels).not.toContain('Cons');
  });
});
