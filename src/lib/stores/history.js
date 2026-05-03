import { writable, derived } from 'svelte/store';
import { fetchHistoryIndex, fetchHistoryYear } from '../data.js';

export const history = writable(null);
export const historyError = writable(null);

const MAX_YEARS = 12;

export async function loadHistory(syncedAt) {
  try {
    const index = await fetchHistoryIndex(syncedAt);
    if (!index || !Array.isArray(index.years) || index.years.length === 0) {
      history.set({ years: [], snapshots: [] });
      return;
    }
    const recent = [...index.years].sort((a, b) => a - b).slice(-MAX_YEARS);
    const snapshots = await Promise.all(recent.map((y) => fetchHistoryYear(y, syncedAt)));
    history.set({
      years: recent,
      snapshots: snapshots.filter((s) => s != null),
    });
  } catch (err) {
    historyError.set(err.message);
  }
}

export const treasuryHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.treasury?.money).filter((v) => v != null) : []
);

export const stabilityHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.stability).filter((v) => v != null) : []
);

export const crisisFactorHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.crisis_factor).filter((v) => v != null) : []
);

export const populationHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.population_total).filter((v) => v != null) : []
);
