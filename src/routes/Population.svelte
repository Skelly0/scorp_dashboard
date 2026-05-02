<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { population, populationError, loadPopulation } from '../lib/stores/population.js';
  import { pageTitle } from '../lib/page-title.js';
  import RadarChart from '../lib/components/RadarChart.svelte';

  onMount(() => {
    pageTitle.set('Population');
    if ($meta?.synced_at) loadPopulation($meta.synced_at);
  });

  const AXIS_LABELS = ['expansion', 'authority', 'corporate', 'technocratic', 'faith', 'materialist'];
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider mb-4 border-b-4 border-border pb-2">
    Population
  </h2>

  {#if $populationError}
    <p class="text-crit">{$populationError}</p>
  {:else if !$population}
    <p class="text-muted">Loading…</p>
  {:else}
    <table class="border-collapse w-full mb-6 font-mono text-sm">
      <thead>
        <tr class="border-b-2 border-border">
          <th class="text-left p-2 uppercase tracking-widest text-xs text-muted">Class</th>
          <th class="text-right p-2 uppercase tracking-widest text-xs text-muted">Tier</th>
          <th class="text-right p-2 uppercase tracking-widest text-xs text-muted">Pop</th>
          <th class="text-right p-2 uppercase tracking-widest text-xs text-muted">% Share</th>
          <th class="text-right p-2 uppercase tracking-widest text-xs text-muted">Pol Weight</th>
        </tr>
      </thead>
      <tbody>
        {#each $population.classes as c}
          <tr class="border-b border-border/30">
            <td class="p-2">{c.name}</td>
            <td class="p-2 text-right">{c.tier}</td>
            <td class="p-2 text-right">{c.pop.toLocaleString()}</td>
            <td class="p-2 text-right">{(c.share * 100).toFixed(1)}%</td>
            <td class="p-2 text-right">{c.political_weight?.toFixed(1) ?? '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Worldview by class</h3>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      {#each $population.classes as c}
        <div class="border-2 border-border p-2 flex flex-col items-center">
          <div class="text-xs uppercase tracking-widest mb-1">{c.name}</div>
          <RadarChart
            axes={AXIS_LABELS.map((a) => ({ label: a, value: c.worldview[a] }))}
            size={140}
          />
        </div>
      {/each}
    </div>
  {/if}
</section>
