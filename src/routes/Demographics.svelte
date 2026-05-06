<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { pops, popsError, loadPops } from '../lib/stores/pops.js';
  import {
    demographics, demographicsError, loadDemographics,
  } from '../lib/stores/demographics.js';
  import {
    deathsHistory, cdrHistory, netDeltaHistory,
    housingUtilHistory, avgSatHistory,
  } from '../lib/stores/history.js';
  import { pageTitle } from '../lib/page-title.js';
  import { classColor } from '../lib/faction-colors.js';
  import Band from '../lib/components/Band.svelte';
  import KpiBlock from '../lib/components/KpiBlock.svelte';
  import Bar from '../lib/components/Bar.svelte';
  import MoonLoader from '../lib/components/MoonLoader.svelte';

  onMount(() => {
    pageTitle.set('Demographics');
    if ($meta?.synced_at) {
      loadPops($meta.synced_at);
      loadDemographics($meta.synced_at);
    }
  });

  $: errorMsg = $demographicsError ?? $popsError;
  $: ready = $demographics && $pops;
  $: housingCritical = $demographics?.housing?.ratio != null
    && $demographics.housing.ratio > 1.0;
</script>

<section class="px-6 py-5 max-w-[1600px]">
  {#if errorMsg}
    <p class="text-crit">Failed to load demographics: {errorMsg}</p>
  {:else if !ready}
    <div class="flex flex-col items-center justify-center py-12 gap-4">
      <MoonLoader size={220} label="Loading demographics" />
      <p class="text-muted text-xs uppercase tracking-widest">Reading vital signs…</p>
    </div>
  {:else}
    <Band num="01" title="Pop Dynamics" meta="colony vital signs" />
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KpiBlock
        label="Total Pop"
        value={$demographics.totals.pop?.toLocaleString() ?? '—'}
      />
      <KpiBlock
        label="Effective CDR"
        value={$demographics.totals.effective_cdr?.toFixed(4) ?? '—'}
        history={$cdrHistory.length >= 2 ? $cdrHistory : null}
      />
      <KpiBlock
        label="Net Δ%"
        value={$demographics.totals.net_delta_pct != null
          ? ($demographics.totals.net_delta_pct >= 0 ? '+' : '')
            + $demographics.totals.net_delta_pct.toFixed(2) + '%'
          : '—'}
        history={$netDeltaHistory.length >= 2 ? $netDeltaHistory : null}
      />
      <KpiBlock
        label="Total Deaths"
        value={$demographics.totals.total_deaths != null
          ? Math.round($demographics.totals.total_deaths).toLocaleString()
          : '—'}
        history={$deathsHistory.length >= 2 ? $deathsHistory : null}
      />
      <KpiBlock
        label="Avg Satisfaction"
        value={$demographics.totals.avg_satisfaction?.toFixed(2) ?? '—'}
        history={$avgSatHistory.length >= 2 ? $avgSatHistory : null}
        good
      />
    </div>
    <Band num="02" title="Class Vitals" meta={`${$pops.classes.length} classes`} />
    <div class="s-card">
      <table class="tbl">
        <thead>
          <tr>
            <th>Class</th>
            <th class="num">Pop</th>
            <th class="num">Mortality</th>
            <th class="num">Deaths/turn</th>
            <th class="num">Unemployed</th>
            <th class="num">Satisfaction</th>
          </tr>
        </thead>
        <tbody>
          {#each $pops.classes as c}
            <tr>
              <td>
                <span class="faction-bar" style="--bar-color: {classColor(c.name)}"></span>
                {c.name}
              </td>
              <td class="num">{c.pop?.toLocaleString() ?? '—'}</td>
              <td class="num">{c.mortality_rate != null ? (c.mortality_rate * 100).toFixed(2) + '%' : '—'}</td>
              <td class="num">{c.deaths_per_turn != null ? Math.round(c.deaths_per_turn).toLocaleString() : '—'}</td>
              <td class="num">{c.unemployed_count != null ? Math.round(c.unemployed_count).toLocaleString() : '—'}</td>
              <td class="num">{c.satisfaction?.toFixed(2) ?? '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <Band num="03" title="Housing" meta={housingCritical ? 'OVERCROWDED' : 'capacity'} />
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="s-card">
        <div class="s-card-header">
          <h3>Utilization</h3>
        </div>
        <div class="s-card-pad">
          <Bar
            label="Pop / Capacity"
            value={$demographics.housing.ratio}
            max={1}
            variant={housingCritical ? 'crit overflow' : ''}
            format="pct"
          />
          <dl class="kv mt-2">
            <dt>Pop</dt><dd>{$demographics.housing.pop?.toLocaleString() ?? '—'}</dd>
            <dt>Capacity</dt><dd>{$demographics.housing.capacity?.toLocaleString() ?? '—'}</dd>
          </dl>
        </div>
      </div>

      <div class="s-card" class:critical={housingCritical}>
        <div class="s-card-header">
          <h3>Modifiers</h3>
        </div>
        <div class="s-card-pad">
          <dl class="kv">
            <dt>Housing Ratio</dt>
            <dd>{$demographics.housing.ratio?.toFixed(3) ?? '—'}</dd>
            <dt>Growth Mult</dt>
            <dd>{$demographics.housing.growth_mult?.toFixed(3) ?? '—'}</dd>
            <dt>Overcrowding Exp</dt>
            <dd>{$demographics.housing.overcrowding_exp?.toFixed(2) ?? '—'}</dd>
          </dl>
        </div>
      </div>
    </div>
  {/if}
</section>
