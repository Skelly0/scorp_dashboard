<script>
  // Resource list with Reserve / Net / Flow views and per-row drill-down.
  // Ported from the mock's resources/resourceTabs assembly. Money and Housing
  // are already excluded upstream (timeline-frames).
  import MiniBar from '../MiniBar.svelte';
  import Swatch from '../Swatch.svelte';
  import { currentFrame } from '../../stores/timeline.js';
  import { fmtInt, toneColor, clamp } from '../../command-format.js';

  const TABS = [
    ['reserve', 'Reserve'],
    ['net', 'Net / yr'],
    ['flow', 'Flow'],
  ];

  let rv = 'reserve';
  let openName = null;

  function toggle(name) {
    openName = openName === name ? null : name;
  }
  function onKey(event, name) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle(name);
    }
  }

  $: resources = $currentFrame?.resources ?? [];
  $: maxRes = Math.max(...resources.map((r) => r.current ?? 0), 1);
  $: maxNet = Math.max(...resources.map((r) => Math.abs(r.net ?? 0)), 1);

  function view(r, mode = rv) {
    const income = r.income ?? 0;
    const upkeep = r.upkeep ?? 0;
    const net = r.net ?? 0;
    const reserve = r.current ?? 0;
    if (mode === 'net') {
      const pos = net >= 0;
      return {
        value: `${pos ? '+' : '−'}${fmtInt(Math.abs(net))}`,
        valueTone: pos ? 'good' : 'crit',
        subA: `+${fmtInt(income)} in/yr`,
        subATone: 'good',
        subB: `−${fmtInt(upkeep)} out/yr`,
        subBTone: 'crit',
        frac: Math.abs(net) / maxNet,
        barColor: pos ? 'var(--good)' : 'var(--crit)',
      };
    }
    if (mode === 'flow') {
      return {
        value: fmtInt(income),
        valueTone: null,
        subA: `reserve ${fmtInt(reserve)}`,
        subATone: 'muted',
        subB: `−${fmtInt(upkeep)} out/yr`,
        subBTone: 'crit',
        frac: clamp(upkeep / Math.max(income, 1), 0, 1),
        barColor: upkeep > income ? 'var(--crit)' : r.color,
      };
    }
    return {
      value: fmtInt(reserve),
      valueTone: null,
      subA: `+${fmtInt(income)} in/yr`,
      subATone: 'good',
      subB: `−${fmtInt(upkeep)} out/yr`,
      subBTone: 'crit',
      frac: reserve / maxRes,
      barColor: r.color,
    };
  }

  function detailRows(r) {
    const income = r.income ?? 0;
    const upkeep = r.upkeep ?? 0;
    const net = r.net ?? 0;
    const reserve = r.current ?? 0;
    const fmx = Math.max(income, upkeep, 1);
    return [
      { label: 'Income / yr', valueText: `+${fmtInt(income)}`, tone: 'good', frac: income / fmx },
      { label: 'Upkeep / yr', valueText: `−${fmtInt(upkeep)}`, tone: 'crit', frac: upkeep / fmx },
      {
        label: 'Net / yr',
        valueText: `${net >= 0 ? '+' : '−'}${fmtInt(Math.abs(net))}`,
        tone: net >= 0 ? 'good' : 'crit',
        frac: Math.abs(net) / maxNet,
      },
      { label: 'Reserve', valueText: fmtInt(reserve), tone: null, frac: reserve / maxRes, color: toneColor('muted') },
    ];
  }
</script>

<div class="rt-tabs">
  {#each TABS as [key, label] (key)}
    <button type="button" class:active={rv === key} aria-pressed={rv === key} on:click={() => (rv = key)}>{label}</button>
  {/each}
</div>

<div class="rt-list">
  {#each resources as r (r.name)}
    {@const v = view(r, rv)}
    <div
      class="rt-row"
      role="button"
      tabindex="0"
      aria-expanded={openName === r.name}
      on:click={() => toggle(r.name)}
      on:keydown={(e) => onKey(e, r.name)}
    >
      <div class="rt-swatch"><Swatch color={r.color} width="4px" height="100%" /></div>
      <div class="rt-body">
        <div class="rt-top">
          <span class="rt-name">{r.name}</span>
          <span class="rt-val" style={v.valueTone ? `color:${toneColor(v.valueTone)}` : ''}>{v.value}</span>
        </div>
        <MiniBar frac={v.frac} color={v.barColor} height={8} />
        <div class="rt-subs">
          <span style="color:{toneColor(v.subATone)}">{v.subA}</span>
          <span style="color:{toneColor(v.subBTone)}">{v.subB}</span>
        </div>
        {#if openName === r.name}
          <div class="rt-detail">
            {#each detailRows(r) as row (row.label)}
              <div class="rt-drow">
                <span class="rt-dlabel">{row.label}</span>
                <span class="rt-dval" style={row.tone ? `color:${toneColor(row.tone)}` : ''}>{row.valueText}</span>
                <div class="rt-dbar"><MiniBar frac={row.frac} color={row.color ?? toneColor(row.tone)} /></div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/each}
  {#if resources.length === 0}
    <p class="rt-empty">No resource telemetry for this year.</p>
  {/if}
</div>

<style>
  .rt-tabs {
    display: flex;
    border: 1px solid var(--border-soft);
    margin-bottom: 10px;
    width: fit-content;
  }
  .rt-tabs button {
    background: transparent;
    color: var(--fg-dim);
    border: none;
    border-right: 1px solid var(--border-soft);
    padding: 7px 13px;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    cursor: pointer;
    font-family: inherit;
  }
  .rt-tabs button:last-child {
    border-right: none;
  }
  .rt-tabs button:hover {
    color: var(--accent);
  }
  .rt-tabs button.active {
    background: var(--accent);
    color: var(--alert-fg, var(--bg));
  }
  .rt-list {
    border: 2px solid var(--border);
    background: var(--bg);
  }
  .rt-row {
    display: flex;
    gap: 12px;
    padding: 11px 14px;
    border-bottom: 1px solid var(--border-soft);
    cursor: pointer;
    align-items: stretch;
  }
  .rt-row:last-child {
    border-bottom: none;
  }
  .rt-row:hover {
    background: var(--accent-soft);
  }
  .rt-swatch {
    width: 4px;
    flex: 0 0 4px;
    align-self: stretch;
  }
  .rt-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .rt-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }
  .rt-name {
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--fg);
  }
  .rt-val {
    font-size: 18px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .rt-subs {
    display: flex;
    gap: 12px;
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }
  .rt-detail {
    border-top: 1px dashed var(--border-soft);
    padding-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .rt-drow {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 10px;
    align-items: baseline;
  }
  .rt-dlabel {
    font-size: 10px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .rt-dval {
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .rt-dbar {
    grid-column: 1 / -1;
  }
  .rt-empty {
    padding: 14px;
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.18em;
  }
</style>
