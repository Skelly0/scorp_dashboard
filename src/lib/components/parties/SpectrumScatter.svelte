<script>
  // Worldview spectrum scatter: each party plotted on two selectable 1..7 stance
  // axes, bubble size ∝ vote share. Clicking a bubble selects it (pointer
  // enhancement; SpectrumView also exposes keyboard-operable party buttons).
  import { contrastInk } from '../../contrast.js';
  import { abbrevName } from '../../short-name.js';

  /** @type {Array<{name: string, color: string, vote_share: number, stance: Record<string, number>}>} */
  export let parties = [];
  export let xKey;
  export let yKey;
  /** @type {{name: string, lo: string, hi: string}} */ export let xMeta;
  /** @type {{name: string, lo: string, hi: string}} */ export let yMeta;
  export let selected = null;
  /** @type {(name: string) => void} */ export let onSelect = () => {};

  const W = 640;
  const H = 470;
  const padL = 52;
  const padR = 24;
  const padT = 24;
  const padB = 52;

  $: plotW = W - padL - padR;
  $: plotH = H - padT - padB;
  const X = (v) => padL + ((v - 1) / 6) * (W - padL - padR);
  const Y = (v) => padT + (1 - (v - 1) / 6) * (H - padT - padB);
  $: ordered = [...parties].sort((a, b) => (b.vote_share ?? 0) - (a.vote_share ?? 0));
  const grids = [2, 3, 4, 5, 6];
</script>

<svg viewBox="0 0 {W} {H}" class="scatter" role="img" aria-label="Party worldview spectrum: {xMeta.name} (horizontal) versus {yMeta.name} (vertical).">
  <rect x={padL} y={padT} width={plotW} height={plotH} fill="none" stroke="var(--border-soft)" />
  {#each grids as v}
    <line x1={X(v)} y1={padT} x2={X(v)} y2={padT + plotH} stroke="var(--border-soft)" stroke-width={v === 4 ? 1.2 : 0.5} stroke-dasharray={v === 4 ? '4 3' : '2 4'} />
    <line x1={padL} y1={Y(v)} x2={padL + plotW} y2={Y(v)} stroke="var(--border-soft)" stroke-width={v === 4 ? 1.2 : 0.5} stroke-dasharray={v === 4 ? '4 3' : '2 4'} />
  {/each}

  <text x={padL} y={H - 30} fill="var(--muted)" class="ax-pole">← {xMeta.lo.toUpperCase()}</text>
  <text x={padL + plotW} y={H - 30} text-anchor="end" fill="var(--muted)" class="ax-pole">{xMeta.hi.toUpperCase()} →</text>
  <text x={padL + plotW / 2} y={H - 11} text-anchor="middle" fill="var(--fg-dim)" class="ax-name">{xMeta.name.toUpperCase()}</text>
  <text x="16" y={padT + plotH / 2} text-anchor="middle" fill="var(--fg-dim)" class="ax-name" transform="rotate(-90 16 {padT + plotH / 2})">{yMeta.lo.toUpperCase()} ↔ {yMeta.hi.toUpperCase()}</text>

  {#each ordered as p (p.name)}
    {@const sel = p.name === selected}
    {@const r = Math.max(11, Math.min(28, 9 + (p.vote_share ?? 0) * 52))}
    {@const cx = X(p.stance?.[xKey] ?? 4)}
    {@const cy = Y(p.stance?.[yKey] ?? 4)}
    <!-- Bubbles mirror the keyboard-operable party buttons in SpectrumView. -->
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <circle
      {cx}
      {cy}
      {r}
      fill={p.color}
      fill-opacity={sel ? 0.92 : 0.6}
      stroke={sel ? 'var(--fg)' : p.color}
      stroke-width={sel ? 2.5 : 1.2}
      style="cursor:pointer"
      on:click={() => onSelect(p.name)}
    >
      <title>{p.name}</title>
    </circle>
    <text {cx} y={cy + 3} text-anchor="middle" fill={contrastInk(p.color) ?? '#f6f3ec'} class="bub-code" style="pointer-events:none">{abbrevName(p.name)}</text>
  {/each}
</svg>

<style>
  .scatter {
    display: block;
    width: 100%;
    height: auto;
  }
  .ax-pole { font-size: 8.5px; letter-spacing: 0.1em; }
  .ax-name { font-size: 9px; letter-spacing: 0.18em; }
  .bub-code { font-size: 10px; font-weight: 800; }
</style>
