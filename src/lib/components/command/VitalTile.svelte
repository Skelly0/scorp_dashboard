<script>
  // One headline vital with a click/keyboard-expandable drill-down. Presentational
  // only — the parent (VitalSigns) computes value/tone/spark/delta/detail so the
  // parity-critical maths lives in one place.
  import MiniBar from '../MiniBar.svelte';
  import Sparkline from '../Sparkline.svelte';
  import { toneColor } from '../../command-format.js';

  export let label;
  export let value;
  export let prefix = '';
  export let suffix = '';
  export let sub = '';
  export let tone = null;
  export let sparkData = null;
  export let sparkColor = 'var(--accent)';
  /** @type {{text:string, arrow:string, tone:string}|null} */
  export let delta = null;
  /** @type {{rows:Array, note:string}|null} */
  export let detail = null;
  export let tag = null;

  let open = false;
  function toggle() {
    open = !open;
  }
  function onKey(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  }
</script>

<div
  class="vital"
  class:open
  role="button"
  tabindex="0"
  aria-expanded={open}
  on:click={toggle}
  on:keydown={onKey}
>
  <div class="vital-head">
    <span class="vital-label">{label}</span>
    <span class="vital-exp" aria-hidden="true">{open ? '−' : '+'}</span>
  </div>
  {#if tag}<span class="crisis-over-tag" aria-hidden="true">{tag}</span>{/if}
  <div class="vital-num" style={tone ? `color:${toneColor(tone)}` : ''}>{prefix}{value}{suffix}</div>
  {#if sub}<div class="vital-sub">{sub}</div>{/if}
  <div class="vital-foot">
    {#if delta}<span class="vital-delta" style="color:{toneColor(delta.tone)}">{delta.arrow} {delta.text}</span>{/if}
    {#if sparkData}<span class="vital-spark"><Sparkline data={sparkData} color={sparkColor} /></span>{/if}
  </div>
  {#if open && detail}
    <div class="vital-detail">
      {#each detail.rows as row (row.label)}
        <div class="vd-row">
          <span class="vd-label">{row.label}</span>
          <span class="vd-val" style={row.tone ? `color:${toneColor(row.tone)}` : ''}>{row.valueText}</span>
          <div class="vd-bar"><MiniBar frac={row.frac} color={row.color ?? toneColor(row.tone)} /></div>
        </div>
      {/each}
      {#if detail.note}<div class="vd-note">{detail.note}</div>{/if}
    </div>
  {/if}
</div>

<style>
  .vital {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 16px;
    border: 2px solid var(--border);
    background: var(--bg);
    min-height: 142px;
    cursor: pointer;
    min-width: 0;
  }
  .vital:hover {
    border-color: var(--accent);
  }
  .vital-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .vital-label {
    font-size: 10px;
    letter-spacing: 0.22em;
    color: var(--muted);
    text-transform: uppercase;
  }
  .vital-exp {
    font-size: 12px;
    color: var(--muted);
  }
  .vital-num {
    font-size: clamp(1.5rem, 17cqi, 50px);
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .vital-sub {
    font-size: 9.5px;
    letter-spacing: 0.06em;
    color: var(--muted);
    text-transform: uppercase;
  }
  .vital-foot {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    font-size: 11px;
    color: var(--fg-dim);
    margin-top: auto;
  }
  .vital-delta {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .vital-spark {
    flex: 1;
    min-width: 54px;
  }
  /* Reuse the global .crisis-over-tag (crit outline + reduced-motion-safe blink)
     but let it sit inline in the tile instead of its default absolute corner. */
  .vital :global(.crisis-over-tag) {
    position: static;
    align-self: flex-start;
  }
  .vital-detail {
    margin-top: 6px;
    border-top: 1px dashed var(--border-soft);
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .vd-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 3px 10px;
    align-items: baseline;
  }
  .vd-label {
    font-size: 10px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .vd-val {
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .vd-bar {
    grid-column: 1 / -1;
  }
  .vd-note {
    font-size: 10px;
    color: var(--muted);
    font-style: italic;
  }
</style>
