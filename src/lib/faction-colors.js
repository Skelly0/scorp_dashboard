// Cosmetic accent colours for class/GoI/control affordances. The visual
// contract: a 4px left bar on cards, a 4px×14px swatch in tables, and concrete
// map-layer colours. Names match what extractors emit; anything not listed
// falls back to var(--accent).

export const CLASS_COLORS = {
  Bureaucrats: '#ffb000',
  Capitalists: '#ffd84d',
  Engineers: '#5ec3ff',
  Scientists: '#a89cff',
  Security: '#ff5544',
  Proprietors: '#9c8a2e',
  Managerial: '#c44dff',
  Botanists: '#7fc97f',
  'Industrial Workers': '#38d39f',
  'Extraction Workers': '#ff8c42',
  'Service Workers': '#a89567',
};

export const GOI_COLORS = {
  Administration: '#38d39f',
  Corporate: '#ffd84d',
  Corporations: '#ffd84d',
  Unions: '#ff5544',
  Proletariat: '#ff5544',
  'White Collar': '#ffd84d',
  Research: '#5ec3ff',
  Congregations: '#c44dff',
  'Outcast Dissidents': '#ff8c42',
  Security: '#ff5544',
  Founders: '#ffb000',
  Capitalists: '#ffd84d',
  Unionists: '#38d39f',
  Faithful: '#c44dff',
  Technocracy: '#5ec3ff',
};

// Party accent colours pinned to each party's Discord role colour (cosmetic —
// used for the card left-bar, lean-chip swatch, and radar tint). Keyed by the
// party name exactly as it appears in parties.json. Parties with no Discord
// role (e.g. "Independent") fall back to their ideology-derived hue.
export const PARTY_COLORS = {
  'Selenite Rose Front': '#e74c3c',
  'Market Interests Group': '#f1c40f',
  'Developmental League': '#3498db',
  'Lunar Survival League': '#95a5a6',
  'Lunar Solidarity Party': '#e91e63',
  'Novus Chrysalis Collective': '#2ecc71',
};

export const CONTROL_COLORS = {
  Administration: '#38d39f',
  Corporate: '#ffd84d',
  Corporations: '#ffd84d',
  Unions: '#ff5544',
  Research: '#5ec3ff',
  ...GOI_COLORS,
  Unionists: '#ff5544',
  ...CLASS_COLORS,
};

const LEGACY_CONTROL_DEFAULTS = {
  Administration: '#5ec3ff',
  Unionists: '#38d39f',
};

export function classColor(name) {
  return CLASS_COLORS[name] ?? 'var(--accent)';
}

export function goiColor(name) {
  return GOI_COLORS[name] ?? 'var(--accent)';
}

export function partyColor(name) {
  return PARTY_COLORS[name] ?? null;
}

export function resolveControlColor(control, palettes = {}) {
  if (!control) return null;
  const paletteHit = palettes.control?.[control];
  const canonical = CONTROL_COLORS[control];
  if (paletteHit && paletteHit !== LEGACY_CONTROL_DEFAULTS[control]) return paletteHit;
  if (canonical) return canonical;
  if (paletteHit) return paletteHit;

  const g = goiColor(control);
  if (g !== 'var(--accent)') return g;
  const c = classColor(control);
  if (c !== 'var(--accent)') return c;
  return null;
}
