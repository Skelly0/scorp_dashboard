// Maps improvement names → { slug, icon, label } via keyword rules.
// Backend may later add `improvement.category` directly; if present, prefer that.

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

const RULES = [
  [/solar|reactor/, 'energy'],
  [/extract|mining|station/, 'mining'],
  [/dome|habitat|hab module/, 'habitat'],
  [/center|school|district|civic/, 'civic'],
  [/outpost|barracks|garrison/, 'military'],
  [/hydroponic|vat|farm|agri/, 'agri'],
  [/lab|research/, 'science'],
];

export function categorySlugFor(name) {
  const n = (name || '').toLowerCase();
  for (const [re, slug] of RULES) {
    if (re.test(n)) return slug;
  }
  return 'other';
}

export function categoryFor(improvement) {
  if (!improvement) return null;
  // Prefer backend-supplied category when present.
  const slug = improvement.category ?? categorySlugFor(improvement.name);
  return CATEGORIES[slug] ?? CATEGORIES.other;
}
