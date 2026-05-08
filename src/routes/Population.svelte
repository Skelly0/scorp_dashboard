<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { population, populationError, loadPopulation } from '../lib/stores/population.js';
  import { pageTitle } from '../lib/page-title.js';
  import { classColor } from '../lib/faction-colors.js';
  import Band from '../lib/components/Band.svelte';
  import RadarChart from '../lib/components/RadarChart.svelte';
  import { WORLDVIEW_AXES as AXES, AXIS_HIGH_LABELS } from '../lib/worldview.js';

  onMount(() => {
    pageTitle.set('Population');
    if ($meta?.synced_at) loadPopulation($meta.synced_at);
  });

  $: totalPop = $population?.classes.reduce((a, c) => a + (c.pop ?? 0), 0) ?? 0;
</script>

<section class="px-6 py-5 max-w-[1600px]">
  {#if $populationError}
    <p class="text-crit">{$populationError}</p>
  {:else if !$population}
    <p class="text-muted text-xs uppercase tracking-widest">Loading…</p>
  {:else}
    <Band
      num="01"
      title="Class Roster"
      meta={`${$population.classes.length} classes · ${totalPop.toLocaleString()} pop`}
    />
    <div class="s-card">
      <table class="tbl">
        <thead>
          <tr>
            <th>Class</th>
            <th class="num">Tier</th>
            <th class="num">Pop</th>
            <th>Share</th>
            <th class="num">Pol Weight</th>
          </tr>
        </thead>
        <tbody>
          {#each $population.classes as c}
            <tr>
              <td>
                <span class="faction-bar" style="--bar-color: {classColor(c.name)}"></span>
                {c.name}
              </td>
              <td class="num">{c.tier ?? '—'}</td>
              <td class="num">{c.pop?.toLocaleString() ?? '—'}</td>
              <td>
                <div class="bar-row" style="padding: 0;">
                  <div class="bar"><span style="width: {Math.min(100, (c.share ?? 0) * 100 * 4)}%"></span></div>
                  <div class="val">{((c.share ?? 0) * 100).toFixed(1)}%</div>
                </div>
              </td>
              <td class="num">{c.political_weight?.toFixed(1) ?? '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <Band num="02" title="Worldview by Class" meta="6-axis radar · scale 0–6" />
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {#each $population.classes as c}
        <div class="s-card barred" style="--bar-color: {classColor(c.name)}">
          <div class="s-card-header">
            <h3>{c.name}</h3>
            <span class="meta">T{c.tier ?? '—'}</span>
          </div>
          <div style="padding: 4px 8px 12px;">
            <RadarChart
              axes={AXES.map((a) => ({ label: AXIS_HIGH_LABELS[a], value: c.worldview?.[a] ?? 0 }))}
              size={170}
            />
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>
