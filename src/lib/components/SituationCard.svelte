<script>
  export let name;
  export let description = '';
  export let crisis_factor = null;
  export let ended = false;

  $: pct = crisis_factor != null
    ? Math.max(0, Math.min(100, Number(crisis_factor) * 100))
    : null;
  $: severity =
    crisis_factor == null ? 'low'
    : crisis_factor >= 0.6 ? 'crit'
    : crisis_factor >= 0.3 ? 'warn'
    : 'low';
</script>

<div class="sit-card sev-{severity}" class:ended>
  <div class="flex justify-between items-baseline gap-2">
    <h3>{ended ? '✓' : '⚠'} {name}</h3>
    {#if !ended && crisis_factor != null}
      <span class="cf tnum">Load {crisis_factor.toFixed(2)}</span>
    {:else if ended}
      <span class="text-muted text-[10px] uppercase tracking-widest">Ended</span>
    {/if}
  </div>
  {#if description}
    <p>{description}</p>
  {/if}
  {#if !ended && pct != null}
    <div class="sit-meter" aria-hidden="true">
      <div class="sit-meter-fill" style="width: {pct}%"></div>
    </div>
  {/if}
</div>
