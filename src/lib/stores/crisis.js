import { derived } from 'svelte/store';
import { status } from './status.js';
import { computeCrisisBreach } from '../crisis-breach.js';

// Colony-wide breach state, available app-wide. Derived from the shared `status` store,
// which App.svelte loads once globally so every route sees it.
export const crisisBreach = derived(status, ($status) =>
  computeCrisisBreach($status?.crisis_factor ?? null),
);
