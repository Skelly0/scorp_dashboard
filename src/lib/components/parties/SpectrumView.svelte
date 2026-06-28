<script>
  // Parties "Spectrum" tab: selectable-axis worldview scatter + a dossier for the
  // focused party (radar, vote/supporters, 6-axis tracks). The party chip row is
  // the keyboard-operable selector; the scatter bubbles mirror it for pointer.
  import Band from '../Band.svelte';
  import RadarChart from '../RadarChart.svelte';
  import SpectrumScatter from './SpectrumScatter.svelte';
  import { WORLDVIEW_AXES as AXES, AXIS_HIGH_LABELS } from '../../worldview.js';
  import { AXIS_LOW_LABELS } from '../../party-ideology.js';
  import { fmtInt, fmtPct } from '../../format.js';

  /** @type {Array<{name, color, leanLabel, stance, vote_share, supporters}>} */
  export let parties = [];

  const axisMeta = AXES.map((key) => ({
    key,
    name: AXIS_LOW_LABELS[key],
    lo: AXIS_LOW_LABELS[key],
    hi: AXIS_HIGH_LABELS[key],
  }));

  let xKey = 'corporate';
  let yKey = 'authority';
  let selectedName = null;

  $: selected = parties.find((p) => p.name === selectedName) ?? parties[0] ?? null;
  $: xMeta = axisMeta.find((a) => a.key === xKey);
  $: yMeta = axisMeta.find((a) => a.key === yKey);

  function trackPos(v) {
    return (((v ?? 4) - 1) / 6) * 100;
  }
</script>

<Band num="01" title="Worldview Spectrum" meta="Click a party" />
<div class="spectrum-grid">
  <div class="s-card s-card-pad">
    <div class="axis-pickers">
      <div class="axis-picker">
        <span class="axis-picker-lbl">Horizontal axis</span>
        <div class="layer-tabs">
          {#each axisMeta as a (a.key)}
            <button type="button" aria-pressed={xKey === a.key} title="{a.lo} ↔ {a.hi}" on:click={() => (xKey = a.key)}>{a.name}</button>
          {/each}
        </div>
      </div>
      <div class="axis-picker">
        <span class="axis-picker-lbl">Vertical axis</span>
        <div class="layer-tabs">
          {#each axisMeta as a (a.key)}
            <button type="button" aria-pressed={yKey === a.key} title="{a.lo} ↔ {a.hi}" on:click={() => (yKey = a.key)}>{a.name}</button>
          {/each}
        </div>
      </div>
    </div>
    <SpectrumScatter
      {parties}
      {xKey}
      {yKey}
      {xMeta}
      {yMeta}
      selected={selected?.name}
      onSelect={(name) => (selectedName = name)}
    />
  </div>

  <div class="s-card s-card-pad">
    <div class="dossier-pick" role="group" aria-label="Select party">
      {#each parties as p (p.name)}
        <button
          type="button"
          class="dossier-chip"
          class:on={selected?.name === p.name}
          aria-pressed={selected?.name === p.name}
          on:click={() => (selectedName = p.name)}
        >
          <span class="dossier-chip-sw" style="background: {p.color}"></span>
          {p.name}
        </button>
      {/each}
    </div>

    {#if selected}
      <div class="dossier-head">
        <span class="dossier-bar" style="background: {selected.color}"></span>
        <div>
          <div class="dossier-name">{selected.name}</div>
          <div class="dossier-lean">Dominant lean · {selected.leanLabel}</div>
        </div>
      </div>
      <div class="dossier-mid">
        <div class="dossier-radar">
          <RadarChart
            axes={AXES.map((a) => ({ label: AXIS_HIGH_LABELS[a], value: selected.stance?.[a] ?? 0 }))}
            size={170}
            accent={selected.color}
          />
        </div>
        <div class="dossier-stats">
          <div class="dossier-stat">
            <div class="dossier-stat-lbl">Vote share</div>
            <div class="dossier-stat-val tnum">{fmtPct(selected.vote_share)}</div>
          </div>
          <div class="dossier-stat">
            <div class="dossier-stat-lbl">Supporters</div>
            <div class="dossier-stat-val tnum">{fmtInt(selected.supporters)}</div>
          </div>
        </div>
      </div>
      <div class="dossier-axes-lbl">Worldview · 6 axes</div>
      <div class="dossier-axes">
        {#each axisMeta as a (a.key)}
          {@const v = selected.stance?.[a.key]}
          <div class="dossier-axis">
            <div class="dossier-axis-poles">
              <span class:lit={v < 3.5}>{a.lo}</span>
              <span class:lit={v > 4.5}>{a.hi}</span>
            </div>
            <div class="dossier-track">
              {#each [1, 2, 3, 4, 5, 6, 7] as t}
                <span class="dossier-tick" style="left: {((t - 1) / 6) * 100}%"></span>
              {/each}
              <span class="dossier-mid-tick"></span>
              <span class="dossier-marker" style="left: {trackPos(v)}%"></span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .spectrum-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
  @media (min-width: 1100px) {
    .spectrum-grid {
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
      align-items: start;
    }
  }
  .axis-pickers { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 12px; }
  .axis-picker { display: flex; flex-direction: column; gap: 5px; }
  .axis-picker-lbl {
    font-size: 8.5px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .dossier-pick {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
  }
  .dossier-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--border-soft);
    background: var(--bg);
    color: var(--fg-dim);
    font-family: inherit;
    font-size: 10px;
    letter-spacing: 0.02em;
    padding: 5px 8px;
    cursor: pointer;
  }
  .dossier-chip:hover { border-color: var(--accent); color: var(--accent); }
  .dossier-chip.on { border-color: var(--accent); color: var(--fg); box-shadow: inset 0 0 0 1px var(--accent); }
  .dossier-chip-sw { width: 9px; height: 9px; flex: 0 0 9px; }

  .dossier-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
  .dossier-bar { width: 10px; height: 34px; flex: 0 0 10px; }
  .dossier-name { font-size: 16px; font-weight: 800; line-height: 1.15; }
  .dossier-lean {
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    margin-top: 3px;
  }
  .dossier-mid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 16px;
    align-items: center;
    margin-bottom: 14px;
  }
  .dossier-radar { width: 180px; }
  .dossier-radar :global(svg) { width: 100%; height: auto; }
  .dossier-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .dossier-stat { border-top: 2px solid var(--border-soft); padding-top: 6px; }
  .dossier-stat-lbl {
    font-size: 8.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .dossier-stat-val { font-size: 18px; font-weight: 800; line-height: 1.1; margin-top: 2px; }
  .dossier-axes-lbl {
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 9px;
  }
  .dossier-axes { display: flex; flex-direction: column; gap: 9px; }
  .dossier-axis-poles {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fg-dim);
    margin-bottom: 3px;
  }
  .dossier-axis-poles .lit { color: var(--good); }
  .dossier-track {
    position: relative;
    height: 12px;
    background: var(--bg-2);
    border: 1px solid var(--border-soft);
  }
  .dossier-tick {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--border-soft);
  }
  .dossier-mid-tick {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    background: var(--border-soft);
  }
  .dossier-marker {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 3px;
    transform: translateX(-1.5px);
    background: var(--accent);
  }
</style>
