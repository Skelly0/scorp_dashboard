<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { senate, senateError, loadSenate } from '../lib/stores/senate.js';
  import { pageTitle } from '../lib/page-title.js';
  import Band from '../lib/components/Band.svelte';
  import Heatmap from '../lib/components/Heatmap.svelte';

  onMount(() => {
    pageTitle.set('Senate');
    if ($meta?.synced_at) loadSenate($meta.synced_at);
  });

  const COLORS = ['var(--accent)', 'var(--good)', '#c44dff', 'var(--muted)', '#ff8c42'];

  $: coalitions = $senate?.coalitions ?? [];
  $: voteSegments = coalitions.map((c, i) => ({
    name: c.name,
    share: c.total_vote_share ?? 0,
    color: COLORS[i % COLORS.length],
  }));
</script>

<section class="px-6 py-5 max-w-[1600px]">
  {#if $senateError}
    <p class="text-crit">{$senateError}</p>
  {:else if !$senate}
    <p class="text-muted text-xs uppercase tracking-widest">Loading…</p>
  {:else}
    {#if $senate.placeholder_note}
      <div class="s-card s-card-pad mb-3" style="border-color: var(--accent);">
        <strong class="uppercase tracking-widest text-[10px] text-muted">Note</strong>
        <p class="text-sm m-0 mt-1">{$senate.placeholder_note}</p>
      </div>
    {/if}

    <Band num="01" title="Coalitions" meta={`${coalitions.length} coalitions`} />
    {#if coalitions.length === 0}
      <p class="text-muted text-xs uppercase tracking-widest">No coalitions formed.</p>
    {:else}
      <div class="s-card">
        <table class="tbl">
          <thead>
            <tr>
              <th>Coalition</th>
              <th>Members</th>
              <th class="num">Count</th>
              <th class="num">Establishment</th>
              <th class="num">Vote Share</th>
              <th>Approach</th>
            </tr>
          </thead>
          <tbody>
            {#each coalitions as c}
              <tr>
                <td><strong>{c.name}</strong></td>
                <td>{c.member_parties?.join(' · ') ?? '—'}</td>
                <td class="num">{c.member_count ?? '—'}</td>
                <td class="num">{c.total_establishment != null ? Math.round(c.total_establishment * 100) + '%' : '—'}</td>
                <td class="num">{c.total_vote_share != null ? Math.round(c.total_vote_share * 100) + '%' : '—'}</td>
                <td class="text-muted">{c.approach ?? '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <Band num="02" title="Vote Share Composition" />
      <div class="s-card s-card-pad">
        <div class="flex h-8 border border-[var(--border-soft)]">
          {#each voteSegments as seg}
            {#if seg.share > 0}
              <div
                class="flex items-center justify-center text-[10px] font-bold uppercase tracking-widest"
                style="flex: {seg.share}; background: {seg.color}; color: var(--alert-fg);"
                title="{seg.name} {Math.round(seg.share * 100)}%"
              >
                {Math.round(seg.share * 100)}%
              </div>
            {/if}
          {/each}
        </div>
        <div class="flex flex-wrap gap-3 mt-2 text-[10px] uppercase tracking-widest text-muted">
          {#each voteSegments as seg}
            <span class="inline-flex items-center gap-1.5">
              <span class="inline-block w-2.5 h-2.5" style="background: {seg.color};"></span>
              {seg.name}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    {#if $senate.goi_capture_matrix?.values?.length}
      <Band num="03" title="GoI Capture % by Party" />
      <div class="s-card s-card-pad">
        <Heatmap
          rowLabels={$senate.goi_capture_matrix.parties}
          colLabels={$senate.goi_capture_matrix.gois}
          values={$senate.goi_capture_matrix.values}
        />
      </div>
    {/if}
  {/if}
</section>
