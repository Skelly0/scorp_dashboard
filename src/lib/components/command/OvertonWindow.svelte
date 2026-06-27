<script>
  // Overton window: six axis rows, each a track (with prev-year ghost + party
  // markers) that expands to the party position list. Party stances are
  // year-independent (current parties.json), shown on every year.
  import OvertonTrack from './OvertonTrack.svelte';
  import Swatch from '../Swatch.svelte';
  import { currentFrame, prevFrame } from '../../stores/timeline.js';
  import { parties } from '../../stores/parties.js';
  import { partyColor } from '../../faction-colors.js';

  const AXES = [
    { axis: 'expansion', lo: 'Expansion', hi: 'Conservation' },
    { axis: 'authority', lo: 'Authoritarian', hi: 'Democratic' },
    { axis: 'corporate', lo: 'Corporate', hi: 'Communal' },
    { axis: 'technocratic', lo: 'Technocratic', hi: 'Populist' },
    { axis: 'faith', lo: 'Faith', hi: 'Reason' },
    { axis: 'materialist', lo: 'Materialist', hi: 'Idealist' },
  ];

  // Deterministic fallback hues for parties with no pinned brand colour, so
  // markers stay distinguishable on the track.
  const FALLBACK = ['#d1426f', '#c0392b', '#16a085', '#8e44ad', '#2980b9', '#d35400', '#7f8c8d'];

  let openAxis = null;
  function toggle(axis) {
    openAxis = openAxis === axis ? null : axis;
  }
  function onKey(event, axis) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle(axis);
    }
  }

  $: partyList = ($parties?.parties ?? []).map((p, i) => ({
    name: p.name,
    color: partyColor(p.name) ?? FALLBACK[i % FALLBACK.length],
    stance: p.stance ?? {},
  }));

  function markersFor(axis) {
    return partyList
      .filter((p) => Number.isFinite(p.stance[axis]))
      .map((p) => ({ name: p.name, color: p.color, pos: p.stance[axis] }));
  }
  function partyRows(axis) {
    return markersFor(axis).slice().sort((a, b) => a.pos - b.pos);
  }

  $: rows = AXES.map((d) => {
    const value = $currentFrame?.overton?.[d.axis] ?? null;
    const prevValue = $prevFrame?.overton?.[d.axis] ?? null;
    const shift = prevValue != null && value != null ? value - prevValue : 0;
    return {
      ...d,
      value,
      prevValue,
      valueText: value != null ? value.toFixed(1) : '—',
      tone: Math.abs(shift) >= 1.5 ? 'warn' : null,
    };
  });
</script>

<div class="ow">
  {#each rows as r (r.axis)}
    <div class="ow-axis">
      <div
        class="ow-head"
        role="button"
        tabindex="0"
        aria-expanded={openAxis === r.axis}
        on:click={() => toggle(r.axis)}
        on:keydown={(e) => onKey(e, r.axis)}
      >
        <div class="ow-pole ow-pole-lo">{r.lo}</div>
        <div class="ow-track">
          <OvertonTrack
            value={r.value}
            prevValue={r.prevValue}
            parties={markersFor(r.axis)}
            showParties={openAxis === r.axis}
          />
        </div>
        <div class="ow-pole ow-pole-hi">{r.hi}</div>
        <div class="ow-value" style={r.tone === 'warn' ? 'color:var(--warn)' : ''}>{r.valueText}</div>
      </div>
      {#if openAxis === r.axis}
        <div class="ow-parties">
          <div class="ow-parties-cap">Party positions · {r.lo} ↔ {r.hi}</div>
          {#each partyRows(r.axis) as p (p.name)}
            <div class="ow-party">
              <Swatch color={p.color} width="12px" height="12px" />
              <span class="ow-party-name">{p.name}</span>
              <span class="ow-party-val">{p.pos.toFixed(1)}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .ow {
    border: 2px solid var(--border);
    background: var(--bg);
    padding: 6px 16px;
  }
  .ow-head {
    display: grid;
    grid-template-columns: 94px 1fr 94px 36px;
    gap: 10px;
    align-items: center;
    padding: 9px 0;
    border-bottom: 1px dashed var(--border-soft);
    cursor: pointer;
    font-size: 11px;
  }
  .ow-head:hover {
    background: var(--accent-soft);
  }
  .ow-pole {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--fg-dim);
  }
  .ow-pole-lo {
    text-align: right;
  }
  .ow-track {
    min-width: 0;
  }
  .ow-value {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
  .ow-parties {
    padding: 8px 0 12px 94px;
    display: grid;
    gap: 6px;
  }
  .ow-parties-cap {
    font-size: 9px;
    color: var(--muted);
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .ow-party {
    display: grid;
    grid-template-columns: 14px 1fr auto;
    gap: 9px;
    align-items: center;
    font-size: 11px;
  }
  .ow-party-val {
    font-variant-numeric: tabular-nums;
    color: var(--fg-dim);
  }
  @media (max-width: 560px) {
    .ow-head {
      grid-template-columns: 70px 1fr 70px 30px;
      gap: 6px;
    }
    .ow-parties {
      padding-left: 0;
    }
  }
</style>
