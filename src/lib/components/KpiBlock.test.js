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
});
