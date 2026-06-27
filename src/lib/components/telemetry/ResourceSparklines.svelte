<script>
  // A sparkline card per resource for the shown year, with the running series
  // taken across all years up to the cursor. Ported from the mock's
  // telemetry.sparks. Reuses the shared Sparkline component.
  import Sparkline from '../Sparkline.svelte';
  import { frames, currentFrame, effectiveIdx } from '../../stores/timeline.js';
  import { fmtInt, fmtSigned, toneColor } from '../../command-format.js';

  $: resources = $currentFrame?.resources ?? [];
  $: hist = $frames.slice(0, $effectiveIdx + 1);

  function series(name) {
    return hist.map((f) => f.resourcesByName?.[name.toLowerCase()]?.current).filter((v) => v != null);
  }
</script>

<div class="rs-grid">
  {#each resources as r (r.name)}
    <div class="rs-card">
      <div class="rs-head">
        <span class="rs-name">{r.name}</span>
        <span class="rs-net" style="color:{toneColor(r.net >= 0 ? 'good' : 'crit')}">{fmtSigned(r.net, 0)}</span>
      </div>
      <div class="rs-val">{fmtInt(r.current)}</div>
      <Sparkline data={series(r.name)} color={r.color} />
    </div>
  {/each}
  {#if resources.length === 0}
    <p class="rs-empty">No resource telemetry for this year.</p>
  {/if}
</div>

<style>
  .rs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }
  .rs-card {
    border: 2px solid var(--border);
    background: var(--bg);
    padding: 13px 14px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .rs-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .rs-name {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--fg-dim);
  }
  .rs-net {
    font-size: 10px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .rs-val {
    font-size: 20px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .rs-empty {
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.18em;
  }
</style>
