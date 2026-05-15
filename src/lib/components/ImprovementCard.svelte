<script>
  import { CATEGORIES } from '../improvement-categories.js';
  import { labelForMetricKey } from '../map-metrics.js';

  /** @type {object} */
  export let imp;
  /** Compact mode hides empty rows entirely (used in tile inspector). */
  export let compact = false;

  $: cat = CATEGORIES[imp.category] ?? CATEGORIES.other;
  $: costChips = chipsFromMap(imp.costs, { skipZero: true });
  $: yieldChips = chipsFromMap(imp.yields, { skipZero: true, signed: true });
  $: upkeepChips = chipsFromMap(imp.upkeep, { skipZero: true, upkeep: true });
  $: workforceChips = chipsFromMap(imp.workforce, { skipZero: true });
  $: splitChips = chipsFromSplits(imp.splits);

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
        label: labelForMetricKey(k),
        value: v,
        klass: classFor(v, opts),
      }));
  }

  function chipsFromSplits(splits) {
    if (!splits) return [];
    return Object.entries(splits)
      .filter(([, v]) => v != null && v > 0)
      .map(([k, v]) => ({
        key: k,
        label: prettyKey(k),
        pct: Math.round(v * 100),
      }));
  }

  function classFor(v, opts) {
    if (opts.upkeep) return 'upkeep';
    if (opts.signed) return v > 0 ? 'pos' : v < 0 ? 'neg' : '';
    return '';
  }

  function prettyKey(k) {
    return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatNumber(v) {
    if (v == null) return '—';
    if (Number.isInteger(v)) return v.toLocaleString();
    return Number(v).toFixed(2).replace(/\.?0+$/, '');
  }
</script>

<article class="cat-card" style="--cat-color: {cat.color};">
  <header class="cat-card-title">
    <span class="cat-card-name">{imp.name}</span>
    <span class="cat-card-cat" title="{cat.label} category">
      <span class="cat-card-cat-icon" aria-hidden="true">{cat.icon}</span>
      <span class="cat-card-cat-label">{cat.label}</span>
    </span>
  </header>

  {#if costChips.length}
    <div class="cat-card-section">
      <span class="cat-card-section-label">Cost</span>
      <div class="cat-card-row">
        {#each costChips as c (c.key)}
          <span class="cat-chip" title={c.label}>
            <span class="cat-chip-label">{c.label}</span>
            <span class="cat-chip-value">{formatNumber(c.value)}</span>
          </span>
        {/each}
      </div>
    </div>
  {:else if !compact}
    <div class="cat-card-section">
      <span class="cat-card-section-label">Cost</span>
      <div class="cat-card-row"><span class="cat-card-notes">No build cost.</span></div>
    </div>
  {/if}

  {#if yieldChips.length}
    <div class="cat-card-section">
      <span class="cat-card-section-label">Yields</span>
      <div class="cat-card-row">
        {#each yieldChips as c (c.key)}
          <span class="cat-chip {c.klass}" title={c.label}>
            <span class="cat-chip-label">{c.label}</span>
            <span class="cat-chip-value">{c.value > 0 ? '+' : ''}{formatNumber(c.value)}</span>
          </span>
        {/each}
      </div>
    </div>
  {/if}

  {#if upkeepChips.length}
    <div class="cat-card-section">
      <span class="cat-card-section-label">Upkeep</span>
      <div class="cat-card-row">
        {#each upkeepChips as c (c.key)}
          <span class="cat-chip upkeep" title="{c.label} upkeep">
            <span class="cat-chip-label">{c.label}</span>
            <span class="cat-chip-value">−{formatNumber(c.value)}</span>
          </span>
        {/each}
      </div>
    </div>
  {/if}

  {#if workforceChips.length}
    <div class="cat-card-section">
      <span class="cat-card-section-label">Workforce</span>
      <div class="cat-card-row">
        {#each workforceChips as c (c.key)}
          <span class="cat-chip" title={c.label}>
            <span class="cat-chip-label">{c.label}</span>
            <span class="cat-chip-value">×{formatNumber(c.value)}</span>
          </span>
        {/each}
      </div>
    </div>
  {/if}

  {#if splitChips.length}
    <div class="cat-card-section">
      <span class="cat-card-section-label">Output split</span>
      <div class="cat-card-row">
        {#each splitChips as c (c.key)}
          <span class="cat-chip" title="{c.label} share">
            <span class="cat-chip-label">{c.label}</span>
            <span class="cat-chip-value">{c.pct}%</span>
          </span>
        {/each}
      </div>
    </div>
  {/if}

  {#if imp.terrain_compat || imp.ownership_options}
    <footer class="cat-card-foot">
      {#if imp.terrain_compat}<div><span class="cat-card-foot-label">Terrain</span> {imp.terrain_compat}</div>{/if}
      {#if imp.ownership_options}<div><span class="cat-card-foot-label">Ownership</span> {imp.ownership_options}</div>{/if}
    </footer>
  {/if}
</article>
