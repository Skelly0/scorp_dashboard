<script>
  import { onMount } from 'svelte';
  import { pageTitle } from '../lib/page-title.js';
  import Band from '../lib/components/Band.svelte';

  onMount(() => {
    pageTitle.set('404');
  });
</script>

<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px]">
  <Band num="404" title="Page Not Found" meta="no such record" />
  <div class="s-card s-card-pad">
    <p class="text-sm m-0">The page you requested doesn't exist in the colony record.</p>
    <p class="m-0 mt-4">
      <a href="#/" class="s-chip inline-flex no-underline">← Return to Status</a>
    </p>
  </div>
</section>
