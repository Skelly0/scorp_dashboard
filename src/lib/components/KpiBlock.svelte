<script>
  import Sparkline from './Sparkline.svelte';

  export let label;
  export let value;
  export let prefix = '';
  export let suffix = '';
  export let subtitle = null;
  export let delta = null;
  export let critical = false;
  export let good = false;
  export let tone = null;
  export let history = null;
  export let sparkColor = null;

  const TONE_COLORS = {
    crit: 'var(--crit)',
    warn: 'var(--warn)',
    good: 'var(--good)',
  };

  $: deltaSign = delta != null ? (delta > 0 ? '▲' : delta < 0 ? '▼' : '·') : null;
  $: deltaClass = delta != null ? (delta > 0 ? 'delta up' : delta < 0 ? 'delta down' : 'delta') : '';
  $: explicitTone = TONE_COLORS[tone] ? tone : null;
  $: resolvedTone = explicitTone ?? (critical ? 'crit' : good ? 'good' : null);
  $: blockClass = resolvedTone ? `kpi-block tone-${resolvedTone}` : 'kpi-block';
  $: numClass = resolvedTone ? `kpi-num ${resolvedTone}` : 'kpi-num';
  $: resolvedSparkColor = sparkColor ?? TONE_COLORS[resolvedTone] ?? 'var(--accent)';
  $: displayValue = value == null ? '—' : value;
</script>

<div class={blockClass} class:critical>
  <div class="kpi-label">{label}</div>
  <div class={numClass}>{prefix}{displayValue}{suffix}</div>
  {#if subtitle}
    <div class="kpi-subtitle">{subtitle}</div>
  {/if}
  <div class="kpi-foot">
    {#if delta != null}
      <span class={deltaClass}>{deltaSign} {delta > 0 ? '+' : ''}{delta}</span>
    {/if}
    {#if delta != null && history}<span class="text-muted">·</span>{/if}
    {#if history}
      <Sparkline data={history} color={resolvedSparkColor} />
    {/if}
  </div>
</div>
