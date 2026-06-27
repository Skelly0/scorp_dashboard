<script>
  // Expandable colony-indicator tile for the Census Register view. Click/Enter
  // toggles a dashed detail panel of driver rows + a note. Optional history
  // sparkline preserves the old Demographics KPI trend lines.
  import { createEventDispatcher } from 'svelte';
  import CBar from './CBar.svelte';
  import Sparkline from './Sparkline.svelte';
  import { toneVar } from '../census.js';

  /** @type {{
   *   label: string, value: string, sub: string, tone?: string|null,
   *   bar?: {frac: number, tone?: string|null, color?: string|null},
   *   history?: number[]|null, historyColor?: string,
   *   detail?: { rows?: {label:string,valueText:string,tone?:string|null,bar?:{frac:number,tone?:string|null,color?:string|null}}[], note?: string }
   * }} */
  export let tile;
  export let open = false;

  const dispatch = createEventDispatcher();
  function toggle() {
    dispatch('toggle');
  }
  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  }
</script>

<div
  class="ckpi"
  role="button"
  tabindex="0"
  aria-expanded={open}
  on:click={toggle}
  on:keydown={onKey}
>
  <div class="ckpi-head">
    <span class="ckpi-label">{tile.label}</span>
    <span class="ckpi-glyph">{open ? '−' : '+'}</span>
  </div>
  <div class="ckpi-value" style={tile.tone ? `color:${toneVar(tile.tone)}` : ''}>
    {tile.value}
  </div>
  <div class="ckpi-sub">{tile.sub}</div>
  {#if tile.history && tile.history.length >= 2}
    <div class="ckpi-spark">
      <Sparkline data={tile.history} color={tile.historyColor ?? 'var(--accent)'} width={160} height={22} />
    </div>
  {/if}
  {#if tile.bar}
    <div class="ckpi-bar">
      <CBar value={tile.bar.frac} tone={tile.bar.tone} color={tile.bar.color} />
    </div>
  {/if}

  {#if open && tile.detail}
    <div class="ckpi-detail">
      {#each tile.detail.rows ?? [] as row}
        <div class="ckpi-row">
          <span class="ckpi-row-label">{row.label}</span>
          <span class="ckpi-row-val" style={row.tone ? `color:${toneVar(row.tone)}` : ''}>
            {row.valueText}
          </span>
          {#if row.bar}
            <div class="ckpi-row-bar">
              <CBar value={row.bar.frac} tone={row.bar.tone} color={row.bar.color} />
            </div>
          {/if}
        </div>
      {/each}
      {#if tile.detail.note}
        <p class="ckpi-note">{tile.detail.note}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .ckpi {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 16px;
    border: 2px solid var(--border);
    background: var(--bg);
    min-height: 138px;
    cursor: pointer;
  }
  .ckpi:hover {
    border-color: var(--accent);
  }
  .ckpi:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .ckpi-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .ckpi-label {
    font-size: 10px;
    letter-spacing: 0.22em;
    color: var(--muted);
    text-transform: uppercase;
  }
  .ckpi-glyph {
    font-size: 13px;
    color: var(--muted);
    opacity: 0.6;
  }
  .ckpi-value {
    font-size: clamp(1.4rem, 7vw, 46px);
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .ckpi-sub {
    font-size: 9.5px;
    letter-spacing: 0.06em;
    color: var(--muted);
    text-transform: uppercase;
  }
  .ckpi-spark {
    margin-top: 2px;
  }
  .ckpi-bar {
    margin-top: auto;
  }
  .ckpi-detail {
    margin-top: 4px;
    border-top: 1px dashed var(--border-soft);
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ckpi-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 3px 10px;
    align-items: baseline;
  }
  .ckpi-row-label {
    font-size: 10px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .ckpi-row-val {
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .ckpi-row-bar {
    grid-column: 1 / -1;
  }
  .ckpi-note {
    margin: 0;
    font-size: 10px;
    color: var(--muted);
    font-style: italic;
    line-height: 1.5;
  }
</style>
