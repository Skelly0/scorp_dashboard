import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchMeta, fetchPage } from './data.js';

describe('data fetcher', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchMeta hits meta.json with a random cache-bust', async () => {
    const calls = [];
    global.fetch = vi.fn(async (url) => {
      calls.push(url);
      return new Response(
        JSON.stringify({ synced_at: '2026-05-01T14:07:00Z', schema_version: 1, senate_visible: false, partial_failures: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const meta = await fetchMeta();
    expect(meta.synced_at).toBe('2026-05-01T14:07:00Z');
    expect(calls[0]).toMatch(/data\/meta\.json\?v=/);
  });

  it('fetchPage uses meta.synced_at as cache-bust', async () => {
    const calls = [];
    global.fetch = vi.fn(async (url) => {
      calls.push(url);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const data = await fetchPage('status', '2026-05-01T14:07:00Z');
    expect(data).toEqual({ ok: true });
    expect(calls[0]).toBe('./data/status.json?v=2026-05-01T14%3A07%3A00Z');
  });

  it('fetchPage returns null on 404', async () => {
    global.fetch = vi.fn(async () => new Response('', { status: 404 }));
    const data = await fetchPage('senate', 'x');
    expect(data).toBeNull();
  });

  it('fetchPage throws on non-404 errors', async () => {
    global.fetch = vi.fn(async () => new Response('boom', { status: 500 }));
    await expect(fetchPage('status', 'x')).rejects.toThrow();
  });
});
