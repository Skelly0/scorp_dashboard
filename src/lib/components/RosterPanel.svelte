<script>
  import { createEventDispatcher } from 'svelte';
  import { CATEGORIES, getCategorySlug } from '../improvement-categories.js';
  import { RESOURCE_CODES, FEATURE_CODES } from '../map-codes.js';

  /** @type {{tiles: any[], palettes: any}} */
  export let mapData;
  /** "resource" | "feature" | "improvement" */
  export let kind;
  /** Catalog store value — passed in from Map.svelte. May be null. */
  export let catalog = null;
  /** Current filters object — used to indicate selected state on rows. */
  export let filters;

  const dispatch = createEventDispatcher();

  $: rows = buildRows(mapData, kind, catalog);

  function buildRows(map, kind, cat) {
    if (!map) return [];
    if (kind === 'resource') return aggregateByField(map.tiles, 'resource');
    if (kind === 'feature')  return aggregateByField(map.tiles, 'feature');
    if (kind === 'improvement') return groupImprovements(map.tiles, cat);
    return [];
  }
  function aggregateByField(tiles, field) {
    const counts = new Map();
    for (const t of tiles) {
      if (!t[field]) continue;
      counts.set(t[field], (counts.get(t[field]) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }
  function groupImprovements(tiles, cat) {
    const groups = new Map();
    for (const t of tiles) {
      if (!t.improvement) continue;
      const slug = getCategorySlug(t.improvement.name, cat);
      if (!groups.has(slug)) groups.set(slug, []);
      groups.get(slug).push({ tile: t });
    }
    return Array.from(groups.entries())
      .sort((a, b) => (CATEGORIES[a[0]]?.label ?? '').localeCompare(CATEGORIES[b[0]]?.label ?? ''))
      .map(([slug, items]) => ({ slug, ...CATEGORIES[slug], items }));
  }

  function toggleResource(name) { dispatch('toggle-filter', { kind: 'resource', value: name }); }
  function toggleFeature(name)  { dispatch('toggle-filter', { kind: 'feature',  value: name }); }
  function toggleImprovementCategory(slug) { dispatch('toggle-filter', { kind: 'improvement', value: slug }); }
  function pinTile(tile) { dispatch('pin', tile); }
</script>

{#if !mapData}
  <div class="roster-empty">—</div>
{:else if kind === 'resource'}
  <div class="s-card-header">
    <h3>Resources</h3>
    <span class="meta">{rows.length} types</span>
  </div>
  <div class="s-card-pad">
    {#if rows.length === 0}
      <div class="roster-empty">No resources on this map.</div>
    {:else}
      {#each rows as r}
        <button
          class="roster-row"
          aria-pressed={filters?.resource === r.name}
          on:click={() => toggleResource(r.name)}
        >
          <span class="swatch" style="background: {mapData.palettes.resource?.[r.name] ?? '#fff'}; color:#1a1a1a;">{RESOURCE_CODES[r.name] ?? '?'}</span>
          <span class="name">{r.name}</span>
          <span class="meta">{r.count}</span>
        </button>
      {/each}
    {/if}
  </div>
{:else if kind === 'feature'}
  <div class="s-card-header">
    <h3>Features</h3>
    <span class="meta">{rows.length} types</span>
  </div>
  <div class="s-card-pad">
    {#if rows.length === 0}
      <div class="roster-empty">No features on this map.</div>
    {:else}
      {#each rows as r}
        <button
          class="roster-row"
          aria-pressed={filters?.feature === r.name}
          on:click={() => toggleFeature(r.name)}
        >
          <span class="swatch" style="background: {mapData.palettes.feature?.[r.name] ?? '#fff'}; color:#1a1a1a;">{FEATURE_CODES[r.name] ?? '?'}</span>
          <span class="name">{r.name}</span>
          <span class="meta">{r.count}</span>
        </button>
      {/each}
    {/if}
  </div>
{:else if kind === 'improvement'}
  <div class="s-card-header">
    <h3>Improvements</h3>
    <span class="meta">{rows.reduce((n, g) => n + g.items.length, 0)} total</span>
  </div>
  <div class="s-card-pad">
    {#if rows.length === 0}
      <div class="roster-empty">No improvements built yet.</div>
    {:else}
      {#each rows as group}
        <div class="roster-section">
          <button
            class="roster-section-header"
            aria-pressed={filters?.improvement === group.slug}
            on:click={() => toggleImprovementCategory(group.slug)}
          >
            <span>{group.icon}</span>
            <span style="flex:1;">{group.label}</span>
            <span class="meta">{group.items.length}</span>
          </button>
          {#each group.items as { tile }}
            <button class="roster-row" on:click={() => pinTile(tile)}>
              <span class="name">▣ {tile.improvement.name}</span>
              <span class="meta">({String(tile.x).padStart(2,'0')}, {String(tile.y).padStart(2,'0')})</span>
            </button>
          {/each}
        </div>
      {/each}
    {/if}
  </div>
{/if}
