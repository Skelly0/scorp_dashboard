<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { map, mapError, loadMap } from '../lib/stores/map.js';
  import { pageTitle } from '../lib/page-title.js';
  import MapCanvas from '../lib/components/MapCanvas.svelte';

  let layer = 'terrain';
  let hoverTile = null;
  let pinnedTile = null;

  $: t = pinnedTile ?? hoverTile;

  onMount(() => {
    pageTitle.set('Map');
    if ($meta?.synced_at) loadMap($meta.synced_at);
  });

  const LAYERS = [
    { value: 'terrain', label: 'Terrain' },
    { value: 'food', label: 'Food yield' },
    { value: 'materials', label: 'Materials yield' },
    { value: 'ore', label: 'Ore yield' },
    { value: 'energy', label: 'Energy yield' },
    { value: 'housing', label: 'Housing yield' },
    { value: 'water', label: 'Water yield' },
  ];
</script>

<section class="p-6">
  <div class="flex justify-between items-baseline mb-4 border-b-4 border-border pb-2">
    <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider">Map</h2>
    <label class="font-mono text-xs uppercase tracking-widest">
      Layer:
      <select bind:value={layer} class="bg-bg text-fg border-2 border-border ml-2 px-2 py-1">
        {#each LAYERS as l}
          <option value={l.value}>{l.label}</option>
        {/each}
      </select>
    </label>
  </div>

  {#if $mapError}
    <p class="text-crit">{$mapError}</p>
  {:else if !$map}
    <p class="text-muted">Loading map…</p>
  {:else}
    <div class="flex gap-4 items-start">
      <MapCanvas
        mapData={$map}
        {layer}
        on:hover={(e) => (hoverTile = e.detail)}
        on:pin={(e) => (pinnedTile = e.detail)}
      />
      <aside class="border-4 border-border p-4 min-w-[220px] font-mono text-sm">
        {#if !t}
          <p class="text-muted">Hover or arrow-key over a tile to inspect.</p>
        {:else}
          <h3 class="text-xs uppercase tracking-widest text-muted mb-2">
            Tile ({t.x}, {t.y})
          </h3>
          <dl class="space-y-1">
            <div class="flex justify-between"><dt>Terrain</dt><dd>{t.terrain ?? '—'}</dd></div>
            <div class="flex justify-between"><dt>Feature</dt><dd>{t.feature ?? '—'}</dd></div>
            <div class="flex justify-between"><dt>Resource</dt><dd>{t.resource ?? '—'}</dd></div>
            <div class="flex justify-between"><dt>Slots</dt><dd>{t.slots ?? '—'}</dd></div>
          </dl>
          {#if t.improvement}
            <h4 class="mt-3 text-xs uppercase tracking-widest text-muted">Improvement</h4>
            <dl class="space-y-1">
              <div class="flex justify-between"><dt>Name</dt><dd>{t.improvement.name}</dd></div>
              <div class="flex justify-between"><dt>Owner</dt><dd>{t.improvement.owner ?? '—'}</dd></div>
              <div class="flex justify-between"><dt>Type</dt><dd>{t.improvement.ownership_type ?? '—'}</dd></div>
            </dl>
          {/if}
          <h4 class="mt-3 text-xs uppercase tracking-widest text-muted">Yields</h4>
          <dl class="space-y-1">
            {#each Object.entries(t.yields) as [k, v]}
              <div class="flex justify-between"><dt class="capitalize">{k}</dt><dd class:text-crit={v < 0}>{v}</dd></div>
            {/each}
          </dl>
        {/if}
      </aside>
    </div>
  {/if}
</section>
