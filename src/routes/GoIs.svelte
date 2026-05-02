<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { gois, goisError, loadGois } from '../lib/stores/gois.js';
  import { pageTitle } from '../lib/page-title.js';
  import RadarChart from '../lib/components/RadarChart.svelte';
  import Heatmap from '../lib/components/Heatmap.svelte';

  onMount(() => {
    pageTitle.set('GoIs');
    if ($meta?.synced_at) loadGois($meta.synced_at);
  });

  const AXES = ['expansion', 'authority', 'corporate', 'technocratic', 'faith', 'materialist'];
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider mb-4 border-b-4 border-border pb-2">
    Groups of Interest
  </h2>

  {#if $goisError}
    <p class="text-crit">{$goisError}</p>
  {:else if !$gois}
    <p class="text-muted">Loading…</p>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      {#each $gois.gois as g}
        <div class="border-4 border-border p-4">
          <div class="flex justify-between items-baseline mb-2">
            <h3 class="font-mono font-extrabold text-lg uppercase tracking-wider">{g.name}</h3>
            <span class="text-xs text-muted">{g.main_class ?? '—'}</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-xs mb-3">
            <div><div class="text-muted uppercase tracking-widest">Influence</div><div class="font-bold text-base">{(g.derived_influence * 100).toFixed(0)}%</div></div>
            <div><div class="text-muted uppercase tracking-widest">Approval</div><div class="font-bold text-base">{(g.approval * 100).toFixed(0)}%</div></div>
            <div><div class="text-muted uppercase tracking-widest">Mad Index</div><div class="font-bold text-base">{g.mad_index?.toFixed(2)}</div></div>
          </div>
          <div class="text-xs text-muted uppercase tracking-widest mb-2">{g.approach}</div>
          <div class="flex gap-3 mb-3">
            <RadarChart axes={AXES.map((a) => ({ label: a, value: g.effective_worldview[a] }))} size={140} />
            <div class="flex-1 text-xs">
              <div class="text-muted uppercase tracking-widest mb-1">Active Benefits</div>
              <div class="font-bold mb-1">{g.active_benefits.unlocked} / {g.active_benefits.total} unlocked</div>
              <ul class="list-disc list-inside">
                {#each g.active_benefits.unlocked_list as b}
                  <li>{b}</li>
                {/each}
              </ul>
            </div>
          </div>
          {#if g.sub_factions.length > 0}
            <div class="text-xs">
              <div class="text-muted uppercase tracking-widest mb-1">Sub-factions</div>
              <ul class="space-y-1">
                {#each g.sub_factions as s}
                  <li class="flex justify-between border-b border-border/30 pb-1">
                    <span>{s.name}</span>
                    <span class="text-muted">{(s.influence * 100).toFixed(0)}% · approval {(s.approval * 100).toFixed(0)}%</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Pop Capture Base</h3>
    <Heatmap
      rowLabels={$gois.pop_capture_matrix.classes}
      colLabels={$gois.pop_capture_matrix.gois}
      values={$gois.pop_capture_matrix.values}
    />
  {/if}
</section>
