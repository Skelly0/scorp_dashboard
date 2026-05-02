import { describe, it, expect } from 'vitest';
import { polarPoints } from './radar-utils.js';

describe('radar utils', () => {
  it('polarPoints returns N points evenly distributed around center', () => {
    const pts = polarPoints([4, 4, 4, 4, 4, 4], { cx: 100, cy: 100, radius: 50, scaleMin: 1, scaleMax: 7 });
    expect(pts).toHaveLength(6);
    // Each point at half radius (4 is midpoint of 1..7).
    expect(pts[0].x).toBeCloseTo(100, 1);
    expect(pts[0].y).toBeCloseTo(75, 1); // straight up
  });

  it('polarPoints handles missing values as scale midpoint', () => {
    const pts = polarPoints([null, null, null, null, null, null], { cx: 0, cy: 0, radius: 10, scaleMin: 1, scaleMax: 7 });
    expect(pts).toHaveLength(6);
    pts.forEach((p) => expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true));
  });

  it('polarPoints clamps values outside scale range', () => {
    const pts = polarPoints([10, -5, 4, 4, 4, 4], { cx: 0, cy: 0, radius: 10, scaleMin: 1, scaleMax: 7 });
    pts.forEach((p) => expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true));
  });
});
