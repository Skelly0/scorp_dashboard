import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const demographics = writable(null);
export const demographicsError = writable(null);

export async function loadDemographics(syncedAt) {
  demographicsError.set(null);
  try {
    const data = await fetchPage('demographics', syncedAt);
    demographics.set(data);
  } catch (err) {
    demographicsError.set(err.message);
  }
}
