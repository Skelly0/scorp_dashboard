<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { map, mapError, loadMap } from '../lib/stores/map.js';
  import { pageTitle } from '../lib/page-title.js';
  import { theme } from '../lib/theme.js';
  import { getCategorySlug, CATEGORIES } from '../lib/improvement-categories.js';
  import { catalog } from '../lib/stores/catalog.js';
  import { RESOURCE_CODES, FEATURE_CODES } from '../lib/map-codes.js';
  import {
    ZOOM_MIN,
    ZOOM_MAX,
    ZOOM_DEFAULT,
    stepZoom,
    scaleZoom,
    resetZoom,
    readZoom,
    writeZoom,
  } from '../lib/map-zoom.js';
  import Band from '../lib/components/Band.svelte';
  import MapCanvas from '../lib/components/MapCanvas.svelte';
  import RosterPanel from '../lib/components/RosterPanel.svelte';
  import LayerMenu from '../lib/components/LayerMenu.svelte';
  import CatalogModal from '../lib/components/CatalogModal.svelte';
  import MapInspector from '../lib/components/MapInspector.svelte';
  import MapBottomSheet from '../lib/components/MapBottomSheet.svelte';
  import { resolveImprovementRow } from '../lib/stores/catalog.js';

  let catalogOpen = false;

  let layer = 'terrain';
  let lastSubByCategory = { yield: 'food', upkeep: 'food', workforce: 'Engineers' };
  let zoom = ZOOM_DEFAULT;   // overwritten in onMount once localStorage is available
  let zoomReady = false;     // gates the persistence reactive so we don't overwrite stored value with the default on first tick
  let hoverTile = null;
  let pinnedTile = null;
  let isMobileInspector = false;
  let filters = { resource: null, feature: null, improvement: null };

  const YIELD_OPTIONS = [
    { key: 'food',     label: 'Food' },
    { key: 'water',    label: 'Water' },
    { key: 'energy',   label: 'Energy' },
    { key: 'materials',label: 'Materials' },
    { key: 'ore',      label: 'Ore' },
    { key: 'housing',  label: 'Housing' },
  ];
  const UPKEEP_OPTIONS = YIELD_OPTIONS;  // same set of resources

  $: parsedLayer = (() => {
    if (!layer || !layer.includes(':')) return { category: layer, key: null };
    const [category, ...rest] = layer.split(':');
    return { category, key: rest.join(':') };
  })();

  $: if (parsedLayer.category && parsedLayer.key) {
    lastSubByCategory[parsedLayer.category] = parsedLayer.key;
  }

  $: workforceOptions = (() => {
    if (!$map) return [];
    const present = new Set();
    for (const tile of $map.tiles) {
      if (tile.workforce) for (const k of Object.keys(tile.workforce)) present.add(k);
    }
    return [...present].sort().map((k) => ({ key: k, label: k }));
  })();

  $: activeFilterCount = (filters.resource ? 1 : 0) + (filters.feature ? 1 : 0) + (filters.improvement ? 1 : 0);
  $: matchedTiles = $map ? $map.tiles.filter(t => tileMatchesFilters(t, filters)) : [];

  function selectLayer(layerId) {
    layer = layerId;
  }

  function tileMatchesFilters(t, f) {
    if (f.resource && t.resource !== f.resource) return false;
    if (f.feature && t.feature !== f.feature) return false;
    if (f.improvement) {
      if (!t.improvement) return false;
      return getCategorySlug(t.improvement.name, $catalog) === f.improvement;
    }
    return true;
  }

  function clearFilter(kind) {
    filters = { ...filters, [kind]: null };
  }
  function clearAllFilters() {
    filters = { resource: null, feature: null, improvement: null };
  }
  function filterByImprovementCategory(slug) {
    filters = { ...filters, improvement: slug };
    layer = 'improvements';
  }

  $: t = pinnedTile ?? hoverTile;
  $: nameplate = t?.improvement ? resolveImprovementRow(t.improvement.name, $catalog) : null;

  function truncateDecimal(value, places = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    const factor = 10 ** places;
    return Math.trunc(n * factor) / factor;
  }

  function formatYieldValue(value) {
    return `${value > 0 ? '+' : ''}${truncateDecimal(value, 2)}`;
  }

  onMount(() => {
    pageTitle.set('Map');
    if ($meta?.synced_at) loadMap($meta.synced_at);
    zoom = readZoom();
    zoomReady = true;

    const inspectorMedia = window.matchMedia('(max-width: 767px)');
    const updateInspectorViewport = () => {
      isMobileInspector = inspectorMedia.matches;
    };

    updateInspectorViewport();
    inspectorMedia.addEventListener('change', updateInspectorViewport);

    return () => {
      inspectorMedia.removeEventListener('change', updateInspectorViewport);
    };
  });

  $: if (zoomReady) writeZoom(zoom);

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
</script>

