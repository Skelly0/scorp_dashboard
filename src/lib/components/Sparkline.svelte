<script>
  export let data = [];
  export let color = 'var(--accent)';
  export let height = 28;
  export let width = 120;

  $: clean = data.filter((v) => v != null && Number.isFinite(v));
  $: min = clean.length ? Math.min(...clean) : 0;
  $: max = clean.length ? Math.max(...clean) : 0;
  $: range = max - min || 1;
  $: pts = clean
    .map((v, i) => {
      const x = (i / (clean.length - 1 || 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  $: areaPts = clean.length > 1 ? `0,${height} ${pts} ${width},${height}` : '';
</script>

{#if clean.length >= 2}
  <svg class="spark" viewBox="0 0 {width} {height}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points={areaPts} fill={color} opacity="0.12" stroke="none" />
    <polyline points={pts} fill="none" stroke={color} stroke-width="1.5" />
  </svg>
{:else if clean.length === 1}
  <span class="text-muted text-[10px] uppercase tracking-widest">single sample</span>
{:else}
  <span class="text-muted text-[10px] uppercase tracking-widest">no history</span>
{/if}
