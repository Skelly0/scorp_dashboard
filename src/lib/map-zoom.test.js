import { describe, it, expect, beforeEach } from 'vitest';
import {
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_DEFAULT,
  ZOOM_STEP,
  ZOOM_STORAGE_KEY,
  clampZoom,
  stepZoom,
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
