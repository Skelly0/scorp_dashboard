import { describe, it, expect, beforeEach } from 'vitest';
import { theme, setTheme, toggleTheme, initTheme } from './theme.js';
import { get } from 'svelte/store';

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to light when no preference is stored', () => {
    initTheme();
    expect(get(theme)).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('reads stored preference on init', () => {
    localStorage.setItem('theme', 'dark');
    initTheme();
    expect(get(theme)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('setTheme persists and applies', () => {
    initTheme();
    setTheme('dark');
    expect(get(theme)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('toggleTheme flips light <-> dark', () => {
    initTheme();
    toggleTheme();
    expect(get(theme)).toBe('dark');
    toggleTheme();
    expect(get(theme)).toBe('light');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem('theme', 'pink');
    initTheme();
    expect(get(theme)).toBe('light');
  });
});
