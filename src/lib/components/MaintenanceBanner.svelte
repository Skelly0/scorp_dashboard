<script>
  export let metaError;
</script>

<div class="bg-crit text-bg p-4 font-mono text-sm">
  <strong class="uppercase tracking-widest">Dashboard Unavailable</strong>
  {#if metaError.kind === 'schema_mismatch'}
    <p class="mt-2">
      Frontend expects schema version {metaError.expected}; data is at version {metaError.actual}.
      The dashboard needs to be redeployed against the current data schema.
    </p>
  {:else if metaError.kind === 'fetch_failed'}
    <p class="mt-2">Could not load metadata: {metaError.message}. Check Pages deployment.</p>
  {:else}
    <p class="mt-2">Unknown error.</p>
  {/if}
</div>
