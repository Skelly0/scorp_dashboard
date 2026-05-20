<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { parties, partiesError, loadParties } from '../lib/stores/parties.js';
  import { pops, popsError, loadPops } from '../lib/stores/pops.js';
  import { pageTitle } from '../lib/page-title.js';
  import { classCompatPopMatrix, partySupportOverview } from '../lib/party-compat.js';
  import Band from '../lib/components/Band.svelte';
  import RadarChart from '../lib/components/RadarChart.svelte';
  import Heatmap from '../lib/components/Heatmap.svelte';
  import MadIndex from '../lib/components/MadIndex.svelte';
  import { WORLDVIEW_AXES as AXES, AXIS_HIGH_LABELS } from '../lib/worldview.js';
  import { partyIdeology } from '../lib/party-ideology.js';

  onMount(() => {
    pageTitle.set('Parties');
    if ($meta?.synced_at) {
      loadParties($meta.synced_at);
      loadPops($meta.synced_at);
    }
  });

  $: errorMsg = $partiesError ?? $popsError;
  $: classPopMatrix = classCompatPopMatrix($parties?.class_compat_matrix, $pops?.classes);
  $: supportOverview = partySupportOverview(
    $parties?.party_capture_pct_matrix,
    $parties?.party_capture_pop_matrix,
  );
  $: supportByParty = new Map(supportOverview.map((item) => [item.party, item]));

  function supporterCount(party, support) {
    return support?.totalCapturedPop ?? party?.estimated_support ?? null;
  }

  function fmtPct(value) {
    return value != null && Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';
  }

  function fmtPop(value) {
    return value != null && Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '—';
  }

  // Class x party heatmap tabs: % of class vs raw people. Compatibility lives
  // separately because its axes are party x GoI (a different cross-table).
  $: hasPct = $parties?.party_capture_pct_matrix?.values?.length > 0;
  $: hasPop = $parties?.party_capture_pop_matrix?.values?.length > 0;
  $: hasFallbackPop = !hasPop && classPopMatrix?.values?.length > 0;
  let supportTab = 'pop'; // 'pop' | 'pct' — Party Supporters is the authoritative count
  $: if (supportTab === 'pop' && !hasPop && !hasFallbackPop && hasPct) supportTab = 'pct';
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
        {@const support = supportByParty.get(p.name)}
        {@const supporters = supporterCount(p, support)}
        {@const ideo = partyIdeology(p.stance)}
        <div class="s-card barred" style="--bar-color: {ideo.color}">
          <div class="s-card-header">
            <h3>{p.name}</h3>
            <span class="party-lean" aria-label={`Ideological lean: ${ideo.leanLabel}`} title="Ideological lean">
              <span class="party-lean-swatch" aria-hidden="true"></span>
              {ideo.leanLabel}
            </span>
          </div>
          <div class="s-card-pad party-card-body">
            <div class="flex flex-col gap-2">
              <div class="party-stat-grid">
                <div>
                  <div class="text-muted text-[9px] uppercase tracking-widest">Establishment</div>
                  <div class="font-extrabold text-base tnum">{fmtPct(p.establishment)}</div>
                </div>
                <div>
                  <div class="text-muted text-[9px] uppercase tracking-widest">Vote Share</div>
                  <div class="font-extrabold text-base tnum">{fmtPct(p.vote_share)}</div>
                </div>
                <div>
                  <div class="text-muted text-[9px] uppercase tracking-widest">Supporters</div>
                  <div class="font-extrabold text-base tnum">{fmtPop(supporters)}</div>
                </div>
              </div>
              <MadIndex value={p.mad_index} />

              {#if support?.topClasses?.length}
                <div class="party-support">
                  <div class="party-support-head">
                    <span>Top Classes</span>
                  </div>
                  <ul>
                    {#each support.topClasses as row}
                      <li>
                        <span>{row.className}</span>
                        <span class="text-muted tnum">{fmtPop(row.capturedPop)}</span>
                        <span class="text-muted tnum">{fmtPct(row.classCapturePct)} class</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
            <div class="party-radar-frame">
              <RadarChart
                axes={AXES.map((a) => ({ label: AXIS_HIGH_LABELS[a], value: p.stance?.[a] ?? 0 }))}
                size={140}
                accent={ideo.color}
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

    {#if hasPct || hasPop || hasFallbackPop}
      <Band
        num="03"
        title="Class × Party Support"
        meta={supportTab === 'pct' ? '% of class' : 'people'}
      />
      <div class="s-card">
        <div class="layer-tabs" role="group" aria-label="Class × party view">
          {#if hasPop || hasFallbackPop}
            <button
              aria-pressed={supportTab === 'pop'}
              on:click={() => (supportTab = 'pop')}
            >Supporters</button>
          {/if}
          {#if hasPct}
            <button
              aria-pressed={supportTab === 'pct'}
              on:click={() => (supportTab = 'pct')}
            >% of Class</button>
          {/if}
        </div>
        <div class="s-card-pad">
          {#if supportTab === 'pct' && hasPct}
            <Heatmap
              rowLabels={$parties.party_capture_pct_matrix.classes}
              colLabels={$parties.party_capture_pct_matrix.parties}
              values={$parties.party_capture_pct_matrix.values}
              format="pctSign"
              rowHeadWidth={180}
              minCellWidth={72}
            />
          {:else if supportTab === 'pop' && hasPop}
            <Heatmap
              rowLabels={$parties.party_capture_pop_matrix.classes}
              colLabels={$parties.party_capture_pop_matrix.parties}
              values={$parties.party_capture_pop_matrix.values}
              format="int"
              rowHeadWidth={180}
              minCellWidth={72}
            />
          {:else if supportTab === 'pop' && hasFallbackPop}
            <Heatmap
              rowLabels={classPopMatrix.parties}
              colLabels={classPopMatrix.classes}
              values={classPopMatrix.values}
              format="int"
              rowHeadWidth={180}
              minCellWidth={72}
            />
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</section>

<style>
  .party-lean {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
    white-space: nowrap;
  }
  /* Swatch inherits the card's --bar-color so the chip matches the left bar. */
  .party-lean-swatch {
    display: inline-block;
    width: 4px;
    height: 11px;
    background: var(--bar-color, var(--accent));
  }
  .party-card-body { display: grid; grid-template-columns: minmax(0, 1fr) 140px; gap: 12px; }
  .party-stat-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; }
  .party-support { margin-top: 4px; border-top: 1px dashed var(--border-soft); padding-top: 8px; }
  .party-support-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .party-support ul { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 3px; }
  .party-support li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 8px;
    align-items: baseline;
    font-size: 11px;
  }
  .party-support li span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .party-radar-frame { display: grid; }
  .party-radar-frame :global(svg) { max-width: min(140px, 45vw); height: auto; justify-self: center; }

  @media (max-width: 399px) {
    .party-card-body { grid-template-columns: 1fr; }
    .party-support li { grid-template-columns: minmax(0, 1fr) auto; }
    .party-support li span:last-child { grid-column: 1 / -1; }
  }
</style>
