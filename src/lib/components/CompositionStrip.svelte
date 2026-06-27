<script>
  // Population composition bar + legend for the Census Quadrant view. Segment
  // width ∝ population share; fill recolours by the active metric (class colour,
  // satisfaction tone, or radicalisation tone). Clicking a segment/legend entry
  // selects that class.
  import { createEventDispatcher } from 'svelte';
  import { satTone, radTone, toneVar } from '../census.js';
  import { fmtInt, fmtPct } from '../format.js';

  export let classes = [];
  export let totalPop = 0;
  export let mode = 'class'; // 'class' | 'sat' | 'rad'

  const dispatch = createEventDispatcher();

  $: segments = classes
    .filter((c) => Number.isFinite(c.pop) && c.pop > 0)
    .slice()
    .sort((a, b) => b.pop - a.pop)
    .map((c) => {
      const share = totalPop > 0 ? c.pop / totalPop : 0;
      let fill = c.color;
      let metricText = fmtPct(share, 1);
      let metricTone = null;
      if (mode === 'sat') {
        metricTone = satTone(c.sat);
        fill = toneVar(metricTone);
        metricText = fmtPct(c.sat);
      } else if (mode === 'rad') {
        metricTone = radTone(c.rad);
        fill = toneVar(metricTone);
        metricText = fmtPct(c.rad);
      }
      return {
        name: c.name,
        color: c.color,
        fill,
        widthCss: `${(share * 100).toFixed(2)}%`,
        title: `${c.name} · ${fmtInt(c.pop)} (${fmtPct(share, 1)})`,
        metricText,
        metricTone,
      };
    });

  function toneStyle(tone) {
    return tone ? `color:${toneVar(tone)}` : 'color:var(--muted)';
  }
</script>

<div class="comp-bar" role="img" aria-label="Population composition">
  {#each segments as seg (seg.name)}
    <button
      type="button"
      class="comp-seg"
      style="width:{seg.widthCss}; background:{seg.fill};"
      title={seg.title}
      aria-label={seg.title}
      on:click={() => dispatch('select', seg.name)}
    ></button>
  {/each}
</div>

<div class="comp-legend">
  {#each segments as seg (seg.name)}
    <button type="button" class="comp-legend-item" on:click={() => dispatch('select', seg.name)}>
      <span class="comp-dot" style="background:{seg.color}"></span>
      <span class="comp-name">{seg.name}</span>
      <span class="comp-metric" style={toneStyle(seg.metricTone)}>{seg.metricText}</span>
    </button>
  {/each}
</div>

<style>
  .comp-bar {
    display: flex;
    height: 46px;
    border: 1px solid var(--border-soft);
    overflow: hidden;
  }
  .comp-seg {
    height: 100%;
    border: none;
    border-right: 1px solid var(--bg);
    padding: 0;
    cursor: pointer;
  }
  .comp-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    margin-top: 12px;
  }
  .comp-legend-item {
    display: flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    font-size: 10px;
    background: transparent;
    border: none;
    padding: 0;
    color: inherit;
  }
  .comp-legend-item:hover .comp-name {
    color: var(--accent);
  }
  .comp-dot {
    width: 11px;
    height: 11px;
    display: inline-block;
    flex: 0 0 11px;
  }
  .comp-name {
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .comp-metric {
    font-variant-numeric: tabular-nums;
  }
</style>
