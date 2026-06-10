import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const senate = writable(null);
export const senateError = writable(null);

const emptySenate = () => ({
  coalitions: [],
  goi_capture_matrix: { parties: [], gois: [], values: [] },
  seats_by_party: [],
  placeholder_note: 'Senate page is not published for this sync.',
});

export async function loadSenate(syncedAt) {
  senateError.set(null);
  try {
    const data = await fetchPage('senate', syncedAt);
    senate.set(data ?? emptySenate());
  } catch (err) {
    senateError.set(err.message);
  }
}
