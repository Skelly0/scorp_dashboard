<script>
  import { meta } from '../stores/meta.js';
  import { status } from '../stores/status.js';
  import ThemeToggle from './ThemeToggle.svelte';
  import SyncChip from './SyncChip.svelte';
  import { link, location } from 'svelte-spa-router';

  const ALL_PAGES = [
    { path: '/', label: 'Status' },
    { path: '/map', label: 'Map' },
    { path: '/demographics', label: 'Demographics' },
    { path: '/cropsim', label: 'Cropsim' },
    { path: '/gois', label: 'GoIs' },
    { path: '/tech', label: 'Tech' },
    { path: '/parties', label: 'Parties' },
    { path: '/senate', label: 'Senate', requiresSenate: true },
    { path: '/situations', label: 'Situations' },
  ];

  let menuOpen = false;
  $: pages = ALL_PAGES.filter((p) => !p.requiresSenate || $meta?.senate_visible);
  $: yearLabel = $status?.year != null ? `Y-${String($status.year).padStart(2, '0')}` : '';
  $: currentLabel = pages.find((p) => p.path === $location)?.label ?? '';
</script>

<nav class="border-b-4 border-border bg-bg">
  <div class="grid gap-y-3 px-4 py-3 md:flex md:items-center md:justify-between md:px-6">
    <div class="flex min-w-0 w-full items-center gap-3 md:w-auto md:flex-1 md:gap-6">
      <span class="shrink-0 font-mono font-bold uppercase tracking-widest text-accent text-sm md:text-base whitespace-nowrap">
        Colony{#if yearLabel}<span class="narrow-hide"><span class="inline-block mx-2 md:mx-3 opacity-70">|</span>{yearLabel}</span>{/if}
      </span>
      <button
        class="md:hidden shrink-0 border-2 border-border px-3 py-2 min-h-[44px] min-w-[44px] text-xs uppercase tracking-widest"
        on:click={() => (menuOpen = !menuOpen)}
        aria-label="Toggle nav"
        aria-expanded={menuOpen}
      >
        {menuOpen ? 'x' : '☰'}
      </button>
      {#if currentLabel}
        <span class="md:hidden min-w-0 flex-1 max-w-[7rem] sm:max-w-[10rem] text-xs uppercase tracking-widest text-muted truncate">
          {currentLabel}
        </span>
      {/if}
      <ul class="hidden md:flex gap-3 font-mono text-xs uppercase tracking-widest">
        {#each pages as p}
          <li>
            <a
              href={p.path}
              use:link
              aria-current={$location === p.path ? 'page' : undefined}
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
    <div class="flex max-w-full shrink-0 items-center justify-end gap-2 justify-self-end md:justify-self-auto md:gap-3">
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
            aria-current={$location === p.path ? 'page' : undefined}
            on:click={() => (menuOpen = false)}
            class="flex items-center min-h-[44px] px-4 py-3 border-b border-border/30"
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
