// Small formatting/tone helpers shared by the Command and Telemetry views.
// Re-exports the canonical formatters so the views have one import, and adds the
// few mock-specific helpers (tone→colour, delta arrow/tone) ported faithfully
// from the Colony Command design source.
import { fmtInt, fmtSignedInt, fmtSigned, fmtPct } from './format.js';
import { statusMetricTone, formatStatusPercent } from './status-metrics.js';

export { fmtInt, fmtSignedInt, fmtSigned, fmtPct, statusMetricTone, formatStatusPercent };

export function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

// Resolve a tone keyword to its theme CSS variable. Canvas/inline use only —
// every theme defines all four tokens. Unknown/empty → the base foreground.
export function toneColor(tone) {
  switch (tone) {
    case 'crit':
      return 'var(--crit)';
    case 'warn':
      return 'var(--warn)';
    case 'good':
      return 'var(--good)';
    case 'muted':
      return 'var(--muted)';
    default:
      return 'var(--fg)';
  }
}

export function arrowFor(raw) {
  return raw > 0 ? '▲' : raw < 0 ? '▼' : '·';
}

// Direction-of-good tone for a raw delta. lowerIsBetter flips polarity (e.g.
// Crisis Pressure). Exactly zero is neutral/muted. Mirrors the mock's goodBad().
export function deltaTone(raw, lowerIsBetter = false) {
  if (raw === 0) return 'muted';
  if (lowerIsBetter) return raw > 0 ? 'crit' : 'good';
  return raw > 0 ? 'good' : 'crit';
}
