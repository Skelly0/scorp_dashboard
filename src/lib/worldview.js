export const WORLDVIEW_AXES = [
  'expansion',
  'authority',
  'corporate',
  'technocratic',
  'faith',
  'materialist',
];

// Backend convention: high value = right-pole. Radar spokes radiate outward
// to the high value, so spoke labels reflect the high pole.
// See scorp_colony/src/scorp_colony/political/coalitions.py — IF >5 → "Populist".
export const AXIS_HIGH_LABELS = {
  expansion: 'Conservation',
  authority: 'Democratic',
  corporate: 'Communal',
  technocratic: 'Populist',
  faith: 'Reason',
  materialist: 'Idealist',
};
