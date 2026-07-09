import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import TimelineBar from './TimelineBar.svelte';
import { status } from '../stores/status.js';
import { history } from '../stores/history.js';
import { selectedYearIdx } from '../stores/timeline.js';

const SNAP_2075 = {
  year: 2075,
  population_total: 92000,
  resources: [],
  overton: {},
};

const STATUS_2076 = {
  year: 2076,
  population_total: 99163,
  resources: [],
  overton: {},
  demographics: {},
};

describe('TimelineBar', () => {
  beforeEach(() => {
    selectedYearIdx.set(null);
    history.set({ years: [2075], snapshots: [SNAP_2075] });
    status.set(STATUS_2076);
  });

  it('restarts playback from the first year when play is clicked at live end', async () => {
    const { container, getByRole, component } = render(TimelineBar);

    expect(container.querySelector('.tl-year')?.textContent).toBe('2076');
    expect(container.querySelector('.tl-chip')?.textContent).toBe('Live');

    await fireEvent.click(getByRole('button', { name: 'Play timeline' }));
    await tick();

    expect(container.querySelector('.tl-year')?.textContent).toBe('2075');
    expect(container.querySelector('.tl-chip')?.textContent).toBe('Archive');

    component.$destroy();
  });
});