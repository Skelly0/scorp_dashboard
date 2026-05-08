// Pure helpers for the Map page's zoom multiplier.
// State lives in Map.svelte; this module is just maths + storage.

export const ZOOM_MIN = 0.75;
export const ZOOM_MAX = 2.0;
export const ZOOM_DEFAULT = 1.0;
export const ZOOM_STEP = 0.25;
export const ZOOM_STORAGE_KEY = 'scorp.map.zoom';

export function clampZoom(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return ZOOM_DEFAULT;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));
}

function snapToStep(v) {
  // Snap onto the ZOOM_MIN + k*ZOOM_STEP grid so off-grid drift never accumulates.
  const k = Math.round((v - ZOOM_MIN) / ZOOM_STEP);
  return ZOOM_MIN + k * ZOOM_STEP;
}

export function stepZoom(current, delta) {
  const snapped = snapToStep(clampZoom(current));
  return clampZoom(snapped + delta * ZOOM_STEP);
}

export function resetZoom() {
  return ZOOM_DEFAULT;
}

export function readZoom() {
  try {
    const raw = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (raw == null) return ZOOM_DEFAULT;
    const v = Number.parseFloat(raw);
    return clampZoom(v);
  } catch {
    return ZOOM_DEFAULT;
  }
}

export function writeZoom(v) {
  try {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(clampZoom(v)));
  } catch {
    /* localStorage unavailable — silently degrade */
  }
}
