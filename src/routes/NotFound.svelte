<script>
  import { onMount } from 'svelte';
  import { link } from 'svelte-spa-router';
  import { pageTitle } from '../lib/page-title.js';
  import Band from '../lib/components/Band.svelte';

  onMount(() => {
    pageTitle.set('404');
  });
</script>

<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px]">
  <h1 class="sr-only">Page not found</h1>
  <Band num="404" title="Signal Lost" meta="page not found" />
  <div class="s-card s-card-pad max-w-xl">
    <strong class="uppercase tracking-widest text-[10px] text-muted">No telemetry at this address</strong>
    <p class="text-sm m-0 mt-1">The page you requested doesn't exist — it may have been decommissioned, renamed, or never built.</p>
    <a href="/" use:link class="s-chip inline-flex mt-4">↩ Return to Status</a>
  </div>
</section>
