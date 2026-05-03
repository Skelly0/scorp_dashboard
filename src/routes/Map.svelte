<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { map, mapError, loadMap } from '../lib/stores/map.js';
  import { pageTitle } from '../lib/page-title.js';
  import Band from '../lib/components/Band.svelte';
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
    { value: 'food', label: 'Food' },
    { value: 'water', label: 'Water' },
    { value: 'energy', label: 'Energy' },
    { value: 'materials', label: 'Materials' },
    { value: 'ore', label: 'Ore' },
    { value: 'housing', label: 'Housing' },
  ];
</script>

<section class="px-6 py-5 max-w-[1600px]">
  {#if $mapError}
    <p class="text-crit">{$mapError}</p>
  {:else if !$map}
    <p class="text-muted text-xs uppercase tracking-widest">Loading map…</p>
  {:else}
    <Band num="01" title="Surface Grid" meta="40 × 40 · click to pin · hover to inspect" />

    <div class="layer-tabs">
      {#each LAYERS as l}
        <button
          aria-pressed={layer === l.value}
          on:click={() => (layer = l.value)}
        >
          {l.label}{l.value !== 'terrain' ? ' yield' : ''}
        </button>
      {/each}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3 items-start">
      <MapCanvas
        mapData={$map}
        {layer}
        on:hover={(e) => (hoverTile = e.detail)}
        on:pin={(e) => (pinnedTile = e.detail)}
      />

      <aside class="s-card">
        {#if !t}
          <div class="s-card-pad">
            <p class="text-muted text-xs uppercase tracking-widest">Hover or click a tile to inspect.</p>
          </div>
        {:else}
          <div class="s-card-header">
            <h3>Tile · ({String(t.x).padStart(2, '0')}, {String(t.y).padStart(2, '0')})</h3>
            <span class="meta">{layer}</span>
          </div>
          <div class="s-card-pad">
            <dl class="kv">
              <dt>Terrain</dt><dd>{t.terrain ?? '—'}</dd>
              <dt>Feature</dt><dd>{t.feature ?? '—'}</dd>
              <dt>Resource</dt><dd>{t.resource ?? '—'}</dd>
              <dt>Slots</dt><dd>{t.slots ?? '—'}</dd>
            </dl>
            {#if t.improvement}
              <div class="kv-section">
                <h4>Improvement</h4>
                <dl class="kv">
                  <dt>Name</dt><dd>{t.improvement.name ?? '—'}</dd>
                  <dt>Owner</dt><dd>{t.improvement.owner ?? '—'}</dd>
                  <dt>Type</dt><dd>{t.improvement.ownership_type ?? '—'}</dd>
                </dl>
              </div>
            {/if}
            {#if t.yields}
              <div class="kv-section">
                <h4>Yields</h4>
                <dl class="kv">
                  {#each Object.entries(t.yields) as [k, v]}
                    <dt class="capitalize">{k}</dt>
                    <dd class={v < 0 ? 'crit' : v > 0 ? 'good' : ''}>{v > 0 ? '+' : ''}{v}</dd>
                  {/each}
                </dl>
              </div>
            {/if}
          </div>
        {/if}
      </aside>
    </div>

    <div class="text-muted text-[10px] uppercase tracking-widest mt-3">
      ▣ Improvement · ◆ Resource feature · Color = {layer === 'terrain' ? 'biome' : layer + ' magnitude'}
    </div>
  {/if}
</section>
