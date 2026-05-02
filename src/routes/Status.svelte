<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { status, statusError, loadStatus } from '../lib/stores/status.js';
  import { pageTitle } from '../lib/page-title.js';
  import StatTile from '../lib/components/StatTile.svelte';

  onMount(() => {
    pageTitle.set('Status');
    if ($meta?.synced_at) loadStatus($meta.synced_at);
  });

  $: critical = $status && $status.crisis_factor != null && $status.stability != null
    && $status.crisis_factor >= $status.stability;
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider mb-4 border-b-4 border-border pb-2">
    Colony Status
  </h2>

  {#if $statusError}
    <p class="text-crit">Failed to load status: {$statusError}</p>
  {:else if !$status}
    <p class="text-muted">Loading…</p>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
      <StatTile label="Treasury" value={$status.treasury?.money} delta={$status.treasury?.delta} />
      <StatTile label="Population" value={$status.population_total?.toLocaleString()} />
      <StatTile label="Stability" value={$status.stability?.toFixed(2)} />
      <StatTile label="Crisis Factor" value={$status.crisis_factor?.toFixed(2)} critical={critical} />
    </div>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Resource Flows</h3>
    <div class="grid grid-cols-2 md:grid-cols-7 gap-3 mb-6">
      {#each $status.resources as r}
        <StatTile label={r.name} value={r.current} delta={r.delta} />
      {/each}
    </div>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Overton Window</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
      {#each Object.entries($status.overton) as [axis, value]}
        <div class="border-2 border-border p-2">
          <div class="flex justify-between text-xs uppercase tracking-widest mb-1">
            <span>{axis}</span>
            <span class="font-bold">{value?.toFixed(1) ?? '—'}</span>
          </div>
          <div class="h-2 bg-bg border border-border relative">
            <div
              class="absolute top-0 bottom-0 bg-accent"
              style="width: {((value ?? 4) - 1) / 6 * 100}%"
            ></div>
          </div>
        </div>
      {/each}
    </div>

    {#if $status.active_situations.length > 0}
      <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Active Situations</h3>
      <div class="flex flex-wrap gap-2">
        {#each $status.active_situations as sit}
          <span class="border-2 border-crit text-crit px-2 py-1 text-xs uppercase tracking-widest">
            ⚠ {sit.name} · {sit.crisis_factor?.toFixed(2)}
          </span>
        {/each}
      </div>
    {/if}
  {/if}
</section>
