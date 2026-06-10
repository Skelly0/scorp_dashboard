<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { pops, popsError, loadPops } from '../lib/stores/pops.js';
  import { population, populationError, loadPopulation } from '../lib/stores/population.js';
  import {
    demographics, demographicsError, loadDemographics,
  } from '../lib/stores/demographics.js';
  import { workforce } from '../lib/stores/workforce.js';
  import {
    loadHistory,
    avgSatHistory, populationDeltaHistory,
  } from '../lib/stores/history.js';
  import { pageTitle } from '../lib/page-title.js';
  import { statusMetricTone } from '../lib/status-metrics.js';
  import { fmtPct, fmtSignedInt, fmtInt, fmtNum } from '../lib/format.js';
  import { classColor } from '../lib/faction-colors.js';
  import Band from '../lib/components/Band.svelte';
  import KpiBlock from '../lib/components/KpiBlock.svelte';
  import Bar from '../lib/components/Bar.svelte';
  import PageState from '../lib/components/PageState.svelte';
  import WorkforceBand from '../lib/components/WorkforceBand.svelte';
  import ClassDetail from '../lib/components/ClassDetail.svelte';

  onMount(() => {
    pageTitle.set('Demographics');
    if ($meta?.synced_at) {
      loadPops($meta.synced_at);
      loadPopulation($meta.synced_at);
      loadDemographics($meta.synced_at);
      loadHistory($meta.synced_at);
    }
  });

  $: errorMsg = $demographicsError ?? $popsError ?? $populationError;
  $: ready = $demographics && $pops && $population;
  $: housingCritical = $demographics?.housing?.ratio != null
    && $demographics.housing.ratio > 1.0;

  // Available housing: capacity − pop, with % free subtitle.
  $: availableHousing = (() => {
    const cap = $demographics?.housing?.capacity;
    const pop = $demographics?.housing?.pop;
    if (cap == null || pop == null || cap === 0) return { value: null, subtitle: null };
    const free = cap - pop;
    const pct = Math.round((free / cap) * 100);
    return { value: fmtInt(free), subtitle: `${pct}% free` };
  })();

  // Predicted growth: TotalBirths − TotalDeaths from the workbook (authoritative
  // per-turn tally). Renders '—' if either input is missing.
  $: predictedGrowth = (() => {
    const t = $demographics?.totals;
    if (!t) return null;
    const b = t.total_births;
    const d = t.total_deaths;
    if (b == null || d == null) return null;
    return Math.round(b - d);
  })();

  $: avgSatisfactionTone = statusMetricTone($demographics?.totals?.avg_satisfaction);

  // Workforce fill from derived store.
  $: workforceFill = $workforce?.fillRatio;
  $: workforceFillDisplay = fmtPct(workforceFill, 1);
  $: workforceFillCritical = workforceFill != null && workforceFill < 0.85;
  $: workforceFillGood = workforceFill != null && workforceFill >= 1.0;

  // Per-class drilldown selection.
  let selected = null; // class name string | null
  let detailWrapper;
  let scrolledFor = null; // last class name we scrolled to; prevents re-scroll on data refresh

  $: current = selected
    ? $pops?.classes.find((c) => c.name === selected) ?? null
    : null;

  $: currentPopulation = selected
    ? $population?.classes.find((c) => c.name === selected) ?? null
    : null;

  // Clear stale selection when the class disappears across a sync.
  $: if (selected && $pops && !$pops.classes.some((c) => c.name === selected)) {
    selected = null;
  }

  // Pull the detail band into view only when the *selected class* changes (not on every $pops refresh).
  $: if (current && detailWrapper && current.name !== scrolledFor) {
    scrolledFor = current.name;
    Promise.resolve().then(() => {
      detailWrapper?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
  $: if (!current) scrolledFor = null;

  function toggleSelected(name) {
    selected = selected === name ? null : name;
  }

  function handleRowKeydown(e, name) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleSelected(name);
    }
  }

  function handleWindowKeydown(e) {
    if (e.key === 'Escape' && selected != null) {
      selected = null;
    }
  }
</script>

<svelte:window on:keydown={handleWindowKeydown} />

<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px]">
  <PageState
    label="Demographics"
    page={['demographics', 'pops', 'population']}
    error={errorMsg}
    loading={!ready}
    loadingText="Reading vital signs…"
    retry={() => {
      loadPops($meta.synced_at);
      loadPopulation($meta.synced_at);
      loadDemographics($meta.synced_at);
      loadHistory($meta.synced_at);
    }}
  >
    <Band num="01" title="Pop Dynamics" meta="colony vital signs" />
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KpiBlock
        label="Total Pop"
        value={fmtInt($demographics.totals.pop)}
      />
      <KpiBlock
        label="Avg Satisfaction"
        value={fmtPct($demographics.totals.avg_satisfaction)}
        history={$avgSatHistory.length >= 2 ? $avgSatHistory : null}
        tone={avgSatisfactionTone}
      />
      <KpiBlock
        label="Available Housing"
        value={availableHousing.value}
        subtitle={availableHousing.subtitle}
      />
      <KpiBlock
        label="Predicted Growth"
        value={predictedGrowth == null ? null : fmtSignedInt(predictedGrowth)}
        subtitle={predictedGrowth == null ? null : 'per year'}
        history={$populationDeltaHistory.length >= 2 ? $populationDeltaHistory : null}
        critical={predictedGrowth != null && predictedGrowth < 0}
        good={predictedGrowth != null && predictedGrowth > 0}
      />
      <KpiBlock
        label="Workforce Fill"
        value={workforceFillDisplay}
        critical={workforceFillCritical}
        good={workforceFillGood}
      />
    </div>
    <Band num="02" title="Class Vitals" meta={`${$pops.classes.length} classes`} />
    <div class="s-card">
      <p class="tbl-hint sm:hidden">Tap a row for full vitals.</p>
      <table class="tbl tbl-trim-mobile">
        <thead>
          <tr>
            <th>Class</th>
            <th class="num hide-narrow">Tier</th>
            <th class="hide-narrow">Share</th>
            <th class="num">Pop</th>
            <th class="num hide-narrow">Mortality</th>
            <th class="num hide-narrow">Births/year</th>
            <th class="num hide-narrow">Deaths/year</th>
            <th class="num hide-narrow">Mobility In</th>
            <th class="num hide-narrow">Mobility Out</th>
            <th class="num hide-narrow">Demand</th>
            <th class="num">Fill %</th>
            <th class="num hide-narrow">Unemployed</th>
            <th class="num">Satisfaction</th>
          </tr>
        </thead>
        <tbody>
          {#each $pops.classes as c}
            {@const fill = c.workforce?.fill_ratio}
            {@const fillDim = fill != null && fill < 0.85}
            {@const popProfile = $population.classes.find((p) => p.name === c.name)}
            <tr
              role="button"
              tabindex="0"
              aria-pressed={selected === c.name}
              class:selected-row={selected === c.name}
              style={selected === c.name ? `--row-accent: ${classColor(c.name)};` : ''}
              on:click={() => toggleSelected(c.name)}
              on:keydown={(e) => handleRowKeydown(e, c.name)}
            >
              <td>
                <span class="faction-bar" style="--bar-color: {classColor(c.name)}"></span>
                {c.name}
              </td>
              <td class="num hide-narrow">{popProfile?.tier ?? '—'}</td>
              <td class="hide-narrow">
                <div class="bar-row" style="padding: 0;">
                  <div class="bar">
                    <span style="width: {Math.min(100, (popProfile?.share ?? 0) * 100 * 4)}%"></span>
                  </div>
                  <div class="val">{popProfile?.share != null ? (popProfile.share * 100).toFixed(1) + '%' : '—'}</div>
                </div>
              </td>
              <td class="num">{fmtInt(c.pop)}</td>
              <td class="num hide-narrow">{c.mortality_rate != null ? (c.mortality_rate * 100).toFixed(2) + '%' : '—'}</td>
              <td class="num hide-narrow">{fmtInt(c.births_per_turn)}</td>
              <td class="num hide-narrow">{fmtInt(c.deaths_per_turn)}</td>
              <td class="num hide-narrow">{fmtInt(c.mobility_in)}</td>
              <td class="num hide-narrow">{fmtInt(c.mobility_out)}</td>
              <td class="num hide-narrow">{fmtInt(c.workforce?.demand)}</td>
              <td class="num" class:text-crit={fillDim}>{fill != null ? (fill * 100).toFixed(0) + '%' : '—'}</td>
              <td class="num hide-narrow">{fmtInt(c.unemployed_count)}</td>
              <td class="num">{fmtPct(c.satisfaction)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if current}
      <Band title={`${current.name} · Detail`} meta="per-class drilldown" />
      <div bind:this={detailWrapper} aria-live="polite">
        <ClassDetail cls={current} populationProfile={currentPopulation} />
      </div>
    {/if}
    <WorkforceBand bandNum="03" />
    <Band num="04" title="Housing" meta={housingCritical ? 'OVERCROWDED' : 'capacity'} />
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
            <dt>Pop</dt><dd>{fmtInt($demographics.housing.pop)}</dd>
            <dt>Capacity</dt><dd>{fmtInt($demographics.housing.capacity)}</dd>
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
    <Band num="05" title="Food Security" meta="cropsim signals" />
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 kpi-row-secondary">
      <KpiBlock
        label="Security Ratio"
        value={fmtPct($demographics.food.security_ratio)}
        good={($demographics.food.security_ratio ?? 0) >= 1.0}
        critical={($demographics.food.security_ratio ?? 1) < 0.95}
      />
      <KpiBlock
        label="Food / Cap"
        value={fmtNum($demographics.food.per_cap, 2)}
      />
      <KpiBlock
        label="Variety Index"
        value={fmtNum($demographics.food.variety_index, 2)}
      />
    </div>
  </PageState>
</section>

<style>
  tr[role='button'] {
    cursor: pointer;
  }
  tr[role='button']:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .selected-row {
    background: var(--accent-soft);
    box-shadow: inset 4px 0 0 var(--row-accent, var(--accent));
    outline: 1px solid var(--accent);
    outline-offset: -1px;
  }
</style>
