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
