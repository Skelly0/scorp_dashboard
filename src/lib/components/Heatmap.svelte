<script>
  export let rowLabels = [];
  export let colLabels = [];
  export let values = [];
  export let format = 'pct';
  export let rowHeadWidth = 140;
  export let minCellWidth = 46;

  $: max = Math.max(...values.flat().filter((v) => v != null && Number.isFinite(v)), 0.0001);

  function fmt(v) {
    if (v == null || !Number.isFinite(v)) return '—';
    if (format === 'pct') return `${Math.round(v * 100)}`;
    return v.toFixed(2);
  }

  function cellColor(v) {
    if (v == null || !Number.isFinite(v)) return 'var(--bg-2)';
    const t = Math.max(0, Math.min(1, v / max));
    if (t < 0.05) return 'var(--bg-2)';
    return `color-mix(in srgb, var(--accent) ${(t * 90).toFixed(0)}%, var(--bg-2))`;
  }

  function cellFg(v) {
    if (v == null || !Number.isFinite(v)) return 'var(--muted)';
    const t = Math.max(0, Math.min(1, v / max));
    return t > 0.55 ? 'var(--alert-fg)' : 'var(--fg)';
  }
</script>

<div class="overflow-x-auto">
  <div
    class="heatmap"
    style="grid-template-columns: {rowHeadWidth}px repeat({colLabels.length}, minmax({minCellWidth}px, 1fr));"
  >
    <div class="heatmap-cell head"></div>
    {#each colLabels as c}
      <div class="heatmap-cell head">{c}</div>
    {/each}
    {#each rowLabels as r, ri}
      <div class="heatmap-cell head row-head">{r}</div>
      {#each colLabels as _c, ci}
        {@const v = values[ri]?.[ci]}
        <div
          class="heatmap-cell"
          style="background: {cellColor(v)}; color: {cellFg(v)};"
          title="{r} × {colLabels[ci]} = {fmt(v)}"
        >
          {fmt(v)}
        </div>
      {/each}
    {/each}
  </div>
</div>
