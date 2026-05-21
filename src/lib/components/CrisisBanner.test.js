import { afterEach, describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import { status } from '../stores/status.js';
import CrisisBanner from './CrisisBanner.svelte';

afterEach(() => status.set(null));

describe('CrisisBanner', () => {
  test('renders nothing when not breached', () => {
    status.set({ crisis_factor: 0.84 });
    const { container } = render(CrisisBanner);
    expect(container.querySelector('.crisis-banner')).toBe(null);
  });

  test('renders an announced banner with load when breached', () => {
    status.set({ crisis_factor: 1.18 });
    const { container, getByText } = render(CrisisBanner);
    const banner = container.querySelector('.crisis-banner');
    expect(banner).not.toBe(null);
    expect(banner.getAttribute('role')).toBe('status');
    expect(getByText('Crisis Threshold Breached')).toBeTruthy();
    expect(container.querySelector('.hsub').textContent).toContain('1.18');
  });
});
