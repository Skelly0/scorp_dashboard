<script>
  // The mockup's at-a-glance stat strip under the page header. Presentational —
  // callers pass already-formatted, data-driven {label, value, tone?} cells.
  /** @type {Array<{label: string, value: string, tone?: 'warn'|'good'|'crit'|null}>} */
  export let items = [];
</script>

<div class="readout-strip">
  {#each items as it}
    <div class="readout-cell">
      <span class="readout-label">{it.label}</span>
      <span class="readout-value" class:warn={it.tone === 'warn'} class:good={it.tone === 'good'} class:crit={it.tone === 'crit'}>{it.value}</span>
    </div>
  {/each}
</div>

<style>
  .readout-strip {
    display: flex;
    flex-wrap: wrap;
    border: 1px solid var(--border-soft);
    margin-bottom: 16px;
    overflow: hidden;
  }
  .readout-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 18px;
    border-right: 1px solid var(--border-soft);
  }
  .readout-label {
    font-size: 8.5px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .readout-value {
    font-size: 14px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--fg);
  }
  .readout-value.warn { color: var(--warn); }
  .readout-value.good { color: var(--good); }
  .readout-value.crit { color: var(--crit); }
</style>
