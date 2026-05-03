<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { status, statusError, loadStatus } from '../lib/stores/status.js';
  import {
    history,
    loadHistory,
    treasuryHistory,
    stabilityHistory,
    crisisFactorHistory,
  } from '../lib/stores/history.js';
  import { pageTitle } from '../lib/page-title.js';
  import Band from '../lib/components/Band.svelte';
  import KpiBlock from '../lib/components/KpiBlock.svelte';
  import StatTile from '../lib/components/StatTile.svelte';
  import OvertonRow from '../lib/components/OvertonRow.svelte';
  import SituationCard from '../lib/components/SituationCard.svelte';
  import MoonLoader from '../lib/components/MoonLoader.svelte';

  onMount(() => {
    pageTitle.set('Status');
    if ($meta?.synced_at) {
      loadStatus($meta.synced_at);
      loadHistory($meta.synced_at);
    }
  });

  $: critical = $status && $status.crisis_factor != null && $status.stability != null
    && $status.crisis_factor >= $status.stability;

  $: activeSituations = $status?.active_situations?.filter((s) => s.crisis_factor != null) ?? [];

  function fmtMoney(n) {
    if (n == null) return '—';
    return Math.round(n).toLocaleString();
  }
  function fmtDeltaInt(d) {
    if (d == null) return null;
    return Math.round(d);
  }
</script>

<section class="px-6 py-5 max-w-[1600px]">
  {#if $statusError}
    <p class="text-crit">Failed to load status: {$statusError}</p>
  {:else if !$status}
    <div class="flex flex-col items-center justify-center py-12 gap-4">
      <MoonLoader size={220} label="Loading status" />
      <p class="text-muted text-xs uppercase tracking-widest">Reading status panel…</p>
    </div>
  {:else}
    <Band num="01" title="Vital Signs" meta={$status.year != null ? `Year ${$status.year}` : ''} />
    <div class="grid grid-cols-12 gap-3">
      <div class="col-span-12 md:col-span-5">
        <KpiBlock
          label="Treasury"
          value={fmtMoney($status.treasury?.money)}
          prefix="₡ "
          delta={fmtDeltaInt($status.treasury?.delta)}
          history={$treasuryHistory.length >= 2 ? $treasuryHistory : null}
        />
      </div>
      <div class="col-span-6 md:col-span-3">
        <KpiBlock
          label="Stability"
          value={$status.stability?.toFixed(2) ?? '—'}
          history={$stabilityHistory.length >= 2 ? $stabilityHistory : null}
          good
        />
      </div>
      <div class="col-span-6 md:col-span-2">
        <KpiBlock
          label="Crisis Factor"
          value={$status.crisis_factor?.toFixed(2) ?? '—'}
          history={$crisisFactorHistory.length >= 2 ? $crisisFactorHistory : null}
          critical={critical}
        />
      </div>
      <div class="col-span-12 md:col-span-2">
        <KpiBlock
          label="Population"
          value={$status.population_total?.toLocaleString() ?? '—'}
        />
      </div>
    </div>

    <Band num="02" title="Resource Flows" meta="per-turn net" />
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {#each $status.resources as r}
        <StatTile
          label={r.name}
          value={r.current != null ? Math.round(r.current).toLocaleString() : '—'}
          delta={fmtDeltaInt(r.delta)}
        />
      {/each}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-7 gap-4 mt-2">
      <div class="lg:col-span-4">
        <Band num="03" title="Overton Window" meta="ideological windows" />
        <div class="s-card s-card-pad">
          {#each Object.entries($status.overton ?? {}) as [axis, value]}
            <OvertonRow {axis} {value} />
          {/each}
        </div>
      </div>
      <div class="lg:col-span-3">
        <Band num="04" title="Active Situations" meta={`${activeSituations.length} active`} />
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
  {/if}
</section>
