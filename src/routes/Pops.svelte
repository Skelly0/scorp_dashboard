<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { pops, popsError, loadPops } from '../lib/stores/pops.js';
  import { pageTitle } from '../lib/page-title.js';
  import { classColor } from '../lib/faction-colors.js';
  import Band from '../lib/components/Band.svelte';
  import Bar from '../lib/components/Bar.svelte';
  import Tag from '../lib/components/Tag.svelte';

  let selected = null;

  onMount(() => {
    pageTitle.set('Pops Detailed');
    if ($meta?.synced_at) loadPops($meta.synced_at);
  });

  $: if ($pops && !selected) selected = $pops.classes[0]?.name;
  $: current = $pops?.classes.find((c) => c.name === selected) ?? null;
  $: critRad = current && current.status?.radicalisation > 0.5;

  function chipStyle(name) {
    return selected === name
      ? `background: ${classColor(name)}; color: #0a0805; border-color: ${classColor(name)};`
      : '';
  }
</script>

<section class="px-6 py-5 max-w-[1600px]">
  {#if $popsError}
    <p class="text-crit">{$popsError}</p>
  {:else if !$pops}
    <p class="text-muted text-xs uppercase tracking-widest">Loading…</p>
  {:else}
    <Band num="01" title="Class Selector" meta="drill into one class" />
    <div class="flex flex-wrap gap-1">
      {#each $pops.classes as c}
        <button
          class="s-chip"
          aria-pressed={selected === c.name}
          on:click={() => (selected = c.name)}
          style={chipStyle(c.name)}
        >
          {c.name}
        </button>
      {/each}
    </div>

    {#if current}
      <Band num="02" title={current.name} meta="per-class drilldown" />
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <div class="s-card">
          <div class="s-card-header"><h3>Living Standards</h3></div>
          <div class="s-card-pad">
            <Bar label="SoL" value={current.standard_of_living} max={5} />
            <Bar label="Expected" value={current.expected_sol} max={5} />
            <Bar label="Privilege" value={current.social_privileges} max={1} />
          </div>
        </div>

        <div class="s-card">
          <div class="s-card-header"><h3>Income · per cap</h3></div>
          <div class="s-card-pad">
            <dl class="kv">
              <dt>Gross</dt><dd>{current.income?.gross_per_cap?.toFixed(2) ?? '—'}</dd>
              <dt>Income tax</dt><dd>{current.income?.income_tax_per_cap?.toFixed(2) ?? '—'}</dd>
              <dt>Wealth tax</dt><dd>{current.income?.wealth_tax_per_cap?.toFixed(2) ?? '—'}</dd>
              <dt>Effective rate</dt>
              <dd>{current.income?.effective_tax_rate != null ? (current.income.effective_tax_rate * 100).toFixed(1) + '%' : '—'}</dd>
              <dt>Disposable</dt><dd>{current.income?.disposable_per_cap?.toFixed(2) ?? '—'}</dd>
            </dl>
          </div>
        </div>

        <div class="s-card">
          <div class="s-card-header"><h3>Income · totals</h3></div>
          <div class="s-card-pad">
            <dl class="kv">
              <dt>Pre-tax</dt><dd>{current.income?.total_gross?.toFixed(0) ?? '—'}</dd>
              <dt>Post-tax</dt><dd>{current.income?.total_disposable?.toFixed(0) ?? '—'}</dd>
              <dt>Class wealth</dt><dd>{current.wealth?.total?.toFixed(0) ?? '—'}</dd>
              <dt>Wealth/cap</dt><dd>{current.wealth?.per_cap?.toFixed(2) ?? '—'}</dd>
            </dl>
          </div>
        </div>

        <div class="s-card">
          <div class="s-card-header"><h3>Additional Income</h3></div>
          <div class="s-card-pad">
            <dl class="kv">
              <dt>Welfare</dt><dd>{current.additional_income?.welfare?.toFixed(2) ?? '—'}</dd>
              <dt>Dividends</dt><dd>{current.additional_income?.dividends?.toFixed(2) ?? '—'}</dd>
              <dt>Subsidies</dt><dd>{current.additional_income?.subsidies?.toFixed(2) ?? '—'}</dd>
              <dt>Other</dt><dd>{current.additional_income?.other?.toFixed(2) ?? '—'}</dd>
              <dt><strong>Total</strong></dt>
              <dd><strong>{current.additional_income?.total?.toFixed(2) ?? '—'}</strong></dd>
            </dl>
          </div>
        </div>

        <div
          class="s-card md:col-span-2"
          style={critRad ? 'border-color: var(--crit);' : ''}
        >
          <div class="s-card-header">
            <h3>Status</h3>
            {#if critRad}<Tag variant="crit">⚠ Radicalised</Tag>{/if}
          </div>
          <div class="s-card-pad grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <div>
              <Bar
                label="Radicalisation"
                value={current.status?.radicalisation}
                max={1}
                variant={critRad ? 'crit' : ''}
              />
              <Bar label="Abject Poverty" value={current.status?.abject_poverty} max={1} variant="crit" />
              <Bar label="Organisation" value={current.status?.organisation} max={1} />
            </div>
            <div>
              <Bar label="Education" value={current.status?.literacy} max={1} variant="good" />
              <Bar label="Vote Share" value={current.status?.vote_share} max={1} />
            </div>
          </div>
        </div>

        <div class="s-card md:col-span-2 xl:col-span-3">
          <div class="s-card-header"><h3>Workforce</h3></div>
          <div class="s-card-pad grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <dl class="kv">
              <dt>Supply</dt>
              <dd>{current.workforce?.supply != null ? Math.round(current.workforce.supply).toLocaleString() : '—'}</dd>
              <dt>Demand</dt>
              <dd>{current.workforce?.demand != null ? Math.round(current.workforce.demand).toLocaleString() : '—'}</dd>
            </dl>
            <div>
              <Bar label="Fill Ratio" value={current.workforce?.fill_ratio} max={1} variant="good" />
              <Bar
                label="Unemployment"
                value={current.workforce?.unemployment}
                max={1}
                variant={current.workforce?.unemployment != null && current.workforce.unemployment > 0.15 ? 'crit' : ''}
              />
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</section>
