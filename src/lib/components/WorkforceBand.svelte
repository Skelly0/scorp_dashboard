<script>
  import { workforce } from '../stores/workforce.js';
  import Band from './Band.svelte';
  import KpiBlock from './KpiBlock.svelte';
  import Bar from './Bar.svelte';

  export let bandNum = '03';

  $: w = $workforce;
  $: fillVariant = w?.fillRatio == null
    ? ''
    : w.fillRatio < 0.85
      ? 'crit'
      : w.fillRatio > 1.0
        ? 'overflow'
        : '';
</script>

{#if w}
  <Band num={bandNum} title="Workforce" meta={w.mismatch ? 'SKILL MISMATCH' : 'colony labour'} />
  <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
    <KpiBlock label="Total Demand" value={Math.round(w.totalDemand).toLocaleString()} />
    <KpiBlock label="Total Supply" value={Math.round(w.totalSupply).toLocaleString()} />
    <KpiBlock
      label="Total Unemployed"
      value={Math.round(w.totalUnemployed).toLocaleString()}
      critical={w.totalUnemployed > 0 && w.mismatch}
    />
  </div>

  <div class="s-card mt-3">
    <div class="s-card-pad">
      <Bar
        label="Colony-wide Fill"
        value={w.fillRatio}
        max={1}
        variant={fillVariant}
        format="pct"
      />
    </div>
  </div>

  {#if w.mismatch}
    <div class="s-card sit-card sev-warn mt-3" role="status">
      <div class="s-card-pad">
        <strong>Skill mismatch:</strong>
        {w.totalUnemployed.toLocaleString()} idle
        {#if w.topUnemployed.length}
          (top: {w.topUnemployed.map((t) => `${t.name} (${t.count})`).join(', ')})
        {/if}
        while {w.shortage.toLocaleString()} jobs unfilled
        {#if w.topShortage.length}
          (top: {w.topShortage.map((t) => `${t.name} (${t.count})`).join(', ')})
        {/if}.
      </div>
    </div>
  {/if}
{/if}
