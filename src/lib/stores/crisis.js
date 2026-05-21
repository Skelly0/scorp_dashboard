import { derived } from 'svelte/store';
import { situations } from './situations.js';
import { computeCrisisBreach, sumSituationLoad } from '../crisis-breach.js';

// Colony-wide "Situation Load" = sum of active situation crisis contributions.
// This is the number that can exceed 1.0 (capacity) and drive the breach state —
// NOT status.crisis_factor (the "Crisis Pressure" scalar, which is typically < 1).
export const situationLoad = derived(situations, ($situations) =>
  $situations ? sumSituationLoad($situations.active) : null,
);

export const crisisBreach = derived(situationLoad, ($load) => computeCrisisBreach($load));
