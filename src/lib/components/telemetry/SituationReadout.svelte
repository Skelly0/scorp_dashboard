<script>
  // Compact situation ticker for the Telemetry view. Live-only (situations have
  // no per-year history); the section meta echoes the colony-wide load + tier.
  import MiniBar from '../MiniBar.svelte';
  import { isLiveYear } from '../../stores/timeline.js';
  import { situations } from '../../stores/situations.js';
  import { situationLoad } from '../../stores/crisis.js';
  import { toneColor } from '../../command-format.js';

  function tierLabel(load) {
    if (load == null) return 'ARCHIVE';
    if (load > 1.0001) return 'BREACH';
    if (load >= 0.95) return 'AT CAPACITY';
    if (load >= 0.6) return 'ELEVATED';
    return 'NOMINAL';
  }
  function sevOf(cf) {
    return cf < 0 ? 'good' : cf >= 0.4 ? 'crit' : cf >= 0.2 ? 'warn' : 'good';
  }

  $: live = $isLiveYear;
  $: sits = live ? ($situations?.active ?? []).slice().sort((a, b) => b.crisis_factor - a.crisis_factor) : [];
  $: maxCf = Math.max(...sits.map((s) => Math.abs(s.crisis_factor)), 0.0001);
  $: loadText = live && $situationLoad != null ? $situationLoad.toFixed(2) : '—';
  $: tier = tierLabel(live ? $situationLoad : null);
</script>

<div class="sr-head">
  <span class="sr-meta">Load {loadText} · {tier}</span>
</div>
<div class="sr-list">
  {#each sits as s (s.name)}
    {@const sev = sevOf(s.crisis_factor)}
    <div class="sr-row">
      <span class="sr-name">{s.name}</span>
      <div class="sr-bar"><MiniBar frac={Math.abs(s.crisis_factor) / maxCf} color={toneColor(sev)} /></div>
      <span class="sr-cf" style="color:{toneColor(sev)}">{s.crisis_factor >= 0 ? '+' : '−'}{Math.abs(s.crisis_factor).toFixed(2)}</span>
    </div>
  {/each}
  {#if sits.length === 0}
    <p class="sr-empty">Board clear — no active situations.</p>
  {/if}
</div>

<style>
  .sr-head {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 6px;
  }
  .sr-meta {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--fg-dim);
  }
  .sr-list {
    border: 2px solid var(--border);
    background: var(--bg);
    padding: 6px 16px;
  }
  .sr-row {
    display: grid;
    grid-template-columns: 1fr 90px 50px;
    gap: 12px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px dashed var(--border-soft);
  }
  .sr-row:last-child {
    border-bottom: none;
  }
  .sr-name {
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    min-width: 0;
  }
  .sr-cf {
    text-align: right;
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .sr-empty {
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.18em;
    padding: 14px 0;
  }
</style>
