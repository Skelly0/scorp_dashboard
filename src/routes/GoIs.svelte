<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { gois, goisError, loadGois } from '../lib/stores/gois.js';
  import { pageTitle } from '../lib/page-title.js';
  import { goiColor } from '../lib/faction-colors.js';
  import Band from '../lib/components/Band.svelte';
  import RadarChart from '../lib/components/RadarChart.svelte';
  import Heatmap from '../lib/components/Heatmap.svelte';
  import Tag from '../lib/components/Tag.svelte';
  import SubFactionPanel from '../lib/components/SubFactionPanel.svelte';
  import { WORLDVIEW_AXES as AXES, AXIS_HIGH_LABELS } from '../lib/worldview.js';

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

  $: selectedParent = selected
    ? ($gois?.gois.find((g) => g.name === selected.goi) ?? null)
    : null;
  $: selectedSf = selected && selectedParent
    ? (selectedParent.sub_factions.find((s) => s.name === selected.sf) ?? null)
    : null;

  function handleKeydown(e) {
    if (e.key === 'Escape' && selected) {
      selected = null;
    }
  }

  // Auto-dismiss stale selections after a sync (sub-faction renamed/removed
  // in a refreshed gois.json). Re-derive locally to avoid a reactive cycle
  // through selectedParent/selectedSf.
  $: {
    if (selected && $gois) {
      const parent = $gois.gois.find((g) => g.name === selected.goi) ?? null;
      const sf = parent ? parent.sub_factions.find((s) => s.name === selected.sf) ?? null : null;
      if (!parent || !sf) selected = null;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<section class="px-6 py-5 max-w-[1600px] gois-page">
  {#if $goisError}
    <p class="text-crit">{$goisError}</p>
  {:else if !$gois}
    <p class="text-muted text-xs uppercase tracking-widest">Loading…</p>
  {:else}
    <div class="gois-main">
    <Band num="01" title="Groups of Interest" meta={`${$gois.gois.length} GoIs`} />
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {#each $gois.gois as g}
        <div class="s-card barred" style="--bar-color: {goiColor(g.name)}">
          <div class="s-card-header">
            <h3>
              <span class="faction-bar" style="--bar-color: {goiColor(g.name)}"></span>
              {g.name}
            </h3>
            <span class="meta">{g.main_class ?? '—'} · {g.approach ?? '—'}</span>
          </div>
          <div class="s-card-pad grid grid-cols-[170px_1fr] gap-4">
            <RadarChart
              axes={AXES.map((a) => ({ label: AXIS_HIGH_LABELS[a], value: g.effective_worldview?.[a] ?? 0 }))}
              size={170}
            />
            <div class="flex flex-col gap-2">
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <div class="text-muted text-[9px] uppercase tracking-widest">Influence</div>
                  <div class="font-extrabold text-lg tnum">
                    {g.derived_influence != null ? Math.round(g.derived_influence * 100) + '%' : '—'}
                  </div>
                </div>
                <div>
                  <div class="text-muted text-[9px] uppercase tracking-widest">Approval</div>
                  <div class="font-extrabold text-lg tnum">
                    {g.approval != null ? Math.round(g.approval * 100) + '%' : '—'}
                  </div>
                </div>
                <div>
                  <div class="text-muted text-[9px] uppercase tracking-widest">MAD</div>
                  <div class="font-extrabold text-lg tnum">{g.mad_index?.toFixed(2) ?? '—'}</div>
                </div>
              </div>

              <div>
                <div class="text-muted text-[9px] uppercase tracking-widest mb-1">
                  Benefits {g.active_benefits?.unlocked ?? 0}/{g.active_benefits?.total ?? 0}
                </div>
                <div class="flex flex-wrap gap-1">
                  {#each g.active_benefits?.unlocked_list ?? [] as b}
                    <Tag variant="good">{b}</Tag>
                  {/each}
                </div>
              </div>

              {#if g.sub_factions?.length}
                <div>
                  <div class="text-muted text-[9px] uppercase tracking-widest mb-1">Sub-factions</div>
                  <ul class="m-0 p-0 list-none text-[11px]">
                    {#each g.sub_factions as s}
                      {@const isActive = selected && selected.goi === g.name && selected.sf === s.name}
                      <li>
                        <button
                          type="button"
                          class="w-full flex justify-between border-b border-[var(--border-soft)] border-dashed py-1 text-left"
                          class:s-rail-row-active={isActive}
                          aria-pressed={Boolean(isActive)}
                          on:click={() => toggleSelect(g.name, s.name)}
                        >
                          <span>{s.name}</span>
                          <span class="text-muted tnum">
                            {s.influence != null ? Math.round(s.influence * 100) + '%' : '—'} ·
                            ap {s.approval != null ? Math.round(s.approval * 100) + '%' : '—'}
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
      <Band num="02" title="Pop Capture Matrix" meta="class × GoI · base capture %" />
      <div class="s-card s-card-pad">
        <Heatmap
          rowLabels={$gois.pop_capture_matrix.classes}
          colLabels={$gois.pop_capture_matrix.gois}
          values={$gois.pop_capture_matrix.values}
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
</section>

<style>
  .gois-page { display: grid; grid-template-columns: 1fr; gap: 16px; }
  @media (min-width: 1280px) {
    .gois-page { grid-template-columns: 1fr 360px; }
  }
  .gois-main { min-width: 0; }

  .gois-rail-desktop { display: none; }
  @media (min-width: 1280px) {
    .gois-rail-desktop { display: block; }
  }

  .gois-sheet-mobile { display: block; }
  @media (min-width: 1280px) {
    .gois-sheet-mobile { display: none; }
  }
</style>
