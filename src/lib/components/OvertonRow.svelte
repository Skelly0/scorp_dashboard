<script>
  export let axis;
  export let value;
  export let window = null;

  const AXIS_POLES = {
    expansion:    ['Expansion',    'Conservation'],
    authority:    ['Authoritarian','Democratic'],
    corporate:    ['Corporate',    'Communal'],
    technocratic: ['Technocratic', 'Populist'],
    faith:        ['Faith',        'Reason'],
    materialist:  ['Materialist',  'Idealist'],
  };

  const TICKS = [1, 2, 3, 4, 5, 6, 7];
  const pct = (v) => Math.max(0, Math.min(100, ((v - 1) / 6) * 100));

  $: hasValue = value != null && Number.isFinite(value);
  $: hasWindow = Array.isArray(window) && window.length === 2 && window.every((v) => Number.isFinite(v));
  $: poles = AXIS_POLES[axis] ?? [axis, ''];
</script>

<div class="overton-row">
  <div class="overton-axis overton-axis-left">{poles[0]}</div>
  <div
    class="overton-track"
    role="img"
    aria-label="{poles[0]} to {poles[1]}: value {hasValue ? value.toFixed(1) : 'unknown'}"
  >
    {#each TICKS as t}
      <span class="overton-tick" style="left: {pct(t)}%"></span>
    {/each}
    {#if hasWindow}
      <span class="overton-window" style="left: {pct(window[0])}%; right: {100 - pct(window[1])}%"></span>
    {/if}
    {#if hasValue}
      <span class="overton-marker" style="left: {pct(value)}%"></span>
    {/if}
  </div>
  <div class="overton-axis overton-axis-right">{poles[1]}</div>
  <div class="overton-value">{hasValue ? value.toFixed(1) : '—'}</div>
</div>
