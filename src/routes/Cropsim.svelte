<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { cropsim, cropsimError, loadCropsim } from '../lib/stores/cropsim.js';
  import { status, loadStatus } from '../lib/stores/status.js';
  import { pageTitle } from '../lib/page-title.js';
  import { classColor } from '../lib/faction-colors.js';
  import Band from '../lib/components/Band.svelte';
  import KpiBlock from '../lib/components/KpiBlock.svelte';
  import MoonLoader from '../lib/components/MoonLoader.svelte';

  onMount(() => {
    pageTitle.set('Cropsim');
    if ($meta?.synced_at) {
      loadCropsim($meta.synced_at);
      loadStatus($meta.synced_at);
    }
  });

  $: ready = $cropsim != null;
  $: empty = ready && $cropsim.production.length === 0 && $cropsim.demand.length === 0;
  $: metrics = $cropsim?.metrics;
  $: foodResource = $status?.resources?.find((resource) => resource?.name?.toLowerCase() === 'food') ?? null;
  $: foodReserve = foodResource?.current;
  $: foodSupply = foodResource?.income ?? metrics?.total_supply;
  $: foodDemand = foodResource?.upkeep ?? metrics?.total_demand;
  $: foodReserveDetails = foodFlowDetails(foodSupply, foodDemand);
  $: securityTone = metrics?.security_ratio == null
    ? null
    : metrics.security_ratio < 0.95
      ? 'crit'
      : metrics.security_ratio < 1
        ? 'warn'
        : 'good';
  $: balanceTone = metrics?.balance == null ? null : metrics.balance < 0 ? 'crit' : 'good';
  $: productionMax = Math.max(...($cropsim?.production ?? []).map((p) => p.total_units ?? 0), 0);
  $: demandMax = Math.max(...($cropsim?.demand ?? []).map((d) => d.total_demand ?? 0), 0);
  $: supplyDemandMax = Math.max(metrics?.total_supply ?? 0, metrics?.total_demand ?? 0, 1);

  function fmt(value, digits = 1) {
    if (value == null || !Number.isFinite(value)) return '—';
    return value.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function fmtInt(value) {
    if (value == null || !Number.isFinite(value)) return '—';
    return Math.round(value).toLocaleString();
  }

  function fmtSigned(value, digits = 1) {
    if (value == null || !Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    return sign + fmt(abs, digits);
  }

  function fmtSignedFlow(value) {
    if (value == null || !Number.isFinite(value)) return null;
    const rounded = Math.round(value);
    return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString()}`;
  }

  function fmtDemandFlow(value) {
    if (value == null || !Number.isFinite(value)) return null;
    const rounded = Math.round(value);
    if (rounded === 0) return '0';
    return rounded > 0
      ? `-${rounded.toLocaleString()}`
      : `+${Math.abs(rounded).toLocaleString()}`;
  }

  function foodFlowDetails(supply, demand) {
    const details = [];

    if (supply != null) {
      details.push({
        key: 'supply',
        text: fmtSignedFlow(supply),
        tone: supply > 0 ? 'good' : null,
      });
    }
    if (demand != null) {
      details.push({
        key: 'demand',
        text: fmtDemandFlow(demand),
        tone: demand > 0 ? 'crit' : null,
      });
    }
    return details;
  }

  function fmtRatio(value, digits = 2) {
    if (value == null || !Number.isFinite(value)) return '—';
    return value.toFixed(digits);
  }

  function fmtPct(value, digits = 0) {
    if (value == null || !Number.isFinite(value)) return '—';
    return `${(value * 100).toFixed(digits)}%`;
  }
</script>

<section class="px-6 py-5 max-w-[1600px]">
  {#if $cropsimError}
    <p class="text-crit">Failed to load cropsim: {$cropsimError}</p>
  {:else if !ready}
    <div class="flex flex-col items-center justify-center py-12 gap-4">
      <MoonLoader size={220} label="Loading cropsim" />
      <p class="text-muted text-xs uppercase tracking-widest">Reading food economy...</p>
    </div>
  {:else if empty}
    <Band num="01" title="Cropsim" />
    <div class="s-card s-card-pad">
      <p class="text-muted text-sm">
        Cropsim tables are not yet wired up. Sync has not seen the
        <code>CropsimProductionTable</code> and <code>CropsimDemandTable</code>
        named ranges.
      </p>
    </div>
  {:else}
    <Band num="01" title="Food Balance" meta={`${metrics.production_types} foods / ${metrics.demand_classes} classes`} />
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 cropsim-kpis">
      <KpiBlock label="Food Reserve" value={fmtInt(foodReserve)} details={foodReserveDetails} />
      <KpiBlock label="Net/Turn" value={fmtSigned(metrics.balance, 1)} tone={balanceTone} />
      <KpiBlock label="Security Ratio" value={fmtRatio(metrics.security_ratio, 3)} tone={securityTone} />
      <KpiBlock label="Food / Cap" value={fmtRatio(metrics.per_cap, 4)} />
      <KpiBlock label="Variety Index" value={fmtRatio(metrics.variety_index, 3)} />
    </div>

    <div class="cropsim-balance s-card s-card-pad">
      <div class="cropsim-balance-row">
        <span>Supply</span>
        <div><i style="width: {((metrics.total_supply ?? 0) / supplyDemandMax) * 100}%"></i></div>
        <b>{fmt(metrics.total_supply, 1)}</b>
      </div>
      <div class="cropsim-balance-row demand">
        <span>Demand</span>
        <div><i style="width: {((metrics.total_demand ?? 0) / supplyDemandMax) * 100}%"></i></div>
        <b>{fmt(metrics.total_demand, 1)}</b>
      </div>
    </div>

    <Band num="02" title="Production Mix" meta={`${$cropsim.production.length} food types`} />
    <div class="crop-mix-grid">
      {#each $cropsim.production as item}
        {@const width = productionMax > 0 && item.total_units != null ? (item.total_units / productionMax) * 100 : 0}
        <article class="crop-mix-card">
          <div class="crop-card-head">
            <h3>{item.food_type}</h3>
            <span>{fmtPct(item.share)}</span>
          </div>
          <div class="crop-card-units tnum">{fmt(item.total_units, 1)}</div>
          <div class="crop-card-track"><span style="width: {width}%"></span></div>
          <dl class="kv">
            <dt>Calorie Mult</dt>
            <dd>{fmtRatio(item.calorie_mult, 2)}</dd>
            <dt>Supply Share</dt>
            <dd>{fmtPct(item.share, 1)}</dd>
          </dl>
        </article>
      {/each}
    </div>

    <Band num="03" title="Class Demand" meta={`${$cropsim.demand.length} classes`} />
    <div class="s-card">
      <table class="tbl crop-demand-table">
        <thead>
          <tr>
            <th>Class</th>
            <th class="num">Pop</th>
            <th class="num">Per-Cap</th>
            <th class="num">Demand</th>
            <th class="num">Share</th>
          </tr>
        </thead>
        <tbody>
          {#each $cropsim.demand as row}
            {@const width = demandMax > 0 && row.total_demand != null ? (row.total_demand / demandMax) * 100 : 0}
            <tr>
              <td>
                <span class="faction-bar" style="--bar-color: {classColor(row.class_name)}"></span>
                {row.class_name}
              </td>
              <td class="num">{fmtInt(row.pop)}</td>
              <td class="num">{fmtRatio(row.per_cap_demand, 3)}</td>
              <td class="num">
                <span class="crop-demand-cell">
                  <span class="crop-demand-meter" style="--row-accent: {classColor(row.class_name)}">
                    <i style="width: {width}%"></i>
                  </span>
                  <span>{fmt(row.total_demand, 1)}</span>
                </span>
              </td>
              <td class="num">{fmtPct(row.share, 1)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
