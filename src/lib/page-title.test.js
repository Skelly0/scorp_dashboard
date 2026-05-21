import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { pageTitle, crisisAlert } from './page-title.js';

beforeEach(() => {
  document.head.replaceChildren();
  const link = document.createElement('link');
  link.setAttribute('rel', 'icon');
  link.setAttribute('href', 'http://localhost/favicon.svg');
  document.head.appendChild(link);
  pageTitle.set('Status');
  crisisAlert.set(false);
});
afterEach(() => crisisAlert.set(false));

function iconHref() {
  return document.querySelector('link[rel="icon"]').getAttribute('href');
}

describe('page-title crisis alert', () => {
  test('normal title has no crisis prefix', () => {
    expect(document.title).toBe('Status · SCORP Colony');
  });

  test('crisisAlert prefixes the title and swaps the favicon', () => {
    crisisAlert.set(true);
    expect(document.title.startsWith('⚠ CRISIS · ')).toBe(true);
    expect(iconHref().endsWith('favicon-alert.svg')).toBe(true);
  });

  test('clearing crisisAlert restores title and favicon', () => {
    crisisAlert.set(true);
    crisisAlert.set(false);
    expect(document.title).toBe('Status · SCORP Colony');
    expect(iconHref().endsWith('favicon.svg')).toBe(true);
  });
});
