// Single source of truth for the per-tile letter codes used on the Map page.
// Imported by MapCanvas.svelte (chip rendering), Map.svelte (active-filters strip),
// and RosterPanel.svelte (roster swatches). Keep this file authoritative — never
// redefine these maps inline.

export const RESOURCE_CODES = {
  'Helium-3': 'He',
  'Iron Deposit': 'Fe',
  'Aluminum Deposit': 'Al',
  'Phosphorus Deposit': 'P',
  'Rare Earths': 'RE',
  'Heavy Metals': 'HM',
  'Oxygen Bound Soil': 'O₂',
  'Water Ice': 'W',
};

export const FEATURE_CODES = {
  'Buried Ice': 'BI',
  'Mineral Vein': 'MV',
  'Smooth Plain': 'SP',
  'Boulder Field': 'BF',
  'Cave System': 'CS',
  'Recent Meteorite Strikes': 'MS',
  'Magnetic Anomaly': 'MA',
  'Hollow Rocks': 'HR',
  'Crashed Probe': 'CP',
};
