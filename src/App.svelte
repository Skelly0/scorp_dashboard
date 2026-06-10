<script>
  import { onMount } from 'svelte';
  import Router, { location } from 'svelte-spa-router';
  import { initTheme } from './lib/theme.js';
  import { meta, metaError, loadMeta } from './lib/stores/meta.js';
  import { loadCatalog } from './lib/stores/catalog.js';
  import { loadSituations } from './lib/stores/situations.js';
  import { crisisBreach } from './lib/stores/crisis.js';
  import { crisisAlert } from './lib/page-title.js';
  import CrisisBanner from './lib/components/CrisisBanner.svelte';
  import CrisisFrame from './lib/components/CrisisFrame.svelte';
  import NavBar from './lib/components/NavBar.svelte';
  import MaintenanceBanner from './lib/components/MaintenanceBanner.svelte';
  import MoonLoader from './lib/components/MoonLoader.svelte';
  import MoonBackdrop from './lib/components/MoonBackdrop.svelte';

  import Status from './routes/Status.svelte';
  import GoIs from './routes/GoIs.svelte';
  import Parties from './routes/Parties.svelte';
  import Map from './routes/Map.svelte';
  import Senate from './routes/Senate.svelte';
  import Situations from './routes/Situations.svelte';
  import Demographics from './routes/Demographics.svelte';
  import Tech from './routes/Tech.svelte';
  import Cropsim from './routes/Cropsim.svelte';
  import NotFound from './routes/NotFound.svelte';

  onMount(async () => {
    initTheme();
    const data = await loadMeta();
    if (data) {
      // Catalog is fire-and-forget — categorizer regex is the load-time fallback.
      loadCatalog(data.synced_at);
      // Load situations once globally so the crisis breach treatment (driven by Situation Load) shows on every route.
      loadSituations(data.synced_at);
    }
  });

  // Tab title + favicon alert mirror the colony-wide breach state.
  $: crisisAlert.set($crisisBreach.breached);

  const routes = {
    '/': Status,
    '/map': Map,
    '/demographics': Demographics,
    '/cropsim': Cropsim,
    '/gois': GoIs,
    '/tech': Tech,
    '/parties': Parties,
    '/senate': Senate,
    '/situations': Situations,
    '*': NotFound,
  };

  let mainEl;
  let routeInitialized = false;
  // Route change → move focus to the main landmark + scroll to top.
  // Skips the initial value so page load doesn't steal focus.
  $: handleRouteChange($location);
  function handleRouteChange(_loc) {
    if (!routeInitialized) {
      routeInitialized = true;
      return;
    }
    requestAnimationFrame(() => {
      mainEl?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    });
  }
</script>

<div class="relative min-h-screen bg-bg text-fg font-mono">
  {#if !$metaError}
    <MoonBackdrop />
  {/if}
  <div class="relative z-10">
    {#if $metaError}
      <MaintenanceBanner metaError={$metaError} />
    {:else if !$meta}
      <div class="min-h-screen flex flex-col items-center justify-center gap-6">
        <MoonLoader size={320} label="Loading colony data" />
        <p class="text-muted text-xs uppercase tracking-widest">Synchronising colony record…</p>
      </div>
    {:else}
      <a href="#main" class="skip-link" on:click|preventDefault={() => mainEl?.focus()}>Skip to content</a>
      <NavBar />
      <CrisisBanner />
      <main id="main" tabindex="-1" bind:this={mainEl} class="outline-none">
        <Router {routes} />
      </main>
    {/if}
  </div>
  <CrisisFrame />
</div>
