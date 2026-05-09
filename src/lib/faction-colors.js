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
  Founders: '#ffb000',
  Capitalists: '#ffd84d',
  Security: '#ff5544',
  Unionists: '#38d39f',
  Faithful: '#c44dff',
  Technocracy: '#5ec3ff',
};

export const CONTROL_COLORS = {
  Administration: '#5ec3ff',
  Corporations: '#ffd84d',
  ...GOI_COLORS,
  ...CLASS_COLORS,
};

export function classColor(name) {
  return CLASS_COLORS[name] ?? 'var(--accent)';
}

export function goiColor(name) {
  return GOI_COLORS[name] ?? 'var(--accent)';
}
