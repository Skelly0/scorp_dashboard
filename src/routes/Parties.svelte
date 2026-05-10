<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { parties, partiesError, loadParties } from '../lib/stores/parties.js';
  import { pops, popsError, loadPops } from '../lib/stores/pops.js';
  import { pageTitle } from '../lib/page-title.js';
  import { goiColor } from '../lib/faction-colors.js';
  import { classCompatPopMatrix } from '../lib/party-compat.js';
  import Band from '../lib/components/Band.svelte';
  import RadarChart from '../lib/components/RadarChart.svelte';
  import Heatmap from '../lib/components/Heatmap.svelte';
  import { WORLDVIEW_AXES as AXES, AXIS_HIGH_LABELS } from '../lib/worldview.js';

  onMount(() => {
    pageTitle.set('Parties');
    if ($meta?.synced_at) {
      loadParties($meta.synced_at);
      loadPops($meta.synced_at);
    }
  });

  $: errorMsg = $partiesError ?? $popsError;
  $: classPopMatrix = classCompatPopMatrix($parties?.class_compat_matrix, $pops?.classes);
</script>

<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px]">
  {#if errorMsg}
    <p class="text-crit">{errorMsg}</p>
  {:else if !$parties || !$pops}
    <p class="text-muted text-xs uppercase tracking-widest">Loading…</p>
  {:else if $parties.parties.length === 0}
    <Band num="01" title="Founded Parties" meta="0 parties" />
    <div class="s-card s-card-pad">
      <p class="text-muted text-sm">No parties founded yet — players form parties during play.</p>
    </div>
  {:else}
    <Band num="01" title="Founded Parties" meta={`${$parties.parties.length} parties`} />
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {#each $parties.parties as p}
        <div class="s-card barred" style="--bar-color: {goiColor(p.closest_goi)}">
          <div class="s-card-header">
            <h3>{p.name}</h3>
            <span class="meta">{p.closest_goi ?? '—'}</span>
          </div>
          <div class="s-card-pad party-card-body">
            <div class="flex flex-col gap-2">
              <div>
                <div class="text-muted text-[9px] uppercase tracking-widest">Establishment</div>
                <div class="font-extrabold text-base tnum">{p.establishment != null ? Math.round(p.establishment * 100) + '%' : '—'}</div>
              </div>
              <div>
                <div class="text-muted text-[9px] uppercase tracking-widest">Vote Share</div>
                <div class="font-extrabold text-base tnum">{p.vote_share != null ? Math.round(p.vote_share * 100) + '%' : '—'}</div>
              </div>
              <div>
                <div class="text-muted text-[9px] uppercase tracking-widest">MAD Index</div>
                <div class="font-extrabold text-base tnum">{p.mad_index?.toFixed(2) ?? '—'}</div>
              </div>
            </div>
            <div class="party-radar-frame">
              <RadarChart
                axes={AXES.map((a) => ({ label: AXIS_HIGH_LABELS[a], value: p.stance?.[a] ?? 0 }))}
                size={140}
              />
            </div>
          </div>
        </div>
      {/each}
    </div>

    {#if $parties.goi_compat_matrix?.values?.length}
      <Band num="02" title="GoI · Party Compatibility" />
      <div class="s-card s-card-pad">
        <Heatmap
          rowLabels={$parties.goi_compat_matrix.parties}
          colLabels={$parties.goi_compat_matrix.gois}
          values={$parties.goi_compat_matrix.values}
          rowHeadWidth={180}
          minCellWidth={64}
        />
      </div>
    {/if}

    {#if classPopMatrix?.values?.length}
      <Band num="03" title="Party Pops" meta="by class" />
      <div class="s-card s-card-pad">
        <Heatmap
          rowLabels={classPopMatrix.parties}
          colLabels={classPopMatrix.classes}
          values={classPopMatrix.values}
          format="int"
          rowHeadWidth={180}
          minCellWidth={72}
        />
      </div>
    {/if}
  {/if}
</section>

<style>
  .party-card-body { display: grid; grid-template-columns: minmax(0, 1fr) 140px; gap: 12px; }
  .party-radar-frame { display: grid; }
  .party-radar-frame :global(svg) { max-width: min(140px, 45vw); height: auto; justify-self: center; }

  @media (max-width: 399px) {
    .party-card-body { grid-template-columns: 1fr; }
  }
</style>
