import { describe, expect, test, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { meta } from '../stores/meta.js';
import SyncChip from './SyncChip.svelte';

describe('SyncChip', () => {
  beforeEach(() => {
    meta.set(null);
  });

  test('partial failures render the warn state with ⚠ and failed pages in title', () => {
    meta.set({ synced_at: new Date().toISOString(), partial_failures: ['gois', 'tech'] });
    const { container } = render(SyncChip);
    const chip = container.querySelector('span.border-warn');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('⚠');
    expect(chip.getAttribute('title')).toBe('Partial sync — failed: gois, tech');
    expect(chip.textContent).toContain('Partial sync failure');
  });

  test('stale beats partial', () => {
    meta.set({ synced_at: '2020-01-01T00:00:00Z', partial_failures: ['gois'] });
    const { container } = render(SyncChip);
    expect(container.querySelector('span.border-crit')).toBeTruthy();
    expect(container.querySelector('span.border-warn')).toBeNull();
  });

  test('clean sync renders the normal state', () => {
    meta.set({ synced_at: new Date().toISOString(), partial_failures: [] });
    const { container } = render(SyncChip);
    expect(container.querySelector('span.border-border')).toBeTruthy();
    expect(container.textContent).not.toContain('⚠');
  });

  test('meta without partial_failures key renders the normal state', () => {
    meta.set({ synced_at: new Date().toISOString() });
    const { container } = render(SyncChip);
    expect(container.querySelector('span.border-border')).toBeTruthy();
    expect(container.querySelector('span.border-warn')).toBeNull();
    expect(container.textContent).not.toContain('⚠');
  });
});
