import { afterEach, describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import { situations } from '../stores/situations.js';
import CrisisBanner from './CrisisBanner.svelte';

afterEach(() => situations.set(null));

describe('CrisisBanner', () => {
  test('renders nothing when situation load is under 1.0', () => {
    situations.set({ active: [{ crisis_factor: 0.5 }] });
    const { container } = render(CrisisBanner);
    expect(container.querySelector('.crisis-banner')).toBe(null);
  });

  test('renders an announced banner with the load when breached', () => {
    situations.set({ active: [{ crisis_factor: 0.8 }, { crisis_factor: 0.4 }] });
    const { container, getByText } = render(CrisisBanner);
    const banner = container.querySelector('.crisis-banner');
    expect(banner).not.toBe(null);
    expect(banner.getAttribute('role')).toBe('status');
    expect(getByText('Crisis Threshold Breached')).toBeTruthy();
    expect(container.querySelector('.hsub').textContent).toContain('1.20');
  });
});
