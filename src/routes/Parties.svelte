<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { parties, partiesError, loadParties } from '../lib/stores/parties.js';
  import { pageTitle } from '../lib/page-title.js';
  import RadarChart from '../lib/components/RadarChart.svelte';
  import Heatmap from '../lib/components/Heatmap.svelte';

  onMount(() => {
    pageTitle.set('Parties');
    if ($meta?.synced_at) loadParties($meta.synced_at);
  });

  const AXES = ['expansion', 'authority', 'corporate', 'technocratic', 'faith', 'materialist'];
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider mb-4 border-b-4 border-border pb-2">
    Parties
  </h2>

  {#if $partiesError}
    <p class="text-crit">{$partiesError}</p>
  {:else if !$parties}
    <p class="text-muted">Loading…</p>
  {:else if $parties.parties.length === 0}
    <p class="text-muted">No parties founded yet — players form parties during play.</p>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
      {#each $parties.parties as p}
        <div class="border-4 border-border p-3">
          <h3 class="font-mono font-extrabold text-base uppercase tracking-wider mb-2">{p.name}</h3>
          <div class="grid grid-cols-2 gap-2 text-xs mb-2">
            <div><div class="text-muted uppercase tracking-widest">Establishment</div><div class="font-bold">{(p.establishment * 100).toFixed(0)}%</div></div>
            <div><div class="text-muted uppercase tracking-widest">Closest GoI</div><div class="font-bold">{p.closest_goi}</div></div>
            <div><div class="text-muted uppercase tracking-widest">Vote Share</div><div class="font-bold">{(p.vote_share * 100).toFixed(0)}%</div></div>
            <div><div class="text-muted uppercase tracking-widest">Mad Index</div><div class="font-bold">{p.mad_index?.toFixed(2)}</div></div>
          </div>
          <RadarChart axes={AXES.map((a) => ({ label: a, value: p.stance[a] }))} size={140} />
        </div>
      {/each}
    </div>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">GoI–Party Compatibility</h3>
    <div class="mb-6">
      <Heatmap
        rowLabels={$parties.goi_compat_matrix.parties}
        colLabels={$parties.goi_compat_matrix.gois}
        values={$parties.goi_compat_matrix.values}
      />
    </div>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Class–Party Compatibility</h3>
    <Heatmap
      rowLabels={$parties.class_compat_matrix.parties}
      colLabels={$parties.class_compat_matrix.classes}
      values={$parties.class_compat_matrix.values}
    />
  {/if}
</section>
