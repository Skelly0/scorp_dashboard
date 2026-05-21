import { afterEach, describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import { status } from '../stores/status.js';
import CrisisFrame from './CrisisFrame.svelte';

afterEach(() => status.set(null));

describe('CrisisFrame', () => {
  test('renders nothing when not breached', () => {
    status.set({ crisis_factor: 0.9 });
    const { container } = render(CrisisFrame);
    expect(container.querySelector('.crisis-frame')).toBe(null);
  });

  test('renders four edges and an intensity custom property when breached', () => {
    status.set({ crisis_factor: 1.42 });
    const { container } = render(CrisisFrame);
    const frame = container.querySelector('.crisis-frame');
    expect(frame).not.toBe(null);
    expect(frame.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('.crisis-edge').length).toBe(4);
    expect(frame.getAttribute('style')).toContain('--crisis-intensity:');
  });
});
