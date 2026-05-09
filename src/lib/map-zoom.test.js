import { describe, it, expect, beforeEach } from 'vitest';
import {
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_DEFAULT,
  ZOOM_STEP,
  ZOOM_STORAGE_KEY,
  clampZoom,
  stepZoom,
  scaleZoom,
  pinchMathStep,
  resetZoom,
  readZoom,
  writeZoom,
} from './map-zoom.js';

describe('clampZoom', () => {
  it('clamps below ZOOM_MIN to ZOOM_MIN', () => {
    expect(clampZoom(0.1)).toBeCloseTo(ZOOM_MIN, 10);
  });
  it('clamps above ZOOM_MAX to ZOOM_MAX', () => {
    expect(clampZoom(99)).toBeCloseTo(ZOOM_MAX, 10);
  });
  it('passes through values in range', () => {
    expect(clampZoom(1.0)).toBeCloseTo(1.0, 10);
    expect(clampZoom(1.5)).toBeCloseTo(1.5, 10);
  });
  it('returns ZOOM_DEFAULT for non-finite input', () => {
    expect(clampZoom(NaN)).toBeCloseTo(ZOOM_DEFAULT, 10);
    expect(clampZoom(Infinity)).toBeCloseTo(ZOOM_DEFAULT, 10);
    expect(clampZoom(undefined)).toBeCloseTo(ZOOM_DEFAULT, 10);
  });
});

describe('stepZoom', () => {
  it('increments by ZOOM_STEP and snaps to grid', () => {
    expect(stepZoom(1.0, +1)).toBeCloseTo(1.0 + ZOOM_STEP, 10);
    expect(stepZoom(1.0, -1)).toBeCloseTo(1.0 - ZOOM_STEP, 10);
  });
  it('clamps at the upper bound', () => {
    expect(stepZoom(ZOOM_MAX, +1)).toBeCloseTo(ZOOM_MAX, 10);
  });
  it('clamps at the lower bound', () => {
    expect(stepZoom(ZOOM_MIN, -1)).toBeCloseTo(ZOOM_MIN, 10);
  });
  it('snaps an off-grid current value onto the grid before stepping', () => {
    // 1.13 → snap to nearest grid point (1.25), then add ZOOM_STEP → 1.5.
    expect(stepZoom(1.13, +1)).toBeCloseTo(1.5, 10);
  });
});

describe('scaleZoom', () => {
  it('multiplies the current zoom by a finite ratio without snapping to the step grid', () => {
    expect(scaleZoom(1.25, 1.2)).toBeCloseTo(1.5, 10);
    expect(scaleZoom(1.5, 0.9)).toBeCloseTo(1.35, 10);
  });
  it('clamps scaled values to the zoom bounds', () => {
    expect(scaleZoom(ZOOM_MAX, 2)).toBeCloseTo(ZOOM_MAX, 10);
    expect(scaleZoom(ZOOM_MIN, 0.5)).toBeCloseTo(ZOOM_MIN, 10);
  });
  it('returns the clamped current zoom for invalid ratios', () => {
    expect(scaleZoom(1.25, 0)).toBeCloseTo(1.25, 10);
    expect(scaleZoom(1.25, -1)).toBeCloseTo(1.25, 10);
    expect(scaleZoom(1.25, NaN)).toBeCloseTo(1.25, 10);
    expect(scaleZoom(1.25, Infinity)).toBeCloseTo(1.25, 10);
    expect(scaleZoom(99, 0)).toBeCloseTo(ZOOM_MAX, 10);
  });
});

describe('pinchMathStep', () => {
  it('doubles zoom when pinch distance doubles', () => {
    expect(pinchMathStep(200, 100, 1)).toBeCloseTo(2, 10);
  });
  it('halves zoom when pinch distance halves', () => {
    expect(pinchMathStep(100, 200, 1.5)).toBeCloseTo(0.75, 10);
  });
  it('clamps pinch-scaled zoom to bounds', () => {
    expect(pinchMathStep(300, 100, 1)).toBeCloseTo(ZOOM_MAX, 10);
    expect(pinchMathStep(25, 100, 1)).toBeCloseTo(ZOOM_MIN, 10);
  });
  it('returns the clamped current zoom for zero or invalid distances', () => {
    expect(pinchMathStep(0, 100, 1.25)).toBeCloseTo(1.25, 10);
    expect(pinchMathStep(100, 0, 1.25)).toBeCloseTo(1.25, 10);
    expect(pinchMathStep(NaN, 100, 1.25)).toBeCloseTo(1.25, 10);
    expect(pinchMathStep(100, Infinity, 99)).toBeCloseTo(ZOOM_MAX, 10);
  });
});

describe('resetZoom', () => {
  it('returns ZOOM_DEFAULT', () => {
    expect(resetZoom()).toBeCloseTo(ZOOM_DEFAULT, 10);
  });
});

describe('readZoom / writeZoom', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns ZOOM_DEFAULT when nothing is stored', () => {
    expect(readZoom()).toBeCloseTo(ZOOM_DEFAULT, 10);
  });
  it('round-trips a valid value', () => {
    writeZoom(1.5);
    expect(readZoom()).toBeCloseTo(1.5, 10);
  });
  it('clamps an out-of-range stored value on read', () => {
    localStorage.setItem(ZOOM_STORAGE_KEY, '5.0');
    expect(readZoom()).toBeCloseTo(ZOOM_MAX, 10);
  });
  it('returns ZOOM_DEFAULT for a corrupt stored value', () => {
    localStorage.setItem(ZOOM_STORAGE_KEY, 'not a number');
    expect(readZoom()).toBeCloseTo(ZOOM_DEFAULT, 10);
  });
  it('survives localStorage being unavailable on read', () => {
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    try {
      expect(readZoom()).toBeCloseTo(ZOOM_DEFAULT, 10);
    } finally {
      Storage.prototype.getItem = originalGetItem;
    }
  });
  it('survives localStorage being unavailable on write', () => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
    try {
      expect(() => writeZoom(1.5)).not.toThrow();
    } finally {
      Storage.prototype.setItem = originalSetItem;
    }
  });
});
