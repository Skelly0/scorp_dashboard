import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import LayerMenu from './LayerMenu.svelte';

const OPTIONS = [
  { key: 'food', label: 'Food' },
  { key: 'water', label: 'Water' },
  { key: 'energy', label: 'Energy' },
];

describe('LayerMenu', () => {
  it('renders the parent label when no sub is active', () => {
    const { getByRole } = render(LayerMenu, {
      props: { label: 'Yields', category: 'yield', options: OPTIONS, activeKey: null, defaultKey: 'food' },
    });
    const trigger = getByRole('button', { name: /Yields/i });
    expect(trigger.textContent).not.toContain('·');
  });

  it('renders "Label · Sub" when a sub is active', () => {
    const { getByRole } = render(LayerMenu, {
      props: { label: 'Yields', category: 'yield', options: OPTIONS, activeKey: 'water', defaultKey: 'food' },
    });
    expect(getByRole('button').textContent).toMatch(/Yields\s*·\s*Water/);
  });

  it('opens the popup on click and closes on second click', async () => {
    const { getByRole, queryByRole, getAllByRole } = render(LayerMenu, {
      props: { label: 'Yields', category: 'yield', options: OPTIONS, activeKey: 'water', defaultKey: 'food' },
    });
    const trigger = getByRole('button');
    await fireEvent.click(trigger);
    await tick();
    expect(getAllByRole('menuitem')).toHaveLength(3);
    await fireEvent.click(trigger);
    await tick();
    expect(queryByRole('menuitem')).toBeNull();
  });

  it('dispatches select with the encoded layer id', async () => {
    const handler = vi.fn();
    const { getByRole, getAllByRole, component } = render(LayerMenu, {
      props: { label: 'Yields', category: 'yield', options: OPTIONS, activeKey: 'water', defaultKey: 'food' },
    });
    component.$on('select', handler);
    await fireEvent.click(getByRole('button'));
    await tick();
    await fireEvent.click(getAllByRole('menuitem')[2]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ layerId: 'yield:energy' });
  });

  it('closes on Escape and stops propagation', async () => {
    const { getByRole, queryByRole } = render(LayerMenu, {
      props: { label: 'Yields', category: 'yield', options: OPTIONS, activeKey: 'water', defaultKey: 'food' },
    });
    await fireEvent.click(getByRole('button'));
    await tick();
    const popup = queryByRole('menu');
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    popup.dispatchEvent(escEvent);
    await tick();
    expect(queryByRole('menu')).toBeNull();
    expect(escEvent.defaultPrevented).toBe(true);
  });
});
