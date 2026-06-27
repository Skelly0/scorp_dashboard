<script>
  // Single Overton axis track: scale ticks (1..7), an optional previous-year
  // ghost marker + change segment, optional party-position markers, and the
  // current-year marker. Ported from the mock's overtonTrack(). Decorative.
  import { clamp } from '../../command-format.js';

  export let value = null;
  export let prevValue = null;
  /** @type {Array<{name:string,color:string,pos:number}>} */
  export let parties = [];
  export let showParties = false;

  const TICKS = [1, 2, 3, 4, 5, 6, 7];
  const pct = (v) => clamp(((v - 1) / 6) * 100, 0, 100);

  $: hasValue = value != null && Number.isFinite(value);
  $: hasPrev = prevValue != null && Number.isFinite(prevValue) && hasValue && Math.abs(prevValue - value) > 0.01;
  $: segLeft = hasPrev ? Math.min(pct(prevValue), pct(value)) : 0;
  $: segWidth = hasPrev ? Math.abs(pct(value) - pct(prevValue)) : 0;
</script>

<div class="ot" aria-hidden="true">
  {#each TICKS as t (t)}
    <span class="ot-tick" style="left:{pct(t)}%"></span>
  {/each}
  {#if hasPrev}
    <span class="ot-seg" style="left:{segLeft}%; width:{segWidth}%"></span>
    <span class="ot-prev" style="left:{pct(prevValue)}%"></span>
  {/if}
  {#if showParties}
    {#each parties as p (p.name)}
      <span class="ot-party" title={p.name} style="left:{pct(p.pos)}%; background:{p.color}"></span>
    {/each}
  {/if}
  {#if hasValue}
    <span class="ot-marker" style="left:{pct(value)}%"></span>
  {/if}
</div>

<style>
  .ot {
    position: relative;
    height: 18px;
    background: var(--bg-2);
    border: 1px solid var(--border-soft);
  }
  .ot-tick {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--border-soft);
  }
  .ot-seg {
    position: absolute;
    top: 7px;
    height: 4px;
    background: var(--accent);
    opacity: 0.25;
  }
  .ot-prev {
    position: absolute;
    top: 1px;
    bottom: 1px;
    width: 2px;
    background: var(--fg-dim);
    opacity: 0.55;
  }
  .ot-party {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 3px;
    opacity: 0.9;
  }
  .ot-marker {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 3px;
    background: var(--accent);
  }
</style>
