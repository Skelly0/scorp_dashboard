<script>
  export let name;
  export let description = '';
  export let crisis_factor = null;
  export let ended = false;
</script>

<div class="sit-card" class:ended>
  <div class="flex justify-between items-baseline gap-2">
    <h4>{ended ? '✓' : '⚠'} {name}</h4>
    {#if !ended && crisis_factor != null}
      <span class="cf">CF {crisis_factor.toFixed(2)}</span>
    {:else if ended}
      <span class="text-muted text-[10px] uppercase tracking-widest">Ended</span>
    {/if}
  </div>
  {#if description}
    <p>{description}</p>
  {/if}
</div>
