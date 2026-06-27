import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { gois, goisError, loadGois } from './gois.js';
import { congress, congressError, loadCongress } from './congress.js';

describe('loadX clears its error store on entry', () => {
  beforeEach(() => {
    gois.set(null);
    goisError.set(null);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('a retry after a failure clears the stale error', async () => {
    goisError.set('gois.json fetch failed: 500');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ gois: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ));

    await loadGois('2026-06-09T00:00:00Z');

    expect(get(goisError)).toBeNull();
    expect(get(gois)).toEqual({ gois: [] });
  });
});

describe('congress store', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('retry after a failure clears the stale error', async () => {
    congress.set(null);
    congressError.set('congress.json fetch failed: 500');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        congress: { total_seats: 27, parties: [{ name: 'Education Party', seats: 2 }] },
        federations: { total_seats: 27, delegations: [{ name: 'Engineering', seats: 3, parties: [] }] },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ));

    await loadCongress('2026-06-11T00:00:00Z');

    expect(get(congressError)).toBeNull();
    expect(get(congress)).toEqual({
      congress: { total_seats: 27, parties: [{ name: 'Education Party', seats: 2 }] },
      federations: { total_seats: 27, delegations: [{ name: 'Engineering', seats: 3, parties: [] }] },
    });
  });

  test('missing congress.json resolves to the empty sentinel, not an error', async () => {
    congress.set(null);
    congressError.set(null);
    // Vite preview serves the SPA HTML fallback for absent JSON; fetchPage
    // treats text/html as null (CLAUDE.md gotcha 31).
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('<!doctype html><html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    ));

    await loadCongress('2026-06-11T00:00:00Z');

    expect(get(congress)).toEqual({
      congress: { total_seats: 0, parties: [] },
      federations: { total_seats: 0, delegations: [] },
    });
    expect(get(congressError)).toBeNull();
  });
});
