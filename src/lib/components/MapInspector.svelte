<script>
  import { createEventDispatcher } from 'svelte';
  import { categoryFor, CATEGORIES } from '../improvement-categories.js';
  import { RESOURCE_CODES, FEATURE_CODES } from '../map-codes.js';
  import { labelForMetricKey } from '../map-metrics.js';
  import { classColor } from '../faction-colors.js';
  import ImprovementCard from './ImprovementCard.svelte';

  export let tile = null;
  export let mapData;
  export let catalog = null;
  export let layer = 'terrain';
  export let nameplate = null;

  const dispatch = createEventDispatcher();

  $: palettes = mapData?.palettes ?? {};
  $: featurePalette = palettes.feature ?? {};
  $: resourcePalette = palettes.resource ?? {};
  $: improvementCategoryPalette = palettes.improvement_category ?? {};

  function truncateDecimal(value, places = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    const factor = 10 ** places;
    return Math.trunc(n * factor) / factor;
  }

  function formatYieldValue(value) {
    return `${value > 0 ? '+' : ''}${truncateDecimal(value, 2)}`;
  }

</script>

{#if !tile}
  <div class="s-card-pad">
    <p class="text-muted text-xs uppercase tracking-widest">Hover or click a tile to inspect.</p>
  </div>
{:else}
  <div class="s-card-header">
    <h3>Tile · ({String(tile.x).padStart(2, '0')}, {String(tile.y).padStart(2, '0')})</h3>
    <span class="meta">{layer}</span>
  </div>
  <div class="s-card-pad">
    <dl class="kv">
      <dt>Terrain</dt><dd>{tile.terrain ?? '—'}</dd>
      <dt>Feature</dt>
      <dd>
        {#if tile.feature}
          <span class="swatch" style="background: {featurePalette[tile.feature] ?? '#fff'}; color:#1a1a1a;">{FEATURE_CODES[tile.feature] ?? '?'}</span>
          {tile.feature}
        {:else}—{/if}
      </dd>
      <dt>Resource</dt>
      <dd>
        {#if tile.resource}
          <span class="swatch" style="background: {resourcePalette[tile.resource] ?? '#fff'}; color:#1a1a1a;">{RESOURCE_CODES[tile.resource] ?? '?'}</span>
          {tile.resource}
        {:else}—{/if}
      </dd>
      <dt>Slots</dt><dd>{tile.slots ?? '—'}</dd>
    </dl>
    {#if tile.improvement}
      {@const cat = categoryFor(tile.improvement, catalog) ?? CATEGORIES.other}
      <div class="kv-section">
        <h4>
          <span style="color: {improvementCategoryPalette[cat.slug] ?? 'var(--accent)'}">{cat.icon}</span>
          Improvement
        </h4>
        <dl class="kv">
          <dt>Improvement Type</dt><dd>{tile.improvement.name ?? '—'}</dd>
          <dt>Control</dt><dd>{tile.control ?? tile.improvement.owner ?? '—'}</dd>
        </dl>
        <button
          class="filter-link"
          on:click={() => dispatch('filter-category', { slug: cat.slug })}
        >Filter by {cat.icon} {cat.label}</button>
      </div>
      {#if nameplate}
        <div class="kv-section">
          <h4>Nameplate stats</h4>
          <ImprovementCard imp={nameplate} compact={true} />
        </div>
      {/if}
    {/if}
    {#if tile.yields && Object.values(tile.yields).some((v) => v !== 0 && v != null)}
      <div class="kv-section">
        <h4>Yields</h4>
        <dl class="kv">
          {#each Object.entries(tile.yields).filter(([_, v]) => v !== 0 && v != null) as [k, v]}
            <dt>{labelForMetricKey(k)}</dt>
            <dd class={v < 0 ? 'crit' : v > 0 ? 'good' : ''}>{formatYieldValue(v)}</dd>
          {/each}
        </dl>
      </div>
    {/if}

    {#if tile.upkeep && Object.values(tile.upkeep).some((v) => v != null && v !== 0)}
      <div class="kv-section">
        <h4>Upkeep</h4>
        <dl class="kv">
          {#each Object.entries(tile.upkeep).filter(([_, v]) => v != null && v !== 0) as [k, v]}
            <dt>{labelForMetricKey(k)}</dt>
            <dd class="crit">{truncateDecimal(v, 2)}</dd>
          {/each}
        </dl>
      </div>
    {/if}

    {#if tile.workforce && Object.keys(tile.workforce).length > 0}
      <div class="kv-section">
        <h4>Workforce</h4>
        {#each Object.entries(tile.workforce).sort(([, a], [, b]) => b - a) as [name, count]}
          <div class="workforce-row">
            <span class="swatch" style="background: {classColor(name)}"></span>
            <span class="name">{name}</span>
            <span class="count">{count}</span>
          </div>
        {/each}
      </div>
    {/if}

    {#if tile.staffing != null}
      <div class="kv-section">
        <h4>Staffing Efficiency</h4>
        <div class="staff-meter">
          <div class="staff-meter-fill" style="width: {(tile.staffing * 100).toFixed(0)}%"></div>
        </div>
        <div class="staff-meter-pct">{(tile.staffing * 100).toFixed(0)}%</div>
      </div>
    {/if}
  </div>
{/if}
