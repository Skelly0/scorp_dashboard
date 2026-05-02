<script>
  export let name;
  export let description;
  export let crisis_factor = null;
  export let ended = false;
</script>

<div class="border-4 border-border p-3" class:opacity-50={ended}>
  <div class="flex justify-between items-baseline mb-1">
    <h4 class="font-mono font-extrabold text-sm uppercase tracking-wider">{name}</h4>
    {#if !ended && crisis_factor != null}
      <span class="text-xs font-bold text-crit uppercase tracking-widest">+{crisis_factor.toFixed(2)} CRISIS</span>
    {:else if ended}
      <span class="text-xs uppercase tracking-widest text-muted">ENDED</span>
    {/if}
  </div>
  <p class="text-sm">{description ?? ''}</p>
</div>
