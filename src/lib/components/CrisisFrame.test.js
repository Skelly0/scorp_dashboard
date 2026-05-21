import { afterEach, describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import { situations } from '../stores/situations.js';
import CrisisFrame from './CrisisFrame.svelte';

afterEach(() => situations.set(null));

describe('CrisisFrame', () => {
  test('renders nothing when situation load is under 1.0', () => {
    situations.set({ active: [{ crisis_factor: 0.9 }] });
    const { container } = render(CrisisFrame);
    expect(container.querySelector('.crisis-frame')).toBe(null);
  });

  test('renders four edges and an intensity custom property when breached', () => {
    situations.set({ active: [{ crisis_factor: 0.9 }, { crisis_factor: 0.52 }] });
    const { container } = render(CrisisFrame);
    const frame = container.querySelector('.crisis-frame');
    expect(frame).not.toBe(null);
    expect(frame.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('.crisis-edge').length).toBe(4);
    expect(frame.getAttribute('style')).toContain('--crisis-intensity:');
  });
});
