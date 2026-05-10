import { describe, expect, it } from 'vitest';
import { classCompatPopMatrix, partySupportOverview } from './party-compat.js';

describe('classCompatPopMatrix', () => {
  it('converts class compatibility scores into compatible pop counts', () => {
    const matrix = classCompatPopMatrix(
      {
        parties: ['Developmental League'],
        classes: ['Bureaucrats', 'Industrial Workers', 'Missing Class'],
        values: [[0.8, 0.25, 0.5]],
      },
      [
        { name: 'Bureaucrats', pop: 1000 },
        { name: 'Industrial Workers', pop: 3200 },
      ],
    );

    expect(matrix).toEqual({
      parties: ['Developmental League'],
      classes: ['Bureaucrats', 'Industrial Workers', 'Missing Class'],
      values: [[800, 800, null]],
    });
  });

  it('summarizes each party support base from capture matrices', () => {
    const overview = partySupportOverview(
      {
        classes: ['Scientists', 'Bureaucrats', 'Industrial Workers'],
        parties: ['Developmental League', 'Independent'],
        values: [
          [0.496, 0.361],
          [0.203, 0.578],
          [0.121, 0.114],
        ],
      },
      {
        classes: ['Scientists', 'Bureaucrats', 'Industrial Workers'],
        parties: ['Developmental League', 'Independent'],
        values: [
          [4237, 3087],
          [1062, 3021],
          [2085, 1958],
        ],
      },
    );

    expect(overview).toEqual([
      {
        party: 'Developmental League',
        totalCapturedPop: 7384,
        topClasses: [
          { className: 'Scientists', capturedPop: 4237, classCapturePct: 0.496, partySharePct: 4237 / 7384 },
          { className: 'Industrial Workers', capturedPop: 2085, classCapturePct: 0.121, partySharePct: 2085 / 7384 },
          { className: 'Bureaucrats', capturedPop: 1062, classCapturePct: 0.203, partySharePct: 1062 / 7384 },
        ],
      },
      {
        party: 'Independent',
        totalCapturedPop: 8066,
        topClasses: [
          { className: 'Scientists', capturedPop: 3087, classCapturePct: 0.361, partySharePct: 3087 / 8066 },
          { className: 'Bureaucrats', capturedPop: 3021, classCapturePct: 0.578, partySharePct: 3021 / 8066 },
          { className: 'Industrial Workers', capturedPop: 1958, classCapturePct: 0.114, partySharePct: 1958 / 8066 },
        ],
      },
    ]);
  });
});
