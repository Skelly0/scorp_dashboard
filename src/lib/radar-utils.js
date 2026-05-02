export function polarPoints(values, { cx, cy, radius, scaleMin = 1, scaleMax = 7 }) {
  const n = values.length;
  return values.map((v, i) => {
    const raw = v == null ? (scaleMin + scaleMax) / 2 : v;
    const clamped = Math.min(scaleMax, Math.max(scaleMin, raw));
    const norm = (clamped - scaleMin) / (scaleMax - scaleMin);
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * radius * norm,
      y: cy + Math.sin(angle) * radius * norm,
    };
  });
}
