<script>
  export let label;
  export let value;
  export let max = 1;
  export let variant = '';
  export let format = 'fixed2';

  $: pct = value == null || !Number.isFinite(value) ? 0 : Math.max(0, Math.min(1, value / max)) * 100;
  $: displayValue =
    value == null || !Number.isFinite(value)
      ? '—'
      : format === 'pct'
        ? `${(value * 100).toFixed(0)}%`
        : format === 'int'
          ? Math.round(value).toString()
          : value.toFixed(2);
</script>

<div class="bar-row">
  <div class="lbl">{label}</div>
  <div class="bar {variant}">
    <span style="width: {pct}%"></span>
  </div>
  <div class="val">{displayValue}</div>
</div>
