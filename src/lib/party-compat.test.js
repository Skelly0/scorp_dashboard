import { describe, expect, it } from 'vitest';
import { classCompatPopMatrix } from './party-compat.js';

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
});
