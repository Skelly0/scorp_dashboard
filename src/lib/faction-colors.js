// Cosmetic accent colours for class/GoI cards. The visual contract: a 4px
// left bar on cards, a 4px×14px swatch in tables. Names match what extractors
// emit; anything not listed falls back to var(--accent).

export const CLASS_COLORS = {
  Bureaucrats: '#ffb000',
  Capitalists: '#ffd84d',
  Engineers: '#5ec3ff',
  Scientists: '#a89cff',
  Security: '#ff5544',
  Proprietors: '#e89020',
  Managerial: '#c44dff',
  'Agricultural Workers': '#7fc97f',
  'Industrial Workers': '#38d39f',
  'Service Workers': '#a89567',
  'Skilled Tradesmen': '#ff8c42',
};

export const GOI_COLORS = {
  Founders: '#ffb000',
  Capitalists: '#ffd84d',
  Security: '#ff5544',
  Unionists: '#38d39f',
  Faithful: '#c44dff',
  Technocracy: '#5ec3ff',
};

export function classColor(name) {
  return CLASS_COLORS[name] ?? 'var(--accent)';
}

export function goiColor(name) {
  return GOI_COLORS[name] ?? 'var(--accent)';
}
