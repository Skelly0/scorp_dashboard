<script>
  import { onMount } from 'svelte';
  import Router from 'svelte-spa-router';
  import { initTheme } from './lib/theme.js';
  import { meta, metaError, loadMeta } from './lib/stores/meta.js';
  import { loadCatalog } from './lib/stores/catalog.js';
  import NavBar from './lib/components/NavBar.svelte';
  import MaintenanceBanner from './lib/components/MaintenanceBanner.svelte';
  import MoonLoader from './lib/components/MoonLoader.svelte';
  import MoonBackdrop from './lib/components/MoonBackdrop.svelte';

  import Status from './routes/Status.svelte';
  import Population from './routes/Population.svelte';
  import GoIs from './routes/GoIs.svelte';
  import Parties from './routes/Parties.svelte';
  import Map from './routes/Map.svelte';
  import Senate from './routes/Senate.svelte';
  import Situations from './routes/Situations.svelte';
  import Demographics from './routes/Demographics.svelte';
  import Tech from './routes/Tech.svelte';
  import Cropsim from './routes/Cropsim.svelte';
  import EmptyPage from './routes/EmptyPage.svelte';
  import NotFound from './routes/NotFound.svelte';

  onMount(async () => {
    initTheme();
    const data = await loadMeta();
    if (data) {
      // Catalog is fire-and-forget — categorizer regex is the load-time fallback.
      loadCatalog(data.synced_at);
    }
  });

  const routes = {
    '/': Status,
    '/map': Map,
    '/population': Population,
    '/demographics': Demographics,
    '/cropsim': Cropsim,
    '/gois': GoIs,
    '/tech': Tech,
    '/parties': Parties,
    '/senate': Senate,
    '/situations': Situations,
    '*': NotFound,
  };
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
      <NavBar />
      <Router {routes} />
    {/if}
  </div>
</div>
