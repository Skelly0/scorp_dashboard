import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const status = writable(null);
export const statusError = writable(null);

export async function loadStatus(syncedAt) {
  statusError.set(null);
  try {
    const data = await fetchPage('status', syncedAt);
    status.set(data);
  } catch (err) {
    statusError.set(err.message);
  }
}
