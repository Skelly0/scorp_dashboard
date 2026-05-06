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

export const govApprovalHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.gov_approval).filter((v) => v != null) : []
);

export const deathsHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.total_deaths).filter((v) => v != null) : []
);

export const cdrHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.effective_cdr).filter((v) => v != null) : []
);

export const netDeltaHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.net_delta_pct).filter((v) => v != null) : []
);

export const housingUtilHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.housing_util).filter((v) => v != null) : []
);

export const avgSatHistory = derived(history, ($h) =>
  $h ? $h.snapshots.map((s) => s?.avg_satisfaction).filter((v) => v != null) : []
);

// Year-over-year population delta. data[i] = pop[i] - pop[i-1].
// First entry is dropped (no prior reference).
export const populationDeltaHistory = derived(history, ($h) => {
  if (!$h) return [];
  const pops = $h.snapshots.map((s) => s?.population_total).filter((v) => v != null);
  if (pops.length < 2) return [];
  return pops.slice(1).map((v, i) => v - pops[i]);
});
