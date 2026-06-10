<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { status, statusError, loadStatus } from '../lib/stores/status.js';
  import {
    loadHistory,
    stabilityHistory,
    crisisFactorHistory,
    govApprovalHistory,
  } from '../lib/stores/history.js';
  import { pageTitle } from '../lib/page-title.js';
  import Band from '../lib/components/Band.svelte';
  import KpiBlock from '../lib/components/KpiBlock.svelte';
  import CrisisGauge from '../lib/components/CrisisGauge.svelte';
  import { crisisBreach, situationLoad } from '../lib/stores/crisis.js';
  import StatTile from '../lib/components/StatTile.svelte';
  import OvertonRow from '../lib/components/OvertonRow.svelte';
  import SituationCard from '../lib/components/SituationCard.svelte';
  import PageState from '../lib/components/PageState.svelte';
  import {
    formatStatusPercent,
    populationDeltaFromStatus,
    projectedGrowthRateFromStatus,
    statusMetricTone,
  } from '../lib/status-metrics.js';
  import { fmtInt, fmtPct, chipSignedFlow, chipUpkeepFlow } from '../lib/format.js';

  const CRISIS_TONE_OPTIONS = { lowerIsBetter: true };

  onMount(() => {
    pageTitle.set('Status');
    if ($meta?.synced_at) {
      loadStatus($meta.synced_at);
      loadHistory($meta.synced_at);
    }
  });

  // Use workbook's authoritative births-minus-deaths tally for both the
  // headline delta and the Pulse growth rate; net_delta_pct is an estimate.
  $: netDeltaPop = populationDeltaFromStatus($status);
  $: projectedGrowthRate = projectedGrowthRateFromStatus($status);

  $: activeSituations = $status?.active_situations?.filter((s) => s.crisis_factor != null) ?? [];
  $: moneyResource = $status?.resources?.find((r) => String(r?.name ?? '').toLowerCase() === 'money') ?? null;

  function fmtDeltaInt(d) {
    if (d == null) return null;
    return Math.round(d);
  }
  function resourceFlowDetails(resource) {
    const details = [];
    const income = resource?.income;
    const upkeep = resource?.upkeep;

    if (income != null) {
      details.push({
        text: chipSignedFlow(income),
        tone: income > 0 ? 'good' : null,
      });
    }
    if (upkeep != null) {
      details.push({
        text: chipUpkeepFlow(upkeep),
        tone: upkeep > 0 ? 'crit' : null,
      });
    }
    return details;
  }
</script>

<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px]">
  <PageState
    label="Status"
    page="status"
    error={$statusError}
    loading={!$status}
    loadingText="Reading status panel…"
    retry={() => { loadStatus($meta.synced_at); loadHistory($meta.synced_at); }}
  >
    <Band num="01" title="Vital Signs" meta={$status.year != null ? `Year ${$status.year}` : ''} />
    <div class="grid grid-cols-12 gap-3">
      <div class="col-span-12 md:col-span-4">
        <KpiBlock
          label="Money"
          value={fmtInt(moneyResource?.current)}
          prefix="₡ "
          subtitle="Reserve"
          details={resourceFlowDetails(moneyResource)}
          delta={fmtDeltaInt(moneyResource?.delta)}
        />
      </div>
      <div class="col-span-6 md:col-span-2">
        <KpiBlock
          label="Stability"
          value={formatStatusPercent($status.stability)}
          tone={statusMetricTone($status.stability)}
          history={$stabilityHistory.length >= 2 ? $stabilityHistory : null}
        />
      </div>
      <div class="col-span-6 md:col-span-2">
        <KpiBlock
          label="Crisis Pressure"
          value={formatStatusPercent($status.crisis_factor)}
          tone={statusMetricTone($status.crisis_factor, CRISIS_TONE_OPTIONS)}
          history={$crisisFactorHistory.length >= 2 ? $crisisFactorHistory : null}
        >
          {#if $crisisBreach.breached}
            <span class="crisis-over-tag" aria-hidden="true">OVER 1.0</span>
            <CrisisGauge factor={$situationLoad} />
          {/if}
        </KpiBlock>
      </div>
      <div class="col-span-6 md:col-span-2">
        <KpiBlock
          label="Population"
          value={fmtInt($status.population_total)}
          delta={fmtDeltaInt(netDeltaPop)}
        />
      </div>
      <div class="col-span-6 md:col-span-2">
        <KpiBlock
          label="Gov Approval"
          value={formatStatusPercent($status.gov_approval)}
          tone={statusMetricTone($status.gov_approval)}
          history={$govApprovalHistory.length >= 2 ? $govApprovalHistory : null}
        />
      </div>
    </div>

    <Band num="02" title="Pulse" meta="population vitals" />
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatTile
        label="Births / year"
        value={fmtInt($status.demographics?.total_births)}
      />
      <StatTile
        label="Deaths / year"
        value={fmtInt($status.demographics?.total_deaths)}
      />
      <StatTile
        label="Projected Growth"
        value={projectedGrowthRate != null
          ? (projectedGrowthRate >= 0 ? '+' : '')
            + projectedGrowthRate.toFixed(2) + '%'
          : '—'}
      />
      <StatTile
        label="Housing util"
        value={fmtPct($status.demographics?.housing_util, 1)}
      />
    </div>

    <Band num="03" title="Resource Flows" meta="gross income/upkeep per year" />
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {#each ($status.resources ?? []).filter((r) => String(r?.name ?? '').toLowerCase() !== 'money') as r}
        <StatTile
          label={r.name}
          value={fmtInt(r.current)}
          details={resourceFlowDetails(r)}
        />
      {/each}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-7 gap-4 mt-2">
      <div class="lg:col-span-4">
        <Band num="04" title="Overton Window" meta="ideological windows" />
        <div class="s-card s-card-pad">
          {#each Object.entries($status.overton ?? {}) as [axis, value]}
            <OvertonRow {axis} {value} />
          {/each}
        </div>
      </div>
      <div class="lg:col-span-3">
        <Band num="05" title="Active Situations" meta={`${activeSituations.length} active`} />
        {#if activeSituations.length === 0}
          <p class="text-muted text-xs uppercase tracking-widest mt-2">No active situations.</p>
        {:else}
          <div class="flex flex-col gap-2">
            {#each activeSituations as sit}
              <SituationCard
                name={sit.name}
                description={sit.description}
                crisis_factor={sit.crisis_factor}
              />
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </PageState>
</section>
