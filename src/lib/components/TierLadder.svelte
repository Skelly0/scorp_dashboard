<script>
  export let tiers = [];

  function tierClass(t) {
    const n = Number(t.tier);
    return Number.isFinite(n) ? `tier t-${Math.max(1, Math.min(5, n))}` : 'tier';
  }
</script>

<div class="ladder">
  {#each tiers as t}
    <div class={tierClass(t)} aria-current={t.active ? 'true' : undefined}>
      <div class="lvl">T{t.tier}{#if t.label} · {t.label}{/if}</div>
      <div class="desc">{t.description ?? t.consequence ?? ''}</div>
      <div class="range">{t.range ?? (t.active ? 'ACTIVE' : '')}</div>
    </div>
  {/each}
</div>