<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px]" tabindex="-1" on:keydown={handlePageKey}>
  {#if $mapError}
    <p class="text-crit">{$mapError}</p>
  {:else if !$map}
    <p class="text-muted text-xs uppercase tracking-widest">Loading map…</p>
  {:else}
    <Band num="01" title="Surface Grid" meta="40 × 40" />

    <div class="flex items-center gap-3 mb-2">
      <div class="layer-tabs">
        <button
          aria-pressed={layer === 'terrain'}
          on:click={() => selectLayer('terrain')}
        >Terrain</button>

        <LayerMenu
          label="Yields"
          category="yield"
          options={YIELD_OPTIONS}
          activeKey={parsedLayer.category === 'yield' ? parsedLayer.key : null}
          defaultKey={lastSubByCategory.yield}
          on:select={(e) => selectLayer(e.detail.layerId)}
        />

        {#if $map?.available_categories?.upkeep}
          <LayerMenu
            label="Upkeep"
            category="upkeep"
            options={UPKEEP_OPTIONS}
            activeKey={parsedLayer.category === 'upkeep' ? parsedLayer.key : null}
            defaultKey={lastSubByCategory.upkeep}
            on:select={(e) => selectLayer(e.detail.layerId)}
          />
        {/if}

        {#if $map?.available_categories?.workforce}
          <LayerMenu
            label="Workforce"
            category="workforce"
            options={workforceOptions}
            activeKey={parsedLayer.category === 'workforce' ? parsedLayer.key : null}
            defaultKey={lastSubByCategory.workforce}
            on:select={(e) => selectLayer(e.detail.layerId)}
          />
        {/if}

        {#if $map?.available_categories?.staffing}
          <button
            aria-pressed={layer === 'staffing'}
            on:click={() => selectLayer('staffing')}
          >Staffing</button>
        {/if}

        <span class="layer-tabs-divider" aria-hidden="true"></span>

        <button aria-pressed={layer === 'resources'} on:click={() => selectLayer('resources')}>Resources</button>
        <button aria-pressed={layer === 'features'} on:click={() => selectLayer('features')}>Features</button>
        <button aria-pressed={layer === 'improvements'} on:click={() => selectLayer('improvements')}>Improvements</button>
        <button aria-pressed={layer === 'control'} on:click={() => selectLayer('control')}>Control</button>

        <div class="s-zoom" role="group" aria-label="Map zoom">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={zoom <= ZOOM_MIN}
            on:click={() => { zoom = stepZoom(zoom, -1); }}
          >−</button>
          <button
            type="button"
            aria-label="Reset zoom to {Math.round(ZOOM_DEFAULT * 100)} percent"
            aria-pressed={zoom === ZOOM_DEFAULT}
            on:click={() => { zoom = resetZoom(); }}
          >{Math.round(zoom * 100)}%</button>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={zoom >= ZOOM_MAX}
            on:click={() => { zoom = stepZoom(zoom, +1); }}
          >+</button>
        </div>
      </div>
      {#if $catalog && $catalog.improvements.length > 0}
        <button
          class="s-chip ml-auto"
          on:click={() => (catalogOpen = true)}
          aria-label="Open improvement catalog"
        >
          ⌬ Catalog
        </button>
      {/if}
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

    <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start">
      <MapCanvas
        mapData={$map}
        {layer}
        tab={parsedLayer.category}
        {filters}
        {zoom}
        redrawKey={$theme}
        on:hover={(e) => (hoverTile = e.detail)}
        on:pin={(e) => (pinnedTile = e.detail)}
        on:zoomstep={(e) => {
          if (e.detail.reset) zoom = resetZoom();
          else if (e.detail.mode === 'scale') zoom = scaleZoom(zoom, e.detail.delta);
          else zoom = stepZoom(zoom, e.detail.delta);
        }}
      />

      <aside class="flex flex-col gap-3">
        {#if layer === 'resources' || layer === 'features' || layer === 'improvements'}
          <div class="s-card">
            <RosterPanel
              mapData={$map}
              kind={layer === 'resources' ? 'resource' : layer === 'features' ? 'feature' : 'improvement'}
              {filters}
              catalog={$catalog}
              on:toggle-filter={(e) => {
                const { kind, value } = e.detail;
                filters = { ...filters, [kind]: filters[kind] === value ? null : value };
              }}
              on:pin={(e) => (pinnedTile = e.detail)}
            />
          </div>
        {/if}
        <div class="s-card hidden md:block">
          <MapInspector
            tile={t}
            mapData={$map}
            catalog={$catalog}
            {layer}
            {nameplate}
            on:filter-category={(e) => filterByImprovementCategory(e.detail.slug)}
          />
        </div>
      </aside>
    </div>

    {#if pinnedTile && isMobileInspector}
      <MapBottomSheet on:dismiss={() => (pinnedTile = null)}>
        <MapInspector
          tile={pinnedTile}
          mapData={$map}
          catalog={$catalog}
          {layer}
          {nameplate}
          on:filter-category={(e) => {
            filterByImprovementCategory(e.detail.slug);
            pinnedTile = null;
          }}
        />
      </MapBottomSheet>
    {/if}

    <div class="text-muted text-[10px] uppercase tracking-widest mt-3">
      ▣ Improvement · ↗ Resource · ↖ Feature · Color =
      {#if layer === 'terrain'}biome
      {:else if parsedLayer.category === 'yield'}{parsedLayer.key} yield magnitude
      {:else if parsedLayer.category === 'upkeep'}{parsedLayer.key} upkeep magnitude
      {:else if parsedLayer.category === 'workforce'}{parsedLayer.key} count
      {:else if parsedLayer.category === 'staffing'}staffing efficiency (red→amber→green)
      {:else if layer === 'control'}control
      {:else}{layer}{/if}
    </div>

    {#if catalogOpen}
      <CatalogModal on:close={() => (catalogOpen = false)} />
    {/if}
  {/if}
</section>
