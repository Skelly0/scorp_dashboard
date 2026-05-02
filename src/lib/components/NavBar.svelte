<script>
  import { meta } from '../stores/meta.js';
  import ThemeToggle from './ThemeToggle.svelte';
  import SyncChip from './SyncChip.svelte';
  import { link, location } from 'svelte-spa-router';

  const ALL_PAGES = [
    { path: '/', label: 'Status' },
    { path: '/map', label: 'Map' },
    { path: '/population', label: 'Population' },
    { path: '/pops', label: 'Pops' },
    { path: '/gois', label: 'GoIs' },
    { path: '/parties', label: 'Parties' },
    { path: '/senate', label: 'Senate', requiresSenate: true },
    { path: '/situations', label: 'Situations' },
  ];

  let menuOpen = false;
  $: pages = ALL_PAGES.filter((p) => !p.requiresSenate || $meta?.senate_visible);
</script>

<nav class="border-b-4 border-border bg-bg">
  <div class="px-4 md:px-6 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3 md:gap-6">
      <span class="font-mono font-bold uppercase tracking-widest text-accent text-sm md:text-base">
        Colony ▌ T-43
      </span>
      <button
        class="md:hidden border-2 border-border px-2 py-1 text-xs uppercase tracking-widest"
        on:click={() => (menuOpen = !menuOpen)}
        aria-label="Toggle nav"
        aria-expanded={menuOpen}
      >
        {menuOpen ? '✕' : '☰'}
      </button>
      <ul class="hidden md:flex gap-3 font-mono text-xs uppercase tracking-widest">
        {#each pages as p}
          <li>
            <a
              href={p.path}
              use:link
              class="px-2 py-1 border-2 border-transparent hover:border-border"
              class:border-border={$location === p.path}
              class:bg-border={$location === p.path}
              class:text-bg={$location === p.path}
            >
              {p.label}
            </a>
          </li>
        {/each}
      </ul>
    </div>
    <div class="flex items-center gap-2 md:gap-3">
      <SyncChip />
      <ThemeToggle />
    </div>
  </div>
  {#if menuOpen}
    <ul class="md:hidden border-t-2 border-border font-mono text-xs uppercase tracking-widest">
      {#each pages as p}
        <li>
          <a
            href={p.path}
            use:link
            on:click={() => (menuOpen = false)}
            class="block px-4 py-2 border-b border-border/30"
            class:bg-border={$location === p.path}
            class:text-bg={$location === p.path}
          >
            {p.label}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</nav>
