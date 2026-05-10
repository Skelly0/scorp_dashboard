import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import Heatmap from './Heatmap.svelte';

describe('Heatmap', () => {
  it('formats integer count cells with grouping', () => {
    const { container } = render(Heatmap, {
      props: {
        rowLabels: ['Bureaucrats'],
        colLabels: ['Administration'],
        values: [[3945]],
        format: 'int',
      },
    });

    expect(container.querySelector('.heatmap-value')?.textContent).toBe('3,945');
  });
});
