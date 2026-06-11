import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

const EMPTY_CHAMBER = { total_seats: 0, parties: [] };
const EMPTY_CONGRESS = {
  congress: EMPTY_CHAMBER,
  council: EMPTY_CHAMBER,
};

export const congress = writable(null);
export const congressError = writable(null);

function chamber(raw) {
  return {
    total_seats: raw?.total_seats ?? 0,
    parties: Array.isArray(raw?.parties) ? raw.parties : [],
  };
}

export async function loadCongress(syncedAt) {
  congressError.set(null);
  // Reset to the loading state so a Retry shows the loader, not the empty-state card.
  congress.set(null);
  try {
    const data = await fetchPage('congress', syncedAt);
    if (!data) {
      congress.set(EMPTY_CONGRESS);
      return;
    }
    congress.set({ congress: chamber(data.congress), council: chamber(data.council) });
  } catch (err) {
    congressError.set(err.message);
    congress.set(EMPTY_CONGRESS);
  }
}
