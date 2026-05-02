<script>
  import { onMount } from 'svelte';
  import Router from 'svelte-spa-router';
  import { initTheme } from './lib/theme.js';
  import { meta, metaError, loadMeta } from './lib/stores/meta.js';
  import NavBar from './lib/components/NavBar.svelte';
  import MaintenanceBanner from './lib/components/MaintenanceBanner.svelte';

  import Status from './routes/Status.svelte';
  import Population from './routes/Population.svelte';
  import Pops from './routes/Pops.svelte';
  import GoIs from './routes/GoIs.svelte';
  import Parties from './routes/Parties.svelte';
  import Map from './routes/Map.svelte';
  import Senate from './routes/Senate.svelte';
  import Situations from './routes/Situations.svelte';
  import EmptyPage from './routes/EmptyPage.svelte';
  import NotFound from './routes/NotFound.svelte';

  onMount(async () => {
    initTheme();
    await loadMeta();
  });

  const routes = {
    '/': Status,
    '/map': Map,
    '/population': Population,
    '/pops': Pops,
    '/gois': GoIs,
    '/parties': Parties,
    '/senate': Senate,
    '/situations': Situations,
    '*': NotFound,
  };
</script>

<div class="min-h-screen bg-bg text-fg font-mono">
  {#if $metaError}
    <MaintenanceBanner metaError={$metaError} />
  {:else if !$meta}
    <div class="p-8 text-muted">Loading…</div>
  {:else}
    <NavBar />
    <Router {routes} />
  {/if}
</div>
