import { writable, derived } from 'svelte/store';
import { fetchPage } from '../data.js';

// $tech is null until loaded; once loaded, always
// { techs, branches, research_points } even when arrays are empty. The page
// treats empty as the documented "TechTable not named yet" state.
export const tech = writable(null);
export const techError = writable(null);

const EMPTY_RESEARCH_POINTS = { accrued: null };

function normalizeResearchPoints(value) {
  if (!value || typeof value !== 'object') return { ...EMPTY_RESEARCH_POINTS };
  return {
    accrued: Number.isFinite(value.accrued) ? value.accrued : null,
  };
}

export async function loadTech(syncedAt) {
  techError.set(null);
  // Reset to the loading state so a Retry shows the loader, not the empty-state card.
  tech.set(null);
  try {
    const data = await fetchPage('tech', syncedAt);
    if (!data) {
      // 404 — sync hasn't written tech.json. Treat as empty.
      tech.set({ techs: [], branches: [], research_points: { ...EMPTY_RESEARCH_POINTS } });
      return;
    }
    tech.set({
      techs: Array.isArray(data.techs) ? data.techs : [],
      branches: Array.isArray(data.branches) ? data.branches : [],
      research_points: normalizeResearchPoints(data.research_points),
    });
  } catch (err) {
    techError.set(err.message);
    tech.set({ techs: [], branches: [], research_points: { ...EMPTY_RESEARCH_POINTS } });
  }
}

// Group techs by branch for column rendering. Branch order follows
// `branches` from the JSON; techs within a branch are tier-then-name sorted.
// The extractor canonicalises `branches` to cover every encountered branch
// (`scripts/extractors/tech.py:_order_branches`), so techs whose branch is
// missing from `$tech.branches` represent an extractor/store contract drift —
// silently dropped here rather than appearing in the grid but not in the
// progress strip.
export const techByBranch = derived(tech, ($tech) => {
  if (!$tech) return new Map();
  const out = new Map();
  for (const b of $tech.branches) out.set(b, []);
  for (const t of $tech.techs) {
    const list = out.get(t.branch);
    if (list) list.push(t);
  }
  for (const list of out.values()) {
    list.sort((a, b) =>
      (a.tier ?? 99) - (b.tier ?? 99) || a.name.localeCompare(b.name)
    );
  }
  return out;
});

// Derive the visual state per tech: 'researched' > 'available' > 'locked'.
export function techState(t) {
  if (t.researched) return 'researched';
  if (t.available) return 'available';
  return 'locked';
}
