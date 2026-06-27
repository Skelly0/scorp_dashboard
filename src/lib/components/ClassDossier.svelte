<script>
  // Selected-class dossier for the Census Quadrant view: headline stats, a
  // zone read, and the three weakest satisfaction drivers. Read-only — selection
  // is owned by the page and driven from the scatter / composition strip.
  import CBar from './CBar.svelte';
  import { FACET_ORDER, facetTone, satTone, radTone, zoneOf } from '../census.js';
  import { fmtInt, fmtPct } from '../format.js';

  /** @type {import('../census.js').buildCensus extends any ? any : any} */
  export let cls = null;

  const READS = {
    Flashpoint:
      'High radicalisation paired with low satisfaction — the colony’s most volatile bloc. Concessions here buy the most stability.',
    Agitated:
      'Comfortable enough materially, but radicalised. Discontent is political, not material.',
    Resigned:
      'Low satisfaction yet low radicalisation — grievance without organisation. Could tip if a catalyst organises them.',
    Content: 'Satisfied and quiescent — a stabilising bloc the administration can lean on.',
  };

  $: zone = cls && Number.isFinite(cls.sat) && Number.isFinite(cls.rad) ? zoneOf(cls.sat, cls.rad) : null;
  $: bigStats = cls
    ? [
        { label: 'Population', value: fmtInt(cls.pop), tone: null },
        { label: 'Satisfaction', value: fmtPct(cls.sat), tone: satTone(cls.sat) },
        { label: 'Radicalisation', value: fmtPct(cls.rad), tone: radTone(cls.rad) },
        { label: 'Vote share', value: fmtPct(cls.vote, 1), tone: null },
      ]
    : [];
  $: weakest = cls
    ? FACET_ORDER.map(([k, l]) => ({ label: l, v: cls.facets?.[k] }))
        .filter((f) => Number.isFinite(f.v))
        .sort((a, b) => a.v - b.v)
        .slice(0, 3)
        .map((f) => ({ label: f.label, valueText: fmtPct(f.v), tone: facetTone(f.v), frac: f.v }))
    : [];
  $: toneStyle = (tone) =>
    tone === 'crit'
      ? 'color:var(--crit)'
      : tone === 'warn'
        ? 'color:var(--warn)'
        : tone === 'good'
          ? 'color:var(--good)'
          : '';
</script>

<div class="dossier">
  {#if cls}
    <div class="dossier-head">
      <span class="dossier-swatch" style="background:{cls.color}"></span>
      <div>
        <div class="dossier-name">{cls.name}</div>
        <div class="dossier-sub">{cls.tier ?? '—'} · {zone ?? '—'}</div>
      </div>
    </div>

    <div class="dossier-stats">
      {#each bigStats as b}
        <div class="dossier-stat">
          <div class="dossier-stat-label">{b.label}</div>
          <div class="dossier-stat-val" style={toneStyle(b.tone)}>{b.value}</div>
        </div>
      {/each}
    </div>

    {#if zone}
      <p class="dossier-read">{READS[zone]}</p>
    {/if}

    <div class="dossier-weak-head">Weakest drivers</div>
    <div class="dossier-weak">
      {#each weakest as w}
        <div class="dossier-weak-row">
          <span class="dossier-weak-label">{w.label}</span>
          <CBar value={w.frac} tone={w.tone} />
          <span class="dossier-weak-val" style={toneStyle(w.tone)}>{w.valueText}</span>
        </div>
      {/each}
    </div>
  {:else}
    <p class="dossier-empty">Select a class to inspect its dossier.</p>
  {/if}
</div>

<style>
  .dossier {
    border: 2px solid var(--border);
    background: var(--bg);
    padding: 16px;
  }
  .dossier-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .dossier-swatch {
    width: 10px;
    height: 30px;
    display: inline-block;
    flex: 0 0 10px;
  }
  .dossier-name {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  .dossier-sub {
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .dossier-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 14px;
  }
  .dossier-stat {
    border-top: 2px solid var(--border-soft);
    padding-top: 7px;
  }
  .dossier-stat-label {
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .dossier-stat-val {
    font-size: 22px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
    margin-top: 3px;
  }
  .dossier-read {
    margin: 0 0 14px;
    font-size: 11.5px;
    line-height: 1.55;
    color: var(--fg-dim);
    border-left: 2px solid var(--border-soft);
    padding-left: 12px;
  }
  .dossier-weak-head {
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .dossier-weak {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .dossier-weak-row {
    display: grid;
    grid-template-columns: 90px 1fr auto;
    gap: 10px;
    align-items: center;
  }
  .dossier-weak-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-dim);
  }
  .dossier-weak-val {
    font-size: 10px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .dossier-empty {
    margin: 0;
    font-size: 11px;
    color: var(--muted);
  }
</style>
