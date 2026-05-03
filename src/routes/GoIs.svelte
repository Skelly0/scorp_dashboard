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

  onMount(() => {
    pageTitle.set('GoIs');
    if ($meta?.synced_at) loadGois($meta.synced_at);
  });

  const AXES = ['expansion', 'authority', 'corporate', 'technocratic', 'faith', 'materialist'];
</script>

<section class="px-6 py-5 max-w-[1600px]">
  {#if $goisError}
    <p class="text-crit">{$goisError}</p>
  {:else if !$gois}
    <p class="text-muted text-xs uppercase tracking-widest">Loading…</p>
  {:else}
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
              axes={AXES.map((a) => ({ label: a, value: g.effective_worldview?.[a] ?? 0 }))}
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
                      <li class="flex justify-between border-b border-[var(--border-soft)] border-dashed py-1">
                        <span>{s.name}</span>
                        <span class="text-muted tnum">
                          {s.influence != null ? Math.round(s.influence * 100) + '%' : '—'} ·
                          ap {s.approval != null ? Math.round(s.approval * 100) + '%' : '—'}
                        </span>
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
  {/if}
</section>
