import { writable } from 'svelte/store';

export const THEMES = ['light', 'dark', 'schematic'];
const VALID = new Set(THEMES);
const KEY = 'theme';

export const theme = writable('light');

function readStored() {
  try {
    const t = localStorage.getItem(KEY);
    return VALID.has(t) ? t : 'light';
  } catch {
    return 'light';
  }
}

function apply(value) {
  document.documentElement.dataset.theme = value;
  theme.set(value);
}

export function initTheme() {
  apply(readStored());
}

export function setTheme(value) {
  if (!VALID.has(value)) return;
  try {
    localStorage.setItem(KEY, value);
  } catch {}
  apply(value);
}

export function cycleTheme() {
  let current;
  theme.subscribe((v) => (current = v))();
  const idx = THEMES.indexOf(current);
  const next = THEMES[(idx + 1) % THEMES.length];
  setTheme(next);
}

export const toggleTheme = cycleTheme;
