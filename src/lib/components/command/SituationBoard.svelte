<script>
  // Situation Load panel + active situation cards. Situations are live-only
  // (the workbook stores no per-year history), so archive years show a notice.
  // The load gauge + breach state reuse the global crisis stores, so the board
  // can never disagree with the colony-wide CrisisFrame/CrisisBanner.
  import CrisisGauge from '../CrisisGauge.svelte';
  import MiniBar from '../MiniBar.svelte';
  import { isLiveYear } from '../../stores/timeline.js';
  import { situations } from '../../stores/situations.js';
  import { situationLoad } from '../../stores/crisis.js';
  import { toneColor } from '../../command-format.js';

  function loadTier(load) {
    if (load == null) return { label: 'ARCHIVE', tone: 'muted' };
    if (load > 1.0001) return { label: 'BREACH', tone: 'crit' };
    if (load >= 0.95) return { label: 'AT CAPACITY', tone: 'crit' };
    if (load >= 0.6) return { label: 'ELEVATED', tone: 'warn' };
    return { label: 'NOMINAL', tone: 'good' };
  }
  function sevOf(cf) {
    return cf < 0 ? 'good' : cf >= 0.4 ? 'crit' : cf >= 0.2 ? 'warn' : 'good';
  }

  $: sits = ($situations?.active ?? []).slice().sort((a, b) => b.crisis_factor - a.crisis_factor);
  $: maxCf = Math.max(...sits.map((s) => Math.abs(s.crisis_factor)), 0.0001);
  $: tier = loadTier($isLiveYear ? $situationLoad : null);
</script>

{#if $isLiveYear}
  <div class="sb-load" style="border-color:{toneColor(tier.tone)}">
    <div class="sb-gauge"><CrisisGauge factor={$situationLoad} /></div>
    <div class="sb-tier" style="color:{toneColor(tier.tone)}; border-color:{toneColor(tier.tone)}">{tier.label}</div>
  </div>

  <div class="sb-cards">
    {#each sits as s (s.name)}
      {@const sev = sevOf(s.crisis_factor)}
      <div class="sb-card" style="border-left-color:{toneColor(sev)}">
        <div class="sb-card-head">
          <h3 class="sb-name">{s.crisis_factor < 0 ? '✚' : '⚠'} {s.name}</h3>
          <span class="sb-cf" style="color:{toneColor(sev)}"
            >{s.crisis_factor >= 0 ? '+' : '−'}{Math.abs(s.crisis_factor).toFixed(2)} load</span
          >
        </div>
        {#if s.description}<p class="sb-desc">{s.description}</p>{/if}
        <MiniBar frac={Math.abs(s.crisis_factor) / maxCf} color={toneColor(sev)} />
      </div>
    {/each}
    {#if sits.length === 0}
      <p class="sb-empty">No active situations this year.</p>
    {/if}
  </div>
{:else}
  <p class="sb-empty">Archive year — no situation record.</p>
{/if}

<style>
  .sb-load {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
    align-items: center;
    padding: 14px 16px;
    border: 2px solid var(--border);
    background: var(--bg);
    margin-bottom: 12px;
  }
  .sb-gauge {
    min-width: 0;
  }
  .sb-tier {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 5px 11px;
    border: 2px solid currentColor;
    white-space: nowrap;
  }
  .sb-cards {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .sb-card {
    padding: 12px 14px 12px 16px;
    border-left: 4px solid var(--crit);
    border-top: 1px solid var(--border-soft);
    border-right: 1px solid var(--border-soft);
    border-bottom: 1px solid var(--border-soft);
    background: var(--bg);
  }
  .sb-card-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
  }
  .sb-name {
    margin: 0;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 700;
  }
  .sb-cf {
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .sb-desc {
    margin: 6px 0 9px;
    font-size: 11px;
    color: var(--fg-dim);
    line-height: 1.45;
  }
  .sb-empty {
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.18em;
    padding: 12px 0;
  }
</style>
