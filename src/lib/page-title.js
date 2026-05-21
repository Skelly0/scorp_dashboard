import { writable, derived } from 'svelte/store';

export const pageTitle = writable('Colony Status');
export const crisisAlert = writable(false);

const FAVICON_NORMAL = 'favicon.svg';
const FAVICON_ALERT = 'favicon-alert.svg';

function apply([title, alert]) {
  document.title = `${alert ? '⚠ CRISIS · ' : ''}${title} · SCORP Colony`;
  const link = document.querySelector('link[rel="icon"]');
  if (link) {
    const next = alert ? FAVICON_ALERT : FAVICON_NORMAL;
    // Swap only the final path segment so the Vite base path (base: './') is preserved.
    link.setAttribute('href', link.getAttribute('href').replace(/[^/]*$/, next));
  }
}

derived([pageTitle, crisisAlert], (vals) => vals).subscribe(apply);
