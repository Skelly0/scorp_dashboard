import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import KpiBlock from './KpiBlock.svelte';

describe('KpiBlock', () => {
  test('renders an explicit warning tone on the KPI number', () => {
    const { container } = render(KpiBlock, {
      props: { label: 'Gov Approval', value: '45%', tone: 'warn' },
    });

    expect(container.querySelector('.kpi-num.warn')?.textContent).toBe('45%');
  });

  test('groups numeric deltas like the flow chips beside them', () => {
    const { container } = render(KpiBlock, {
      props: { label: 'Money', value: '165,330', delta: 65998 },
    });

    expect(container.querySelector('.delta')?.textContent).toBe('▲ +65,998');
  });

  test('negative and zero deltas keep their sign glyphs', () => {
    const down = render(KpiBlock, {
      props: { label: 'Population', value: '99,163', delta: -1042 },
    });
    expect(down.container.querySelector('.delta.down')?.textContent).toBe('▼ -1,042');

    const flat = render(KpiBlock, {
      props: { label: 'Population', value: '99,163', delta: 0 },
    });
    expect(flat.container.querySelector('.delta')?.textContent).toBe('· 0');
  });
});
