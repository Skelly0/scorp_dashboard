import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const gois = writable(null);
export const goisError = writable(null);

export async function loadGois(syncedAt) {
  try {
    gois.set(await fetchPage('gois', syncedAt));
  } catch (err) {
    goisError.set(err.message);
  }
}
