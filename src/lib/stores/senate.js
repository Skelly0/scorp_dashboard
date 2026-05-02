import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const senate = writable(null);
export const senateError = writable(null);

export async function loadSenate(syncedAt) {
  try {
    senate.set(await fetchPage('senate', syncedAt));
  } catch (err) {
    senateError.set(err.message);
  }
}
