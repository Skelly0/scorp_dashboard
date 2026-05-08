<script>
  import { CATEGORIES } from '../improvement-categories.js';

  /** @type {object} */
  export let imp;
  /** Compact mode hides empty rows entirely (used in tile inspector). */
  export let compact = false;

  $: cat = CATEGORIES[imp.category] ?? CATEGORIES.other;
  $: costChips = chipsFromMap(imp.costs, { skipZero: true });
  $: yieldChips = chipsFromMap(imp.yields, { skipZero: true, signed: true });
  $: upkeepChips = chipsFromMap(imp.upkeep, { skipZero: true, upkeep: true });
  $: workforceChips = chipsFromMap(imp.workforce, { skipZero: true });
  $: hasSplits = imp.splits && Object.values(imp.splits).some(v => v != null);

  function chipsFromMap(obj, opts) {
    if (!obj) return [];
    return Object.entries(obj)
      .filter(([, v]) => {
        if (v === null || v === undefined) return false;
        if (opts.skipZero && v === 0) return false;
        return true;
      })
      .map(([k, v]) => ({
        key: k,
        label: prettyKey(k),
        value: v,
        klass: classFor(v, opts),
      }));
  }

  function classFor(v, opts) {
    if (opts.upkeep) return 'upkeep';
    if (opts.signed) return v > 0 ? 'pos' : v < 0 ? 'neg' : '';
    return '';
  }

  function prettyKey(k) {
    return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function formatNumber(v) {
    if (v == null) return '—';
    if (Number.isInteger(v)) return String(v);
    return Number(v).toFixed(2).replace(/\.?0+$/, '');
  }
</script>

<article class="cat-card">
  <header class="cat-card-title">
    <span>▣ {imp.name}</span>
    <span aria-hidden="true">{cat.icon}</span>
  </header>

  {#if costChips.length || !compact}
    <div class="cat-card-row" aria-label="Costs">
      {#each costChips as c (c.key)}
        <span class="cat-chip" title={c.label}>{c.label[0]} {formatNumber(c.value)}</span>
      {/each}
      {#if costChips.length === 0 && !compact}
        <span class="cat-card-notes">No build cost.</span>
      {/if}
    </div>
  {/if}

  {#if yieldChips.length}
    <div class="cat-card-row" aria-label="Yields">
      {#each yieldChips as c (c.key)}
        <span class="cat-chip {c.klass}" title="{c.label}">
          {c.label} {c.value > 0 ? '+' : ''}{formatNumber(c.value)}
        </span>
      {/each}
    </div>
  {/if}

  {#if upkeepChips.length}
    <div class="cat-card-row" aria-label="Upkeep">
      {#each upkeepChips as c (c.key)}
        <span class="cat-chip upkeep" title="{c.label} upkeep">−{c.label[0]}{formatNumber(c.value)}</span>
      {/each}
    </div>
  {/if}

  {#if workforceChips.length}
    <div class="cat-card-row" aria-label="Workforce">
      {#each workforceChips as c (c.key)}
        <span class="cat-chip" title={c.label}>{c.label}×{formatNumber(c.value)}</span>
      {/each}
    </div>
  {/if}

  {#if hasSplits}
    <div class="cat-card-row" aria-label="Food splits">
      {#each Object.entries(imp.splits) as [k, v] (k)}
        {#if v != null && v > 0}
          <span class="cat-chip" title="{prettyKey(k)} share">
            {prettyKey(k)} {Math.round(v * 100)}%
          </span>
        {/if}
      {/each}
    </div>
  {/if}

  {#if imp.terrain_compat || imp.ownership_options}
    <div class="cat-card-notes">
      {#if imp.terrain_compat}<div>Terrain: {imp.terrain_compat}</div>{/if}
      {#if imp.ownership_options}<div>Ownership: {imp.ownership_options}</div>{/if}
    </div>
  {/if}
</article>
