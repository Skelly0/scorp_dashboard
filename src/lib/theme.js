import { writable } from 'svelte/store';

const VALID = new Set(['light', 'dark']);
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

export function toggleTheme() {
  let current;
  theme.subscribe((v) => (current = v))();
  setTheme(current === 'light' ? 'dark' : 'light');
}
