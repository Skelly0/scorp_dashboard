// Maps improvement names → { slug, icon, label }.
// Catalog is the source of truth (when loaded); the keyword regex below is the
// fallback for names not present in the catalog. See gotcha 18 in CLAUDE.md.

import { resolveImprovementRow } from './stores/catalog.js';

export const CATEGORIES = {
  energy:   { slug: 'energy',   icon: '☀', label: 'Energy' },
  mining:   { slug: 'mining',   icon: '⛏', label: 'Mining' },
  habitat:  { slug: 'habitat',  icon: '⌂', label: 'Habitat' },
  civic:    { slug: 'civic',    icon: '⌧', label: 'Civic' },
  military: { slug: 'military', icon: '⚐', label: 'Military' },
  agri:     { slug: 'agri',     icon: '⚘', label: 'Agriculture' },
  science:  { slug: 'science',  icon: '⚗', label: 'Science' },
  other:    { slug: 'other',    icon: '⌬', label: 'Other' },
};

const REGEX_RULES = [
  [/solar|reactor/, 'energy'],
  [/extract|mining|station/, 'mining'],
  [/dome|habitat|hab module/, 'habitat'],
  [/center|school|district|civic/, 'civic'],
  [/outpost|barracks|garrison/, 'military'],
  [/hydroponic|vat|farm|agri/, 'agri'],
  [/lab|research/, 'science'],
];

function regexCategorySlug(name) {
  const n = (name || '').toLowerCase();
  for (const [re, slug] of REGEX_RULES) {
    if (re.test(n)) return slug;
  }
  return 'other';
}

export function getCategorySlug(name, catalog) {
  if (!name) return 'other';
  const row = resolveImprovementRow(name, catalog);
  if (row && row.category) return row.category;
  return regexCategorySlug(name);
}

export function categoryFor(improvement, catalog) {
  if (!improvement) return null;
  const slug = improvement.category ?? getCategorySlug(improvement.name, catalog);
  return CATEGORIES[slug] ?? CATEGORIES.other;
}

// Legacy alias kept temporarily so a stale import surfaces a clear error
// rather than a silent miscategorization.
export function categorySlugFor() {
  throw new Error('categorySlugFor is removed; use getCategorySlug(name, catalog).');
}
