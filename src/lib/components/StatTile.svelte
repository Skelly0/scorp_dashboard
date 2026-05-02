<script>
  export let label;
  export let value;
  export let delta = null;
  export let critical = false;
</script>

<div
  class="border-2 border-border bg-bg p-3 flex flex-col gap-1"
  class:border-crit={critical}
>
  <div class="text-[9px] uppercase tracking-[3px] text-muted">{label}</div>
  <div
    class="font-mono text-2xl font-extrabold leading-none"
    class:text-crit={critical}
  >
    {value ?? '—'}{#if delta !== null && delta !== undefined}<span class="text-xs ml-2 font-normal text-muted">{delta > 0 ? '+' : ''}{delta}</span>{/if}
  </div>
</div>
