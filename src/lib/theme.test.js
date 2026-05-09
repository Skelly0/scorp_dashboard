import { describe, it, expect, beforeEach } from 'vitest';
import { theme, setTheme, cycleTheme, toggleTheme, initTheme, THEMES } from './theme.js';
import { get } from 'svelte/store';

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('exposes the three valid themes in cycle order', () => {
    expect(THEMES).toEqual(['light', 'dark', 'schematic']);
  });

  it('defaults to schematic when no preference is stored', () => {
    initTheme();
    expect(get(theme)).toBe('schematic');
    expect(document.documentElement.dataset.theme).toBe('schematic');
  });

  it('reads stored preference on init', () => {
    localStorage.setItem('theme', 'dark');
    initTheme();
    expect(get(theme)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('reads stored schematic preference on init', () => {
    localStorage.setItem('theme', 'schematic');
    initTheme();
    expect(get(theme)).toBe('schematic');
    expect(document.documentElement.dataset.theme).toBe('schematic');
  });

  it('setTheme persists and applies', () => {
    initTheme();
    setTheme('dark');
    expect(get(theme)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('setTheme rejects invalid values', () => {
    initTheme();
    setTheme('pink');
    expect(get(theme)).toBe('schematic');
  });

  it('cycleTheme rotates schematic -> light -> dark -> schematic', () => {
    initTheme();
    cycleTheme();
    expect(get(theme)).toBe('light');
    cycleTheme();
    expect(get(theme)).toBe('dark');
    cycleTheme();
    expect(get(theme)).toBe('schematic');
  });

  it('cycleTheme rotates light -> dark -> schematic -> light', () => {
    localStorage.setItem('theme', 'light');
    initTheme();
    cycleTheme();
    expect(get(theme)).toBe('dark');
    cycleTheme();
    expect(get(theme)).toBe('schematic');
    cycleTheme();
    expect(get(theme)).toBe('light');
  });

  it('toggleTheme is an alias for cycleTheme', () => {
    initTheme();
    toggleTheme();
    expect(get(theme)).toBe('light');
    toggleTheme();
    expect(get(theme)).toBe('dark');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem('theme', 'pink');
    initTheme();
    expect(get(theme)).toBe('schematic');
  });
});
