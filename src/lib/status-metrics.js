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

export function projectedGrowthRateFromStatus(status) {
  const demographics = status?.demographics;
  const population = Number(status?.population_total);
  if (!demographics || !Number.isFinite(population) || population <= 0) return null;

  const births = Number(demographics.total_births);
  const deaths = Number(demographics.total_deaths);
  if (!Number.isFinite(births) || !Number.isFinite(deaths)) return null;

  return ((births - deaths) / population) * 100;
}

export function formatStatusPercent(value) {
  if (value == null) return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${Math.round(number * 100)}%`;
}

export function statusMetricTone(value, options = {}) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  if (number < LOW_TONE_CUTOFF) return options.lowerIsBetter ? 'good' : 'crit';
  if (number < HIGH_TONE_CUTOFF) return 'warn';
  return options.lowerIsBetter ? 'crit' : 'good';
}
