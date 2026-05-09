const LOW_TONE_CUTOFF = 0.33;
const HIGH_TONE_CUTOFF = 0.66;

export function populationDeltaFromStatus(status) {
  const demographics = status?.demographics;
  if (!demographics) return null;

  const births = demographics.total_births;
  const deaths = demographics.total_deaths;
  if (births != null && deaths != null) {
    return Math.round(births - deaths);
  }

  return null;
}

export function formatStatusPercent(value) {
  if (value == null) return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${Math.round(number * 100)}%`;
}

export function statusMetricTone(value) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  if (number < LOW_TONE_CUTOFF) return 'crit';
  if (number < HIGH_TONE_CUTOFF) return 'warn';
  return 'good';
}
