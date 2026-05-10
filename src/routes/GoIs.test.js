import { describe, expect, test, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import GoIs from './GoIs.svelte';
import { meta } from '../lib/stores/meta.js';
import { gois, goisError } from '../lib/stores/gois.js';

const baseGois = {
  gois: [],
  pop_capture_matrix: {
    classes: ['Security'],
    gois: ['Administration'],
    values: [[1974]],
  },
};

describe('GoIs page', () => {
  beforeEach(() => {
    meta.set(null);
    gois.set(null);
    goisError.set(null);
  });

  test('labels the captured-pop heatmap with the workbook table name', () => {
    gois.set(baseGois);

    render(GoIs);

    expect(screen.getByText('GOI VALUE CAPTURED POP')).toBeTruthy();
    expect(screen.getByText('1,974')).toBeTruthy();
    expect(screen.queryByText('Pop Capture Matrix')).toBeNull();
  });
});
