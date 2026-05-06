<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { pops, popsError, loadPops } from '../lib/stores/pops.js';
  import {
    demographics, demographicsError, loadDemographics,
  } from '../lib/stores/demographics.js';
  import { pageTitle } from '../lib/page-title.js';
  import MoonLoader from '../lib/components/MoonLoader.svelte';

  onMount(() => {
    pageTitle.set('Demographics');
    if ($meta?.synced_at) {
      loadPops($meta.synced_at);
      loadDemographics($meta.synced_at);
    }
  });

  $: errorMsg = $demographicsError ?? $popsError;
  $: ready = $demographics && $pops;
</script>

<section class="px-6 py-5 max-w-[1600px]">
  {#if errorMsg}
    <p class="text-crit">Failed to load demographics: {errorMsg}</p>
  {:else if !ready}
    <div class="flex flex-col items-center justify-center py-12 gap-4">
      <MoonLoader size={220} label="Loading demographics" />
      <p class="text-muted text-xs uppercase tracking-widest">Reading vital signs…</p>
    </div>
  {:else}
    <!-- Bands populated in subsequent tasks -->
    <p class="text-muted text-xs uppercase tracking-widest">Demographics page (bands coming)</p>
  {/if}
</section>
