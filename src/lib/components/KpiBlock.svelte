<script>
  import Sparkline from './Sparkline.svelte';

  export let label;
  export let value;
  export let prefix = '';
  export let suffix = '';
  export let delta = null;
  export let critical = false;
  export let good = false;
  export let history = null;
  export let sparkColor = null;

  $: deltaSign = delta != null ? (delta > 0 ? '▲' : delta < 0 ? '▼' : '·') : null;
  $: deltaClass = delta != null ? (delta > 0 ? 'delta up' : delta < 0 ? 'delta down' : 'delta') : '';
  $: numClass = critical ? 'kpi-num crit' : good ? 'kpi-num good' : 'kpi-num';
  $: displayValue = value == null ? '—' : value;
</script>

<div class="kpi-block" class:critical>
  <div class="kpi-label">{label}</div>
  <div class={numClass}>{prefix}{displayValue}{suffix}</div>
  <div class="kpi-foot">
    {#if delta != null}
      <span class={deltaClass}>{deltaSign} {delta > 0 ? '+' : ''}{delta}</span>
    {/if}
    {#if delta != null && history}<span class="text-muted">·</span>{/if}
    {#if history}
      <Sparkline data={history} color={sparkColor ?? (critical ? 'var(--crit)' : good ? 'var(--good)' : 'var(--accent)')} />
    {/if}
  </div>
</div>
