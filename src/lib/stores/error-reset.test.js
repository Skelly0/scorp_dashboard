import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { gois, goisError, loadGois } from './gois.js';

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
