<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { pops, popsError, loadPops } from '../lib/stores/pops.js';
  import { pageTitle } from '../lib/page-title.js';

  let selected = null;

  onMount(() => {
    pageTitle.set('Pops Detailed');
    if ($meta?.synced_at) loadPops($meta.synced_at);
  });

  $: if ($pops && !selected) selected = $pops.classes[0]?.name;
  $: current = $pops?.classes.find((c) => c.name === selected) ?? null;
  $: critRad = current && current.status.radicalisation > 0.5;
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider mb-4 border-b-4 border-border pb-2">
    Pops Detailed
  </h2>

  {#if $popsError}
    <p class="text-crit">{$popsError}</p>
  {:else if !$pops}
    <p class="text-muted">Loading…</p>
  {:else}
    <div class="flex flex-wrap gap-2 mb-6">
      {#each $pops.classes as c}
        <button
          class="px-3 py-1 border-2 border-border font-mono text-xs uppercase tracking-widest"
          class:bg-border={selected === c.name}
          class:text-bg={selected === c.name}
          on:click={() => (selected = c.name)}
        >
          {c.name}
        </button>
      {/each}
    </div>

    {#if current}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="border-2 border-border p-3">
          <h3 class="text-xs uppercase tracking-widest text-muted mb-2">Living Standards</h3>
          <dl class="space-y-1 text-sm">
            <div class="flex justify-between"><dt>Standard of Living</dt><dd>{current.standard_of_living?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Expected SoL</dt><dd>{current.expected_sol?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Social Privileges</dt><dd>{current.social_privileges?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Satisfaction</dt><dd>{current.satisfaction?.toFixed(2)}</dd></div>
          </dl>
        </div>

        <div class="border-2 border-border p-3">
          <h3 class="text-xs uppercase tracking-widest text-muted mb-2">Income (per cap)</h3>
          <dl class="space-y-1 text-sm">
            <div class="flex justify-between"><dt>Gross / cap</dt><dd>{current.income.gross_per_cap?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Income Tax / cap</dt><dd>{current.income.income_tax_per_cap?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Wealth Tax / cap</dt><dd>{current.income.wealth_tax_per_cap?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Effective Tax Rate</dt><dd>{(current.income.effective_tax_rate * 100).toFixed(1)}%</dd></div>
            <div class="flex justify-between"><dt>Disposable / cap</dt><dd>{current.income.disposable_per_cap?.toFixed(2)}</dd></div>
          </dl>
        </div>

        <div class="border-2 border-border p-3">
          <h3 class="text-xs uppercase tracking-widest text-muted mb-2">Income (totals)</h3>
          <dl class="space-y-1 text-sm">
            <div class="flex justify-between"><dt>Total Pre-tax</dt><dd>{current.income.total_gross?.toFixed(0)}</dd></div>
            <div class="flex justify-between"><dt>Total Post-tax</dt><dd>{current.income.total_disposable?.toFixed(0)}</dd></div>
            <div class="flex justify-between"><dt>Class Wealth</dt><dd>{current.wealth.total?.toFixed(0)}</dd></div>
            <div class="flex justify-between"><dt>Wealth / cap</dt><dd>{current.wealth.per_cap?.toFixed(2)}</dd></div>
          </dl>
        </div>

        <div class="border-2 border-border p-3">
          <h3 class="text-xs uppercase tracking-widest text-muted mb-2">Additional Income</h3>
          <dl class="space-y-1 text-sm">
            <div class="flex justify-between"><dt>Welfare</dt><dd>{current.additional_income.welfare?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Dividends</dt><dd>{current.additional_income.dividends?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Subsidies</dt><dd>{current.additional_income.subsidies?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Other</dt><dd>{current.additional_income.other?.toFixed(2)}</dd></div>
            <div class="flex justify-between font-bold"><dt>Total</dt><dd>{current.additional_income.total?.toFixed(2)}</dd></div>
          </dl>
        </div>

        <div class="border-2 border-border p-3" class:border-crit={critRad}>
          <h3 class="text-xs uppercase tracking-widest text-muted mb-2">Status</h3>
          <dl class="space-y-1 text-sm">
            <div class="flex justify-between" class:text-crit={critRad}><dt>Radicalisation</dt><dd>{current.status.radicalisation?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Abject Poverty</dt><dd>{current.status.abject_poverty?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Organisation</dt><dd>{current.status.organisation?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Literacy</dt><dd>{current.status.literacy?.toFixed(2)}</dd></div>
            <div class="flex justify-between"><dt>Vote Share</dt><dd>{(current.status.vote_share * 100)?.toFixed(1)}%</dd></div>
          </dl>
        </div>
      </div>
    {/if}
  {/if}
</section>
