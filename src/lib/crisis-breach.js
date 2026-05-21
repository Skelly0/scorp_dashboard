// Pure colony-wide Crisis breach math. No Svelte, no DOM — unit-testable in isolation.
// Breach is STRICT: crisis_factor must be > 1.0 ("over 1"). Exactly 1.0 is at capacity, not breached.

export const CRISIS_GAUGE_MAX = 1.5; // gauge axis: 0 .. 1.5, so the 1.0 tick sits at 66.667%
export const CRISIS_INTENSITY_FLOOR = 0.35; // intensity at the moment of breach
export const CRISIS_INTENSITY_RAMP = 1.3;   // how fast intensity grows per unit of surplus

function toFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function computeCrisisBreach(factor) {
  const cf = toFinite(factor);
  const breached = cf != null && cf > 1.0;
  const surplus = breached ? cf - 1.0 : 0;
  const intensity = breached
    ? Math.min(1, Math.max(0, CRISIS_INTENSITY_FLOOR + surplus * CRISIS_INTENSITY_RAMP))
    : 0;
  return { factor: cf, breached, surplus, intensity };
}

export function sumSituationLoad(activeSituations) {
  if (!Array.isArray(activeSituations)) return null;
  return activeSituations.reduce((acc, s) => acc + (Number(s?.crisis_factor) || 0), 0);
}

export function crisisGaugeGeometry(factor) {
  const cf = toFinite(factor) ?? 0;
  const max = CRISIS_GAUGE_MAX;
  const solidPct = (Math.max(0, Math.min(cf, 1)) / max) * 100;
  const tickPct = (1 / max) * 100;
  const surplus = Math.max(0, cf - 1);
  const surplusPct = (surplus / max) * 100;
  return { solidPct, tickPct, surplusPct, surplus };
}
