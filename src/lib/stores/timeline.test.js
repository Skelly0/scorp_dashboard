import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// The store module reaches the network through data.js at load-time helpers;
// stub every fetcher so loadTimeline() never touches fetch in jsdom.
vi.mock('../data.js', () => ({
  fetchPage: vi.fn(async () => null),
  fetchHistoryIndex: vi.fn(async () => null),
  fetchHistoryYear: vi.fn(async () => null),
}));

// selectedYearIdx initialises at module scope, so each test needs a fresh
// import AFTER localStorage is seeded.
async function freshTimeline() {
  vi.resetModules();
  const mod = await import('./timeline.js');
  mod.status.set({ year: 2076 });
  mod.history.set({ years: [2074, 2075], snapshots: [{ year: 2074 }, { year: 2075 }] });
  return mod;
}

describe('timeline year cursor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('ignores a legacy persisted yearIdx and opens on the live year', async () => {
    localStorage.setItem('scorp.command', JSON.stringify({ yearIdx: 0, view: 'telemetry' }));
    const mod = await freshTimeline();
    expect(get(mod.effectiveIdx)).toBe(2);
    expect(get(mod.isLiveYear)).toBe(true);
  });

  it('selectYear pins a frame for the session without writing yearIdx to localStorage', async () => {
    const mod = await freshTimeline();
    mod.selectYear(0);
    expect(get(mod.effectiveIdx)).toBe(0);
    const stored = JSON.parse(localStorage.getItem('scorp.command') || '{}');
    expect('yearIdx' in stored).toBe(false);
  });

  it('loadTimeline resets the cursor so every Command visit opens on the live year', async () => {
    const mod = await freshTimeline();
    mod.selectYear(1);
    expect(get(mod.effectiveIdx)).toBe(1);
    mod.loadTimeline('2026-07-14T00:00:00Z');
    expect(get(mod.effectiveIdx)).toBe(2);
    expect(get(mod.isLiveYear)).toBe(true);
  });

  it('persistCommand still retains view and scanline preferences', async () => {
    const mod = await freshTimeline();
    mod.persistCommand({ view: 'telemetry' });
    mod.persistCommand({ scanlines: false });
    expect(JSON.parse(localStorage.getItem('scorp.command'))).toEqual({
      view: 'telemetry',
      scanlines: false,
    });
  });
});
