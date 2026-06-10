import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const parties = writable(null);
export const partiesError = writable(null);

export async function loadParties(syncedAt) {
  partiesError.set(null);
  try {
    parties.set(await fetchPage('parties', syncedAt));
  } catch (err) {
    partiesError.set(err.message);
  }
}
