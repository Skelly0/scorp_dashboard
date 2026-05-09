<script>
  export let label;
  export let value;
  export let sub = '';
  export let delta = null;
  export let details = [];
  export let critical = false;
  export let good = false;

  $: deltaSign = delta != null ? (delta > 0 ? '▲' : delta < 0 ? '▼' : '·') : null;
  $: deltaClass = delta != null ? (delta > 0 ? 'delta up' : delta < 0 ? 'delta down' : 'delta') : '';
  $: valClass = critical ? 'val crit' : good ? 'val good' : 'val';
  $: displayValue = value == null ? '—' : value;
  $: visibleDetails = Array.isArray(details) ? details.filter((detail) => detail?.text) : [];
</script>

<div class="stat-tile" class:s-card={false}>
  <div class="label">{label}</div>
  <div class={valClass}>{displayValue}</div>
  <div class="sub">
    {#if sub}<span>{sub}</span>{/if}
    {#each visibleDetails as detail, i (detail.key ?? `${detail.text}:${i}`)}
      <span class="flow-detail" class:good={detail.tone === 'good'} class:crit={detail.tone === 'crit'}>
        {detail.text}
      </span>
    {/each}
    {#if delta != null}
      <span class={deltaClass}>{deltaSign} {delta > 0 ? '+' : ''}{delta}</span>
    {/if}
  </div>
</div>
