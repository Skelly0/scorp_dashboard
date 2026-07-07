<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { gois, goisError, loadGois } from '../lib/stores/gois.js';
  import { pageTitle } from '../lib/page-title.js';
  import { goiColor } from '../lib/faction-colors.js';
  import PageState from '../lib/components/PageState.svelte';
  import Band from '../lib/components/Band.svelte';
  import RadarChart from '../lib/components/RadarChart.svelte';
  import Heatmap from '../lib/components/Heatmap.svelte';
  import MadIndex from '../lib/components/MadIndex.svelte';
  import SubFactionPanel from '../lib/components/SubFactionPanel.svelte';
  import { WORLDVIEW_AXES as AXES, AXIS_HIGH_LABELS } from '../lib/worldview.js';
  import { fmtPct } from '../lib/format.js';

  onMount(() => {
    pageTitle.set('GoIs');
    if ($meta?.synced_at) loadGois($meta.synced_at);
  });

  /** @type {{goi: string, sf: string} | null} */
  let selected = null;

  function toggleSelect(goiName, sfName) {
    if (selected && selected.goi === goiName && selected.sf === sfName) {
      selected = null;
    } else {
      selected = { goi: goiName, sf: sfName };
    }
  }

  function subFactionName(subFaction) {
    if (subFaction?.name == null) return null;
    const name = String(subFaction.name).trim();
    return name && !['null', 'none'].includes(name.toLowerCase()) ? name : null;
  }

  function visibleSubFactions(goi) {
    return (goi?.sub_factions ?? [])
      .map((subFaction) => {
        const name = subFactionName(subFaction);
        return name ? { ...subFaction, name } : null;
      })
      .filter(Boolean);
  }

  $: selectedParent = selected
    ? ($gois?.gois.find((g) => g.name === selected.goi) ?? null)
    : null;
  $: selectedSf = selected && selectedParent
    ? (visibleSubFactions(selectedParent).find((s) => s.name === selected.sf) ?? null)
    : null;

  function handleKeydown(e) {
    if (e.key === 'Escape' && selected) {
      selected = null;
    }
  }

  function benefitItems(activeBenefits) {
    if (activeBenefits?.items?.length) return activeBenefits.items;
    return (activeBenefits?.unlocked_list ?? []).map((name) => ({
      name,
      description: null,
      threshold: null,
      active: true,
    }));
  }

  function formatThreshold(value) {
    if (value == null) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.round(numeric * 100) + '%';
  }

  // Auto-dismiss stale selections after a sync (sub-faction renamed/removed
  // in a refreshed gois.json). Re-derive locally to avoid a reactive cycle
  // through selectedParent/selectedSf.
  $: {
    if (selected && $gois) {
      const parent = $gois.gois.find((g) => g.name === selected.goi) ?? null;
      const sf = parent ? visibleSubFactions(parent).find((s) => s.name === selected.sf) ?? null : null;
      if (!parent || !sf) selected = null;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px] gois-page">
  <PageState
    label="GoIs"
    page="gois"
    error={$goisError}
    loading={!$gois}
    retry={() => loadGois($meta.synced_at)}
  >
    {#if $gois.gois.length === 0}
      <Band num="01" title="Groups of Interest" meta="0 GoIs" />
      <div class="s-card s-card-pad">
        <p class="text-muted text-sm">No GoIs recorded in this sync.</p>
      </div>
    {:else}
    <div class="gois-main">
    <Band num="01" title="Groups of Interest" meta={`${$gois.gois.length} GoIs`} />
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {#each $gois.gois as g}
        {@const subFactions = visibleSubFactions(g)}
        <div class="s-card barred" style="--bar-color: {goiColor(g.name)}">
          <div class="s-card-header">
            <h3>
              <span class="faction-bar" style="--bar-color: {goiColor(g.name)}"></span>
              {g.name}
            </h3>
          </div>
          <div class="s-card-pad goi-card-body">
            <div class="goi-radar-frame">
              <RadarChart
                axes={AXES.map((a) => ({ label: AXIS_HIGH_LABELS[a], value: g.effective_worldview?.[a] ?? 0 }))}
                size={170}
              />
            </div>
            <div class="flex flex-col gap-2">
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <div class="text-muted text-[9px] uppercase tracking-widest">Influence</div>
                  <div class="font-extrabold text-lg tnum">
                    {fmtPct(g.derived_influence)}
                  </div>
                </div>
                <div>
                  <div class="text-muted text-[9px] uppercase tracking-widest">Approval</div>
                  <div class="font-extrabold text-lg tnum">
                    {fmtPct(g.approval)}
                  </div>
                </div>
                <div>
                  <MadIndex value={g.mad_index} compact />
                </div>
              </div>

              <div>
                <div class="text-muted text-[9px] uppercase tracking-widest mb-1">
                  Benefits {g.active_benefits?.unlocked ?? 0}/{g.active_benefits?.total ?? 0} active
                </div>
                <div class="goi-benefits-list">
                  {#each benefitItems(g.active_benefits) as b}
                    <div class="goi-benefit-row" class:is-active={b.active}>
                      <div class="goi-benefit-head">
                        <span
                          class="goi-benefit-status"
                          class:is-active={b.active}
                          aria-label={b.active ? 'Benefit active' : 'Benefit inactive'}
                        >
                          {b.active ? 'Active' : 'Inactive'}
                        </span>
                        <span class="goi-benefit-name">{b.name}</span>
                        {#if formatThreshold(b.threshold)}
                          <span class="goi-benefit-threshold tnum">{formatThreshold(b.threshold)}</span>
                        {/if}
                      </div>
                      {#if b.description}
                        <div class="goi-benefit-desc">{b.description}</div>
                      {/if}
                    </div>
                  {/each}
                  {#if benefitItems(g.active_benefits).length === 0}
                    <div class="goi-benefits-empty">No benefits listed.</div>
                  {/if}
                </div>
              </div>

              {#if subFactions.length}
                <div>
                  <div class="text-muted text-[9px] uppercase tracking-widest mb-1">Sub-factions</div>
                  <ul class="m-0 p-0 list-none text-[11px]">
                    {#each subFactions as s}
                      {@const isActive = selected && selected.goi === g.name && selected.sf === s.name}
                      <li>
                        <button
                          type="button"
                          class="w-full flex justify-between border-b border-[var(--border-soft)] border-dashed py-1 text-left goi-subfaction-button"
                          class:s-rail-row-active={isActive}
                          aria-pressed={Boolean(isActive)}
                          on:click={() => toggleSelect(g.name, s.name)}
                        >
                          <span class="goi-subfaction-name">{s.name}</span>
                          <span class="goi-subfaction-meta text-muted tnum">
                            {fmtPct(s.influence)} · ap&nbsp;{fmtPct(s.approval)}
                          </span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>

    {#if $gois.pop_capture_matrix?.classes?.length && $gois.pop_capture_matrix?.gois?.length}
      <Band num="02" title="GOI VALUE CAPTURED POP" meta="class × GoI · captured pop" />
      <div class="s-card s-card-pad">
        <Heatmap
          rowLabels={$gois.pop_capture_matrix.classes}
          colLabels={$gois.pop_capture_matrix.gois}
          values={$gois.pop_capture_matrix.values}
          format="int"
          minCellWidth={64}
        />
      </div>
    {/if}
    </div>
    <!-- Desktop sticky rail (≥1280px via CSS) -->
    <aside class="s-rail gois-rail-desktop">
      <SubFactionPanel
        subfaction={selectedSf}
        parent={selectedParent}
        on:close={() => (selected = null)}
      />
    </aside>

    <!-- Mobile bottom sheet (<1280px via CSS) -->
    {#if selected && selectedSf}
      <div
        class="s-sheet-backdrop gois-sheet-mobile"
        on:click={() => (selected = null)}
        role="presentation"
      ></div>
      <div class="s-sheet gois-sheet-mobile">
        <SubFactionPanel
          subfaction={selectedSf}
          parent={selectedParent}
          on:close={() => (selected = null)}
        />
      </div>
    {/if}
    {/if}
  </PageState>
</section>

<style>
  .gois-page { display: grid; grid-template-columns: 1fr; gap: 16px; }
  @media (min-width: 1280px) {
    .gois-page { grid-template-columns: 1fr 360px; }
  }
  .gois-main { min-width: 0; }
  .goi-card-body { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 16px; }
  .goi-radar-frame { display: grid; }
  .goi-radar-frame :global(svg) { max-width: min(170px, 50vw); height: auto; justify-self: center; }

  .goi-benefits-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }
  .goi-benefit-row {
    border: 1px solid var(--border-soft);
    background: var(--bg-2);
    padding: 6px 8px;
    min-width: 0;
  }
  .goi-benefit-row.is-active {
    border-color: var(--good);
    background: var(--good-soft);
  }
  .goi-benefit-head {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 7px;
    align-items: baseline;
    min-width: 0;
  }
  .goi-benefit-status {
    border: 1px solid var(--border-soft);
    color: var(--muted);
    background: var(--bg);
    padding: 2px 5px;
    font-size: 8.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .goi-benefit-status.is-active {
    color: var(--good);
    border-color: var(--good);
    font-weight: 800;
  }
  .goi-benefit-name {
    font-size: 11px;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .goi-benefit-threshold {
    color: var(--muted);
    font-size: 10px;
    white-space: nowrap;
  }
  /* On active rows the good-soft tint lifts the background enough that
     --muted drops below WCAG AA (4.16 in dark). Use the higher-contrast
     dim token there. */
  .goi-benefit-row.is-active .goi-benefit-threshold {
    color: var(--fg-dim);
  }
  .goi-benefit-desc,
  .goi-benefits-empty {
    margin-top: 4px;
    color: var(--fg-dim);
    font-size: 10.5px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .goi-benefits-empty {
    margin-top: 0;
    color: var(--muted);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .gois-rail-desktop { display: none; }
  @media (min-width: 1280px) {
    .gois-rail-desktop { display: block; }
  }

  @media (max-width: 479px) {
    .goi-card-body { grid-template-columns: 1fr; }
    .goi-benefit-head { grid-template-columns: 1fr auto; }
    .goi-benefit-status { grid-column: 1 / -1; width: fit-content; }
  }

  .gois-sheet-mobile { display: block; }
  @media (min-width: 1280px) {
    .gois-sheet-mobile { display: none; }
  }

  /* Long federation names wrap; the "50% · ap 60%" stat pair never splits
     mid-token (the value used to orphan onto its own line under "ap"). */
  .goi-subfaction-button { gap: 10px; }
  .goi-subfaction-name { min-width: 0; overflow-wrap: anywhere; }
  .goi-subfaction-meta { white-space: nowrap; flex-shrink: 0; }

  @media (pointer: coarse) {
    .goi-subfaction-button {
      min-height: 44px;
      padding-top: 10px;
      padding-bottom: 10px;
    }
  }
</style>
