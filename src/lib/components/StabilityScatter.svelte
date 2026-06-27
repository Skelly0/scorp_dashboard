<script>
  // Satisfaction × radicalisation scatter for the Census Quadrant view.
  // Bubble area ∝ population; the shaded lower-left quadrant is the flashpoint
  // zone (low satisfaction · high radicalisation). Ported from the mockup's
  // scatter(); coordinates are fixed viewBox units scaled to 100% width.
  import { createEventDispatcher } from 'svelte';

  /** @type {{name:string, code:string, color:string, pop:number|null, sat:number|null, rad:number|null}[]} */
  export let classes = [];
  export let selected = null;

  const dispatch = createEventDispatcher();

  const W = 720;
  const H = 440;
  const padL = 52;
  const padR = 20;
  const padT = 22;
  const padB = 46;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const satMax = 0.55;
  const radMax = 0.6;
  const satMid = 0.3;
  const radMid = 0.3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const X = (s) => padL + (s / satMax) * plotW;
  const Y = (r) => padT + (1 - r / radMax) * plotH;

  const gridX = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
  const gridY = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
  const corners = [
    ['FLASHPOINT', padL + 6, padT + 14, 'start'],
    ['AGITATED', padL + plotW - 6, padT + 14, 'end'],
    ['RESIGNED', padL + 6, padT + plotH - 6, 'start'],
    ['CONTENT', padL + plotW - 6, padT + plotH - 6, 'end'],
  ];

  $: bubbles = classes
    .filter((c) => Number.isFinite(c.sat) && Number.isFinite(c.rad) && Number.isFinite(c.pop))
    .slice()
    .sort((a, b) => b.pop - a.pop)
    .map((c) => ({
      ...c,
      sel: c.name === selected,
      r: clamp(Math.sqrt(c.pop) / 5, 7, 30),
      cx: X(c.sat),
      cy: Y(c.rad),
    }));
</script>

<svg
  viewBox="0 0 {W} {H}"
  style="display:block; width:100%; height:auto;"
  role="img"
  aria-label="Satisfaction versus radicalisation by class"
>
  <rect x={padL} y={padT} width={X(satMid) - padL} height={Y(radMid) - padT} fill="var(--crit-soft)" />

  {#each gridX as s}
    <line
      x1={X(s)} y1={padT} x2={X(s)} y2={padT + plotH}
      stroke="var(--border-soft)"
      stroke-width={s === satMid ? 1.4 : 0.6}
      stroke-dasharray={s === satMid ? '4 3' : '2 4'}
    />
    <text x={X(s)} y={padT + plotH + 14} text-anchor="middle" fill="var(--muted)" style="font-size:8.5px">
      {Math.round(s * 100)}
    </text>
  {/each}

  {#each gridY as r}
    <line
      x1={padL} y1={Y(r)} x2={padL + plotW} y2={Y(r)}
      stroke="var(--border-soft)"
      stroke-width={r === radMid ? 1.4 : 0.6}
      stroke-dasharray={r === radMid ? '4 3' : '2 4'}
    />
    <text x={padL - 8} y={Y(r) + 3} text-anchor="end" fill="var(--muted)" style="font-size:8.5px">
      {Math.round(r * 100)}
    </text>
  {/each}

  <text x={padL + plotW / 2} y={H - 6} text-anchor="middle" fill="var(--fg-dim)" style="font-size:9px; letter-spacing:0.2em">
    SATISFACTION →
  </text>
  <text
    x="14" y={padT + plotH / 2} text-anchor="middle" fill="var(--fg-dim)"
    style="font-size:9px; letter-spacing:0.2em"
    transform="rotate(-90 14 {padT + plotH / 2})"
  >
    RADICALISATION →
  </text>

  {#each corners as [label, x, y, anchor]}
    <text {x} {y} text-anchor={anchor} fill="var(--muted)" style="font-size:8px; letter-spacing:0.16em; opacity:0.7">
      {label}
    </text>
  {/each}

  {#each bubbles as b (b.name)}
    <circle
      cx={b.cx} cy={b.cy} r={b.r}
      fill={b.color} fill-opacity={b.sel ? 0.92 : 0.62}
      stroke={b.sel ? 'var(--fg)' : b.color} stroke-width={b.sel ? 2.5 : 1}
      style="cursor:pointer"
      role="button"
      tabindex="0"
      aria-label={b.name}
      on:click={() => dispatch('select', b.name)}
      on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          dispatch('select', b.name);
        }
      }}
    />
    <text
      x={b.cx} y={b.cy + 3} text-anchor="middle"
      fill={b.sel ? 'var(--alert-fg)' : 'var(--bg)'}
      style="font-size:8.5px; font-weight:800; pointer-events:none"
    >
      {b.code}
    </text>
  {/each}
</svg>
