import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const situations = writable(null);
export const situationsError = writable(null);

export async function loadSituations(syncedAt) {
  situationsError.set(null);
  try {
    situations.set(await fetchPage('situations', syncedAt));
  } catch (err) {
    situationsError.set(err.message);
  }
}
