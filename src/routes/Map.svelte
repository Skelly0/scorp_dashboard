<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { map, mapError, loadMap } from '../lib/stores/map.js';
  import { pageTitle } from '../lib/page-title.js';
  import { categorySlugFor, CATEGORIES } from '../lib/improvement-categories.js';
  import { RESOURCE_CODES, FEATURE_CODES } from '../lib/map-codes.js';
  import Band from '../lib/components/Band.svelte';
  import MapCanvas from '../lib/components/MapCanvas.svelte';
  import RosterPanel from '../lib/components/RosterPanel.svelte';

  let layer = 'terrain';
  let hoverTile = null;
  let pinnedTile = null;
  let filters = { resource: null, feature: null, improvement: null };

  $: activeFilterCount = (filters.resource ? 1 : 0) + (filters.feature ? 1 : 0) + (filters.improvement ? 1 : 0);

  $: matchedTiles = $map ? $map.tiles.filter(t => tileMatchesFilters(t, filters)) : [];

  function tileMatchesFilters(t, f) {
    if (f.resource && t.resource !== f.resource) return false;
    if (f.feature && t.feature !== f.feature) return false;
    if (f.improvement) {
      if (!t.improvement) return false;
      return categorySlugFor(t.improvement.name) === f.improvement;
    }
    return true;
  }

  function clearFilter(kind) {
    filters = { ...filters, [kind]: null };
  }
  function clearAllFilters() {
    filters = { resource: null, feature: null, improvement: null };
  }

  $: t = pinnedTile ?? hoverTile;

  onMount(() => {
    pageTitle.set('Map');
    if ($meta?.synced_at) loadMap($meta.synced_at);
  });

  function handlePageKey(e) {
    if (e.key !== 'Escape') return;
    if (activeFilterCount > 0) {
      clearAllFilters();
      e.preventDefault();
      return;
    }
    if (pinnedTile) {
      pinnedTile = null;
      e.preventDefault();
    }
  }

  const THEMATIC_LAYERS = [
    { value: 'terrain', label: 'Terrain' },
    { value: 'food', label: 'Food' },
    { value: 'water', label: 'Water' },
    { value: 'energy', label: 'Energy' },
    { value: 'materials', label: 'Materials' },
    { value: 'ore', label: 'Ore' },
    { value: 'housing', label: 'Housing' },
  ];
  const OVERLAY_TABS = [
    { value: 'resources', label: 'Resources' },
    { value: 'features', label: 'Features' },
    { value: 'improvements', label: 'Improvements' },
  ];
  const LAYERS = [...THEMATIC_LAYERS, ...OVERLAY_TABS];
</script>

<section class="px-6 py-5 max-w-[1600px]" tabindex="-1" on:keydown={handlePageKey}>
  {#if $mapError}
    <p class="text-crit">{$mapError}</p>
  {:else if !$map}
    <p class="text-muted text-xs uppercase tracking-widest">Loading map…</p>
  {:else}
    <Band num="01" title="Surface Grid" meta="40 × 40" />

    <div class="layer-tabs">
      {#each LAYERS as l}
        <button
          aria-pressed={layer === l.value}
          on:click={() => (layer = l.value)}
        >
          {l.label}{THEMATIC_LAYERS.some(t => t.value === l.value) && l.value !== 'terrain' ? ' yield' : ''}
        </button>
      {/each}
    </div>

    {#if activeFilterCount > 0}
      <div class="filter-strip">
        {#if filters.resource}
          <span class="filter-chip">
            <span class="swatch" style="background: {$map.palettes.resource[filters.resource] ?? '#fff'}; color:#1a1a1a;">{RESOURCE_CODES[filters.resource] ?? '?'}</span>
            {filters.resource}
            <button aria-label="Clear resource filter" on:click={() => clearFilter('resource')}>✕</button>
          </span>
        {/if}
        {#if filters.feature}
          <span class="filter-chip">
            <span class="swatch" style="background: {$map.palettes.feature[filters.feature] ?? '#fff'}; color:#1a1a1a;">{FEATURE_CODES[filters.feature] ?? '?'}</span>
            {filters.feature}
            <button aria-label="Clear feature filter" on:click={() => clearFilter('feature')}>✕</button>
          </span>
        {/if}
        {#if filters.improvement}
          <span class="filter-chip">
            <span class="swatch" style="background: {$map.palettes.improvement_category[filters.improvement] ?? '#fff'}; color:#1a1a1a;">{CATEGORIES[filters.improvement]?.icon ?? '?'}</span>
            {CATEGORIES[filters.improvement]?.label ?? filters.improvement}
            <button aria-label="Clear improvement filter" on:click={() => clearFilter('improvement')}>✕</button>
          </span>
        {/if}
        <span>· {matchedTiles.length} matches</span>
        <button class="clear-all" on:click={clearAllFilters}>Clear all</button>
      </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3 items-start">
      <MapCanvas
        mapData={$map}
        {layer}
        tab={layer}
        {filters}
        on:hover={(e) => (hoverTile = e.detail)}
        on:pin={(e) => (pinnedTile = e.detail)}
      />

      <aside class="flex flex-col gap-3">
        {#if layer === 'resources' || layer === 'features' || layer === 'improvements'}
          <div class="s-card">
            <RosterPanel
              mapData={$map}
              kind={layer === 'resources' ? 'resource' : layer === 'features' ? 'feature' : 'improvement'}
              {filters}
              on:toggle-filter={(e) => {
                const { kind, value } = e.detail;
                filters = { ...filters, [kind]: filters[kind] === value ? null : value };
              }}
              on:pin={(e) => (pinnedTile = e.detail)}
            />
          </div>
        {/if}
        <div class="s-card">
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
        </div>
      </aside>
    </div>

    <div class="text-muted text-[10px] uppercase tracking-widest mt-3">
      ▣ Improvement · ↗ Resource · ↖ Feature · Color = {layer === 'terrain' ? 'biome' : (THEMATIC_LAYERS.some(t => t.value === layer) ? layer + ' magnitude' : layer)}
    </div>
  {/if}
</section>
