export const METRIC_LABELS = {
  food: 'Food',
  water: 'Water',
  energy: 'Energy',
  materials: 'Materials',
  ore: 'Ore',
  housing: 'Housing',
  money: 'Money',
  helium3: 'Helium-3',
  stability: 'Stability',
  satisfaction_all: 'Satisfaction',
  research: 'Research',
  engineering: 'Eng',
};

export const YIELD_ORDER = ['food', 'water', 'energy', 'materials', 'ore', 'housing', 'money', 'helium3', 'stability', 'satisfaction_all', 'research'];
export const UPKEEP_ORDER = ['energy', 'materials', 'money', 'ore', 'water', 'helium3', 'food', 'housing'];

export function labelForMetricKey(key) {
  return METRIC_LABELS[key] ?? String(key).replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function optionsFromMetricKeys(keys, preferredOrder) {
  const present = new Set(keys.filter(Boolean));
  const ordered = [
    ...preferredOrder.filter((key) => present.has(key)),
    ...[...present].filter((key) => !preferredOrder.includes(key)).sort(),
  ];
  return ordered.map((key) => ({ key, label: labelForMetricKey(key) }));
}
