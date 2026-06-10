<script>
  // Presentational page chrome: sr-only h1, stale-sync banner, error card
  // with Retry, MoonLoader loading state, then the slot. Routes own their
  // stores and loading conditions — this component never fetches.
  import { meta } from '../stores/meta.js';
  import MoonLoader from './MoonLoader.svelte';

  export let label;
  /** @type {string | string[]} page key(s) checked against meta.partial_failures */
  export let page;
  export let error = null;
  export let loading = false;
  export let loadingText = 'Loading…';
  export let retry = null;

  $: pageKeys = Array.isArray(page) ? page : page != null ? [page] : [];
  $: stale = ($meta?.partial_failures ?? []).some((k) => pageKeys.includes(k));
</script>

<h1 class="sr-only">{label}</h1>

{#if stale}
  <div class="stale-banner" role="status">
    <span class="stale-banner-icon" aria-hidden="true">⚠</span>
    <span>This page failed to sync — showing data from the last successful update.</span>
  </div>
{/if}

{#if error}
  <div class="s-card s-card-pad" role="alert">
    <strong class="uppercase tracking-widest text-[10px] text-crit">Failed to load {label}</strong>
    <p class="text-muted text-xs m-0 mt-1">{error}</p>
    {#if retry}
      <button
        type="button"
        class="mt-3 border-2 border-border px-3 py-2 text-xs uppercase tracking-widest hover:border-accent"
        on:click={retry}
      >Retry</button>
    {/if}
  </div>
{:else if loading}
  <div class="flex flex-col items-center justify-center py-12 gap-4">
    <MoonLoader size={220} label={`Loading ${label}`} />
    <p class="text-muted text-xs uppercase tracking-widest">{loadingText}</p>
  </div>
{:else}
  <slot />
{/if}
