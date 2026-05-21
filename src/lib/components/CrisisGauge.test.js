import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import CrisisGauge from './CrisisGauge.svelte';

describe('CrisisGauge', () => {
  test('renders solid fill, surplus segment, and surplus caption for 1.18', () => {
    const { container } = render(CrisisGauge, { props: { factor: 1.18 } });
    const solid = container.querySelector('.crisis-gauge .solid');
    const surplus = container.querySelector('.crisis-gauge .surplus');
    // jsdom's CSSOM serializer normalizes inline styles to `prop: value;`,
    // so match on the normalized form (space after colon) here.
    expect(solid.getAttribute('style').replace(/\s/g, '')).toContain('width:66.6');
    // surplus = (0.18 / 1.5) * 100 = 11.999999999999995 (binary float), ~12%
    const surplusStyle = surplus.getAttribute('style').replace(/\s/g, '');
    expect(surplusStyle).toMatch(/width:(?:12|11\.99)/);
    expect(container.querySelector('.crisis-gauge-cap .sp').textContent).toBe('surplus +0.18');
    expect(container.querySelector('.crisis-gauge-label').textContent).toBe('Situation Load');
    expect(container.querySelector('.crisis-gauge-val').textContent).toBe('1.18');
  });

  test('under 1.0 shows no surplus width', () => {
    const { container } = render(CrisisGauge, { props: { factor: 0.6 } });
    expect(
      container.querySelector('.crisis-gauge .surplus').getAttribute('style').replace(/\s/g, '')
    ).toContain('width:0%');
  });
});
