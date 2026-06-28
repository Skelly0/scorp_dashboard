// Theme-independent ink colour for text/labels sitting on a concrete fill (party
// swatches, matrix cells, vote-bar segments). Picks near-black or near-cream by
// the fill's WCAG relative luminance so the pairing stays legible in every theme.
// Returns null when the fill isn't a 6-digit hex (e.g. a `var(--…)` token) so the
// caller can fall back to a neutral cell instead.

export function relativeLuminance(color) {
  const m = /^#?([0-9a-f]{6})$/i.exec(color || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastInk(color, { dark = '#10141b', light = '#f6f3ec' } = {}) {
  const L = relativeLuminance(color);
  if (L == null) return null;
  return L > 0.4 ? dark : light;
}

export function isHexColor(color) {
  return /^#?[0-9a-f]{6}$/i.test(color || '');
}
