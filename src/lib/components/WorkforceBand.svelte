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
  <div class="grid grid-cols-2 md:grid-cols-3 gap-3 kpi-row-secondary">
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
    <div class="s-card sit-card sev-warn mt-3 mismatch-card" role="status" aria-label="Skill mismatch">
      <div class="s-card-pad">
        <div class="mismatch-head">
          <strong>Skill mismatch</strong>
          <span class="text-muted text-[11px]">labour pool ≠ job demand</span>
        </div>
        <div class="mismatch-grid">
          <div>
            <div class="mismatch-col-head">
              <span>Unfilled Jobs</span>
              <span class="tnum">{w.shortage.toLocaleString()}</span>
            </div>
            {#if w.topShortage.length}
              <ul class="mismatch-list">
                {#each w.topShortage as t}
                  <li>
                    <span>{t.name}</span>
                    <span class="tnum text-crit">−{t.count.toLocaleString()}</span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="mismatch-empty">No classes short.</p>
            {/if}
          </div>
          <div>
            <div class="mismatch-col-head">
              <span>Idle Workers</span>
              <span class="tnum">{w.totalUnemployed.toLocaleString()}</span>
            </div>
            {#if w.topUnemployed.length}
              <ul class="mismatch-list">
                {#each w.topUnemployed as t}
                  <li>
                    <span>{t.name}</span>
                    <span class="tnum text-warn">+{t.count.toLocaleString()}</span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="mismatch-empty">No classes idle.</p>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .mismatch-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }
  .mismatch-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  @media (min-width: 640px) {
    .mismatch-grid { grid-template-columns: 1fr 1fr; }
  }
  .mismatch-col-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    border-bottom: 1px dashed var(--border-soft);
    padding-bottom: 4px;
    margin-bottom: 6px;
  }
  .mismatch-col-head .tnum {
    font-size: 12px;
    font-weight: 700;
    color: var(--fg);
    letter-spacing: 0;
  }
  .mismatch-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
    font-size: 12px;
  }
  .mismatch-list li {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }
  .mismatch-empty {
    margin: 0;
    font-size: 11px;
    color: var(--muted);
  }
</style>
