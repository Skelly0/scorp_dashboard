<script>
  import { onMount, onDestroy, tick, createEventDispatcher } from 'svelte';
  import { CATEGORIES } from '../improvement-categories.js';
  import { catalog } from '../stores/catalog.js';
  import ImprovementCard from './ImprovementCard.svelte';

  const dispatch = createEventDispatcher();

  let modalEl;
  let searchEl;
  let triggerEl = null;
  let inertedEl = null;

  let query = '';
  let activeFilters = new Set(); // category slugs

  $: groups = buildGroups($catalog, query, activeFilters);
  $: totalCount = groups.reduce((n, g) => n + g.items.length, 0);

  // Note: onMount runs sync setup; cleanup lives in onDestroy.
  // (An async onMount would return a Promise, and Svelte ignores its returned cleanup.)
  onMount(() => {
    triggerEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const app = document.getElementById('app') ?? document.querySelector('main') ?? document.body.firstElementChild;
    if (app && app !== document.body) {
      app.setAttribute('inert', '');
      inertedEl = app;
    }
    tick().then(() => searchEl?.focus());
  });

  onDestroy(() => {
    if (inertedEl) inertedEl.removeAttribute('inert');
    triggerEl?.focus?.();
  });

  function close() {
    dispatch('close');
  }

  // Track mousedown origin so dragging text out of the modal onto the backdrop
  // doesn't close — only a clean backdrop-only click does.
  let mouseDownTarget = null;
  function onBackdropMouseDown(e) {
    mouseDownTarget = e.target;
  }
  function onBackdropClick(e) {
    if (e.target === e.currentTarget && mouseDownTarget === e.currentTarget) close();
    mouseDownTarget = null;
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Tab') trapFocus(e);
  }

  function trapFocus(e) {
    if (!modalEl) return;
    const focusables = modalEl.querySelectorAll(
      'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function toggleFilter(slug) {
    const next = new Set(activeFilters);
    if (next.has(slug)) next.delete(slug); else next.add(slug);
    activeFilters = next;
  }

  function buildGroups(cat, q, filters) {
    if (!cat) return [];
    const needle = q.trim().toLowerCase();
    const out = new Map();
    for (const imp of cat.improvements) {
      const slug = imp.category ?? 'other';
      if (filters.size && !filters.has(slug)) continue;
      if (needle && !imp.name.toLowerCase().includes(needle)) continue;
      if (!out.has(slug)) out.set(slug, []);
      out.get(slug).push(imp);
    }
    return Array.from(out.entries())
      .map(([slug, items]) => ({
        slug,
        meta: CATEGORIES[slug] ?? CATEGORIES.other,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.meta.label.localeCompare(b.meta.label));
  }
</script>

<svelte:body on:keydown={onKeyDown} />

<div
  class="cat-backdrop"
  on:mousedown={onBackdropMouseDown}
  on:click={onBackdropClick}
  role="presentation"
>
  <div
    class="cat-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cat-title"
    bind:this={modalEl}
  >
    <header class="cat-header">
      <h2 id="cat-title">Improvements Catalog</h2>
      <input
        bind:this={searchEl}
        bind:value={query}
        class="cat-search"
        placeholder="Search improvements…"
        type="search"
        aria-label="Search improvements"
      />
      <button class="cat-close" on:click={close} aria-label="Close catalog">✕</button>
    </header>

    <div class="cat-cat-strip">
      {#each Object.values(CATEGORIES) as c (c.slug)}
        <button
          class="s-chip"
          aria-pressed={activeFilters.has(c.slug)}
          on:click={() => toggleFilter(c.slug)}
        >
          {c.icon} {c.label}
        </button>
      {/each}
    </div>

    <main class="cat-body">
      {#if !$catalog}
        <div class="cat-empty">Catalog is loading or unavailable.</div>
      {:else if totalCount === 0}
        <div class="cat-empty">No improvements match the current filters.</div>
      {:else}
        {#each groups as g (g.slug)}
          <section class="cat-group">
            <h3>
              <span aria-hidden="true">{g.meta.icon}</span>
              {g.meta.label}
              <span class="meta">{g.items.length}</span>
            </h3>
            <div class="cat-grid">
              {#each g.items as imp (imp.name)}
                <ImprovementCard {imp} />
              {/each}
            </div>
          </section>
        {/each}
      {/if}
    </main>
  </div>
</div>
