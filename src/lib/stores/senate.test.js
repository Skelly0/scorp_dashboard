import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

const fetchPage = vi.fn();

vi.mock('../data.js', () => ({ fetchPage }));

const { senate, senateError, loadSenate } = await import('./senate.js');

describe('senate store', () => {
  beforeEach(() => {
    fetchPage.mockReset();
    senate.set(null);
    senateError.set(null);
  });

  it('treats missing optional senate data as an empty published state', async () => {
    fetchPage.mockResolvedValueOnce(null);

    await loadSenate('2026-05-09T12:00:00Z');

    expect(get(senateError)).toBeNull();
    expect(get(senate)).toEqual({
      coalitions: [],
      goi_capture_matrix: { parties: [], gois: [], values: [] },
      seats_by_party: [],
      placeholder_note: 'Senate page is not published for this sync.',
    });
  });
});
