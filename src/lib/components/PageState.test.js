import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { meta } from '../stores/meta.js';
import Host from './PageStateTestHost.svelte';

vi.mock('./MoonLoader.svelte', async () => ({
  default: (await import('./MoonLoaderStub.svelte')).default,
}));

const BASE_META = { synced_at: 't', schema_version: 12, senate_visible: false, partial_failures: [] };

describe('PageState', () => {
  beforeEach(() => {
    meta.set({ ...BASE_META });
  });

  test('renders slot content and sr-only h1 when loaded', () => {
    const { container, getByTestId } = render(Host, { props: { label: 'GoIs', page: 'gois' } });
    expect(getByTestId('page-content')).toBeTruthy();
    const h1 = container.querySelector('h1.sr-only');
    expect(h1?.textContent).toBe('GoIs');
  });

  test('loading state shows MoonLoader + loadingText, hides content', () => {
    const { queryByTestId, getByText } = render(Host, {
      props: { label: 'GoIs', page: 'gois', loading: true, loadingText: 'Reading factions…' },
    });
    expect(queryByTestId('moon-loader-stub')).toBeTruthy();
    expect(getByText('Reading factions…')).toBeTruthy();
    expect(queryByTestId('page-content')).toBeNull();
  });

  test('error state wins over loading and fires retry', async () => {
    const retry = vi.fn();
    const { getByText, getByRole, queryByTestId } = render(Host, {
      props: { label: 'GoIs', page: 'gois', error: 'gois.json fetch failed: 500', loading: true, retry },
    });
    expect(getByText('Failed to load GoIs')).toBeTruthy();
    expect(getByRole('alert').textContent).toContain('Failed to load GoIs');
    expect(getByText('gois.json fetch failed: 500')).toBeTruthy();
    expect(queryByTestId('moon-loader-stub')).toBeNull();
    await fireEvent.click(getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  test('retry omitted renders no Retry button', () => {
    const { getByText, queryByRole } = render(Host, {
      props: { label: 'GoIs', page: 'gois', error: 'boom' },
    });
    expect(getByText('Failed to load GoIs')).toBeTruthy();
    expect(queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  test('stale banner shows when the page key is in partial_failures', () => {
    meta.set({ ...BASE_META, partial_failures: ['gois'] });
    const { container } = render(Host, { props: { label: 'GoIs', page: 'gois' } });
    expect(container.querySelector('.stale-banner')).toBeTruthy();
  });

  test('array page prop matches any failed key', () => {
    meta.set({ ...BASE_META, partial_failures: ['status'] });
    const { container } = render(Host, {
      props: { label: 'Cropsim', page: ['cropsim', 'status'] },
    });
    expect(container.querySelector('.stale-banner')).toBeTruthy();
  });

  test('no banner when the page did not fail', () => {
    meta.set({ ...BASE_META, partial_failures: ['gois'] });
    const { container } = render(Host, { props: { label: 'Parties', page: ['parties', 'pops'] } });
    expect(container.querySelector('.stale-banner')).toBeNull();
  });

  test('stale banner persists alongside the error state', () => {
    meta.set({ ...BASE_META, partial_failures: ['gois'] });
    const { container, getByText } = render(Host, {
      props: { label: 'GoIs', page: 'gois', error: 'boom' },
    });
    expect(container.querySelector('.stale-banner')).toBeTruthy();
    expect(getByText('Failed to load GoIs')).toBeTruthy();
  });

  test('meta = null first paint renders slot without throwing or banner', () => {
    meta.set(null);
    const { container, getByTestId } = render(Host, { props: { label: 'GoIs', page: 'gois' } });
    expect(getByTestId('page-content')).toBeTruthy();
    expect(container.querySelector('.stale-banner')).toBeNull();
  });
});
