import { writable } from 'svelte/store';

export const pageTitle = writable('Colony Status');

pageTitle.subscribe((t) => {
  document.title = `${t} · SCORP Colony`;
});
