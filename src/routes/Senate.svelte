<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { senate, senateError, loadSenate } from '../lib/stores/senate.js';
  import { pageTitle } from '../lib/page-title.js';
  import Heatmap from '../lib/components/Heatmap.svelte';

  onMount(() => {
    pageTitle.set('Senate');
    if ($meta?.synced_at) loadSenate($meta.synced_at);
  });
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider mb-4 border-b-4 border-border pb-2">
    Senate
  </h2>

  {#if $senateError}
    <p class="text-crit">{$senateError}</p>
  {:else if !$senate}
    <p class="text-muted">Loading…</p>
  {:else}
    <div class="border-2 border-accent bg-bg p-3 mb-6 text-sm">
      <strong class="uppercase tracking-widest text-xs text-muted">Note</strong>
      <p>{$senate.placeholder_note}</p>
    </div>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Coalitions</h3>
    <table class="w-full border-collapse mb-6 font-mono text-xs">
      <thead>
        <tr class="border-b-2 border-border">
          <th class="text-left p-2 uppercase tracking-widest">Coalition</th>
          <th class="text-left p-2 uppercase tracking-widest">Members</th>
          <th class="text-right p-2 uppercase tracking-widest">Count</th>
          <th class="text-right p-2 uppercase tracking-widest">Establishment</th>
          <th class="text-right p-2 uppercase tracking-widest">Vote Share</th>
          <th class="text-left p-2 uppercase tracking-widest">Approach</th>
        </tr>
      </thead>
      <tbody>
        {#each $senate.coalitions as c}
          <tr class="border-b border-border/30">
            <td class="p-2 font-bold">{c.name}</td>
            <td class="p-2">{c.member_parties.join(', ')}</td>
            <td class="p-2 text-right">{c.member_count}</td>
            <td class="p-2 text-right">{(c.total_establishment * 100).toFixed(0)}%</td>
            <td class="p-2 text-right">{(c.total_vote_share * 100).toFixed(0)}%</td>
            <td class="p-2">{c.approach}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">GoI Capture % by Party</h3>
    {#if $senate.goi_capture_matrix.values.length === 0}
      <p class="text-muted text-sm">No party-level capture data — no parties have measured vote share yet.</p>
    {:else}
      <Heatmap
        rowLabels={$senate.goi_capture_matrix.parties}
        colLabels={$senate.goi_capture_matrix.gois}
        values={$senate.goi_capture_matrix.values}
      />
    {/if}
  {/if}
</section>
