import { writable } from 'svelte/store';
import { fetchPage } from '../data.js';

export const catalog = writable(null); // { improvements, byName, placedNameLookup } | null
export const catalogError = writable(null);

export async function loadCatalog(syncedAt) {
  try {
    const data = await fetchPage('catalog', syncedAt);
    if (!data || !Array.isArray(data.improvements) || data.improvements.length === 0) {
      catalog.set(null);
      return;
    }
    catalog.set(buildIndex(data.improvements));
  } catch (err) {
    catalogError.set(err.message);
    catalog.set(null);
  }
}

export function normalizeName(s) {
  return (s ?? '').toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

function buildIndex(items) {
  const byName = new Map();
  for (const it of items) {
    byName.set(normalizeName(it.name), it);
  }
  // placedNameLookup: memo cache for resolveImprovementRow; populated lazily.
  // Keyed by raw improvement-name strings (whatever lives on tiles).
  const placedNameLookup = new Map();
  return { improvements: items, byName, placedNameLookup };
}

/** Resolve a placed-improvement name to its catalog row, or null. Cached. */
export function resolveImprovementRow(name, cat) {
  if (!cat || !name) return null;
  const cached = cat.placedNameLookup.get(name);
  if (cached !== undefined) return cached;
  const n = normalizeName(name);
  const exact = cat.byName.get(n);
  if (exact) {
    cat.placedNameLookup.set(name, exact);
    return exact;
  }
  const fuzzy = fuzzyFind(n, cat);
  cat.placedNameLookup.set(name, fuzzy ?? null);
  return fuzzy ?? null;
}

function fuzzyFind(n, cat) {
  if (n.length < 4) return null;
  let best = null, bestLen = 0;
  for (const [k, row] of cat.byName) {
    if (k.length < 4) continue;
    const sharedLen = sharedPrefixLength(k, n);
    if (sharedLen < 4) continue;
    const longer = Math.max(k.length, n.length);
    const fullPrefix = k.startsWith(n) || n.startsWith(k);
    if (!fullPrefix && sharedLen / longer < 0.75) continue;
    if (sharedLen > bestLen) {
      best = row; bestLen = sharedLen;
    } else if (sharedLen === bestLen && best && stem(k) === stem(n)) {
      best = row;
    }
  }
  return best;
}

function sharedPrefixLength(a, b) {
  const m = Math.min(a.length, b.length);
  let i = 0;
  while (i < m && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

function stem(s) {
  return s.replace(/\s+(field|mark\s+[ivx]+|mk\s*[ivx0-9]+|complex|station|outpost)$/i, '').trim();
}
