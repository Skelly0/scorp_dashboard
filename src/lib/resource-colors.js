// Cosmetic accent colours for per-resource bars/swatches on the Command page.
// Mirrors the palette baked into the "Colony Command" design mock. Purely
// visual — an unknown resource falls back to var(--accent) in the consumer.
//
// Money and Housing are deliberately excluded from RESOURCE_ORDER: their
// magnitudes (hundreds of thousands) would dominate the shared bar scale and
// squash every other resource to a sliver. They surface elsewhere — Money as
// the Treasury vital, Housing in the population drill-down.
export const RESOURCE_ORDER = ['Food', 'Materials', 'Ore', 'Energy', 'Helium-3', 'Water'];

export const RESOURCE_COLORS = {
  Food: '#6fae5f',
  Materials: '#b08d57',
  Ore: '#b3623d',
  Energy: '#e0a008',
  'Helium-3': '#9a8cf0',
  Water: '#4ba3d6',
};

export function resourceColor(name) {
  return RESOURCE_COLORS[name] ?? 'var(--accent)';
}
