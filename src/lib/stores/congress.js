import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

const EMPTY_CHAMBER = { total_seats: 0, parties: [] };
const EMPTY_FEDERATIONS = { total_seats: 0, delegations: [] };
const EMPTY_CONGRESS = {
  congress: EMPTY_CHAMBER,
  federations: EMPTY_FEDERATIONS,
};

export const congress = writable(null);
export const congressError = writable(null);

function chamber(raw) {
  return {
    total_seats: raw?.total_seats ?? 0,
    parties: Array.isArray(raw?.parties) ? raw.parties : [],
  };
}

function federations(raw) {
  return {
    total_seats: raw?.total_seats ?? 0,
    delegations: Array.isArray(raw?.delegations) ? raw.delegations : [],
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
    congress.set({
      congress: chamber(data.congress),
      federations: federations(data.federations),
    });
  } catch (err) {
    congressError.set(err.message);
    congress.set(EMPTY_CONGRESS);
  }
}
