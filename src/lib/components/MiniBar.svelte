<script>
  // Thin proportional bar used inside drill-down rows, resource rows and the
  // situation ticker. `frac` is 0..1; `color` is any CSS colour/var. Decorative.
  export let frac = 0;
  export let color = 'var(--accent)';
  export let height = 6;
  $: pct = Math.max(0, Math.min(1, Number(frac) || 0)) * 100;
</script>

<div class="mini-bar" style="--mb-h:{height}px" aria-hidden="true">
  <span style="width:{pct.toFixed(1)}%; background:{color}"></span>
</div>

<style>
  .mini-bar {
    position: relative;
    height: var(--mb-h, 6px);
    background: var(--bg-2);
    border: 1px solid var(--border-soft);
  }
  .mini-bar span {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    display: block;
  }
</style>
