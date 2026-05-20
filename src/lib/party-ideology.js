// Derives a cosmetic accent colour from a party's worldview stance. The hue is
// the direction the stance "pulls" on the same 6-axis layout the RadarChart
// draws (each axis at 60°, high value = outward), so a party's colour matches
// the lean its radar shape shows. Saturation tracks how far from centre the
// party sits; a perfectly centrist stance desaturates to neutral. The dominant
// axis also yields a short human-readable lean label so the colour is never the
// only signal (accessibility) and always has a key.

import { WORLDVIEW_AXES, AXIS_HIGH_LABELS } from './worldview.js';

// Opposite poles of AXIS_HIGH_LABELS. Backend convention: high value = high
// pole, so a below-centre value leans toward these.
export const AXIS_LOW_LABELS = {
  expansion: 'Expansion',
  authority: 'Authority',
  corporate: 'Corporate',
  technocratic: 'Technocratic',
  faith: 'Faith',
  materialist: 'Materialist',
};

const CENTER = 4; // midpoint of the 1..7 stance scale
const MAG_REF = 4; // pull magnitude that maps to full saturation
const CENTRIST_EPS = 0.6; // below this net pull there is no clear lean

const NEUTRAL = { color: 'var(--muted)', leanLabel: 'Centrist', leanAxis: null, strength: 0 };

export function partyIdeology(stance) {
  if (!stance) return { ...NEUTRAL, leanLabel: '—' };

  const n = WORLDVIEW_AXES.length;
  let vx = 0;
  let vy = 0;
  let domAxis = null;
  let domDev = 0;

  WORLDVIEW_AXES.forEach((axis, i) => {
    const raw = stance[axis];
    if (raw == null || Number.isNaN(raw)) return;
    const dev = raw - CENTER;
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    vx += dev * Math.cos(angle);
    vy += dev * Math.sin(angle);
    if (Math.abs(dev) > Math.abs(domDev)) {
      domDev = dev;
      domAxis = axis;
    }
  });

  const magnitude = Math.hypot(vx, vy);
  if (magnitude < CENTRIST_EPS || domAxis == null) return { ...NEUTRAL };

  let hue = (Math.atan2(vy, vx) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  const strength = Math.min(1, magnitude / MAG_REF);
  const sat = Math.round(45 + strength * 35); // 45%..80%
  const color = `hsl(${Math.round(hue)} ${sat}% 52%)`;
  const leanLabel = domDev >= 0 ? AXIS_HIGH_LABELS[domAxis] : AXIS_LOW_LABELS[domAxis];

  return { color, leanLabel, leanAxis: domAxis, strength };
}
