<script>
  /** @type {{tier: string, active: boolean, consequence: string}[]} */
  export let tiers = [];
</script>

<ol class="font-mono text-sm space-y-1">
  {#each tiers as t}
    <li
      class="border-2 border-border p-2 flex justify-between"
      class:bg-crit={t.active}
      class:text-bg={t.active}
    >
      <span class="font-extrabold uppercase tracking-widest">Tier {t.tier}</span>
      <span class="flex-1 mx-3 text-muted" class:text-bg={t.active}>{t.consequence}</span>
      {#if t.active}<span class="font-extrabold uppercase tracking-widest">ACTIVE</span>{/if}
    </li>
  {/each}
</ol>
