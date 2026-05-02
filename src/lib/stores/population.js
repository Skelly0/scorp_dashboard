import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const population = writable(null);
export const populationError = writable(null);

export async function loadPopulation(syncedAt) {
  try {
    population.set(await fetchPage('population', syncedAt));
  } catch (err) {
    populationError.set(err.message);
  }
}
