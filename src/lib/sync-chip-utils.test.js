import { describe, it, expect } from 'vitest';
import { isStale, formatSyncedAt } from './sync-chip-utils.js';

describe('sync chip utils', () => {
  it('isStale returns false for recent timestamps', () => {
    const now = new Date('2026-05-01T14:00:00Z');
    expect(isStale('2026-05-01T13:30:00Z', now)).toBe(false);
  });

  it('isStale returns true for timestamps older than 3 hours', () => {
    const now = new Date('2026-05-01T14:00:00Z');
    expect(isStale('2026-05-01T10:30:00Z', now)).toBe(true);
  });

  it('isStale returns true when synced_at is null', () => {
    expect(isStale(null, new Date())).toBe(true);
  });

  it('formatSyncedAt returns HH:MM UTC', () => {
    expect(formatSyncedAt('2026-05-01T14:07:00Z')).toBe('14:07 UTC');
  });

  it('formatSyncedAt returns "—" when null', () => {
    expect(formatSyncedAt(null)).toBe('—');
  });
});
