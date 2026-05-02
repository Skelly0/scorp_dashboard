<script>
  /**
   * Generic 0..1 heatmap.
   * @type {string[]}  rowLabels
   * @type {string[]}  colLabels
   * @type {(number|null)[][]} values  - rowLabels.length × colLabels.length
   */
  export let rowLabels = [];
  export let colLabels = [];
  export let values = [];
  export let cellSize = 36;

  function cellColor(v) {
    if (v == null) return 'var(--bg)';
    const t = Math.min(1, Math.max(0, v));
    // Light bg → accent at 1.0
    return `color-mix(in srgb, var(--accent) ${(t * 100).toFixed(0)}%, var(--bg))`;
  }
</script>

<div class="overflow-x-auto">
  <table class="border-collapse font-mono text-xs">
    <thead>
      <tr>
        <th class="border-2 border-border p-1 bg-bg"></th>
        {#each colLabels as c}
          <th class="border-2 border-border p-1 bg-bg uppercase tracking-widest text-[9px] text-muted">
            {c}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rowLabels as r, i}
        <tr>
          <th class="border-2 border-border p-1 bg-bg uppercase tracking-widest text-[9px] text-muted text-right">
            {r}
          </th>
          {#each colLabels as _c, j}
            <td
              class="border-2 border-border text-center"
              style="width: {cellSize}px; height: {cellSize}px; background: {cellColor(values[i]?.[j])}"
              title="{r} × {colLabels[j]} = {values[i]?.[j]?.toFixed(2) ?? '—'}"
            >
              {values[i]?.[j]?.toFixed(2) ?? '—'}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
