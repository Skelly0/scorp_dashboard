import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const pops = writable(null);
export const popsError = writable(null);

export async function loadPops(syncedAt) {
  try {
    pops.set(await fetchPage('pops', syncedAt));
  } catch (err) {
    popsError.set(err.message);
  }
}
