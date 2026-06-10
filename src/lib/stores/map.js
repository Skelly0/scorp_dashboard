import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const map = writable(null);
export const mapError = writable(null);

export async function loadMap(syncedAt) {
  mapError.set(null);
  try {
    map.set(await fetchPage('map', syncedAt));
  } catch (err) {
    mapError.set(err.message);
  }
}
