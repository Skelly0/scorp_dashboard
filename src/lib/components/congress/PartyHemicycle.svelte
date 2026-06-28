<script>
  // Party-totals hemicycle: one dot per seat, coloured by party, seats filling
  // left → right so each party forms a contiguous wedge (layout math shared with
  // FederationChamber via parliament.js). When a coalition is selected its member
  // seats stay lit and the centre read-out flips to the coalition's seat count and
  // majority status. Seats are a pointer-only enhancement — the keyboard-operable
  // coalition control is the chip list in CoalitionBuilder.
  import { seatPositions, dotRadius } from '../../parliament.js';

  /** @type {Array<{name: string, seats: number, color: string}>} seated parties, wedge order */
  export let parties = [];
  /** @type {Set<string>} selected coalition party names */
  export let coalition = new Set();
  export let majority = 0;
  /** @type {(name: string) => void} */
  export let onToggle = () => {};

  const CX = 110;
  const CY = 110;
  const R = 100;

  $: seated = parties.filter((p) => (p.seats ?? 0) > 0);
  $: dots = seated.flatMap((p) =>
    Array.from({ length: Math.max(0, Math.round(p.seats ?? 0)) }, () => p),
  );
  $: positions = seatPositions(dots.length);
  // 0.6× the natural packing radius gives the mockup's clearly-separated dots
  // (the layout still spaces them by the full radius, so they never overlap).
  $: dotR = dots.length ? dotRadius(dots.length) * R * 0.6 : 0;
  $: active = coalition.size > 0;
  $: coalitionSeatN = seated
    .filter((p) => coalition.has(p.name))
    .reduce((a, p) => a + Math.max(0, Math.round(p.seats ?? 0)), 0);
  $: win = coalitionSeatN >= majority && majority > 0;
  $: centreNum = active ? String(coalitionSeatN) : String(dots.length);
  $: centreLabel = active ? (win ? 'MAJORITY' : 'SHORT') : 'SEATS';
  $: centreColor = active ? (win ? 'var(--good)' : 'var(--crit)') : 'var(--muted)';

  $: ariaLabel = active
    ? `Congress seating: selected coalition holds ${coalitionSeatN} of ${dots.length} seats, ${win ? 'a majority' : `${majority - coalitionSeatN} short of the ${majority} needed`}.`
    : `Congress seating: ${dots.length} seats across ${seated.length} parties. Tap seats or party chips to build a coalition.`;
</script>

<div class="hemicycle-wrap">
  <svg class="hemicycle-svg" viewBox="0 0 220 130" role="img" aria-label={ariaLabel}>
    {#each positions as pos, i}
      {@const p = dots[i]}
      {@const inC = coalition.has(p.name)}
      <!-- Seats are a pointer-only shortcut; the keyboard-operable coalition
           control is the chip list in CoalitionBuilder. -->
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <circle
        class="hemicycle-seat"
        cx={(CX + pos.x * R).toFixed(2)}
        cy={(CY - pos.y * R).toFixed(2)}
        r={dotR.toFixed(2)}
        fill={p.color}
        fill-opacity={active ? (inC ? 1 : 0.18) : 0.88}
        stroke={inC ? 'var(--fg)' : 'var(--bg)'}
        stroke-width={inC ? 1.4 : 0.8}
        on:click={() => onToggle(p.name)}
      >
        <title>{p.name}</title>
      </circle>
    {/each}
    <text x={CX} y={CY - 2} text-anchor="middle" fill={centreColor} class="hemicycle-num">{centreNum}</text>
    <text x={CX} y={CY + 16} text-anchor="middle" fill="var(--muted)" class="hemicycle-cap">{centreLabel}</text>
  </svg>
</div>

<style>
  /* Fill the card. NB: an `auto` horizontal margin here would shrink-wrap the
     SVG when the parent card is a flexbox — keep this a plain block. */
  .hemicycle-wrap {
    width: 100%;
  }
  .hemicycle-svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .hemicycle-seat {
    cursor: pointer;
  }
  .hemicycle-num {
    font-size: 22px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .hemicycle-cap {
    font-size: 8px;
    letter-spacing: 0.2em;
  }
</style>
