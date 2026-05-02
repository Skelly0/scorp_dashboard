<script>
  import { onMount } from 'svelte';
  import { pageTitle } from '../lib/page-title.js';

  onMount(() => {
    pageTitle.set('404');
  });
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider">404 — Page Not Found</h2>
  <p class="text-muted mt-2">The page you requested doesn't exist.</p>
</section>
