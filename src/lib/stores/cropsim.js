import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

const EMPTY_CROPSIM = {
  metrics: {
    total_supply: null,
    total_demand: null,
    balance: null,
    security_ratio: null,
    per_cap: null,
    variety_index: null,
    production_types: 0,
    demand_classes: 0,
  },
  production: [],
  demand: [],
};

export const cropsim = writable(null);
export const cropsimError = writable(null);

export async function loadCropsim(syncedAt) {
  cropsimError.set(null);
  // Reset to the loading state so a Retry shows the loader, not the empty-state card.
  cropsim.set(null);
  try {
    const data = await fetchPage('cropsim', syncedAt);
    if (!data) {
      cropsim.set(EMPTY_CROPSIM);
      return;
    }
    cropsim.set({
      metrics: { ...EMPTY_CROPSIM.metrics, ...(data.metrics ?? {}) },
      production: Array.isArray(data.production) ? data.production : [],
      demand: Array.isArray(data.demand) ? data.demand : [],
    });
  } catch (err) {
    cropsimError.set(err.message);
    cropsim.set(EMPTY_CROPSIM);
  }
}
