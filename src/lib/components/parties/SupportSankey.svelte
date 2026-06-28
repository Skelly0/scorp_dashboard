<script>
  // Class → Party support Sankey. Left nodes = classes (height ∝ population),
  // right nodes = parties (height ∝ captured support), ribbons weighted by the
  // captured-headcount matrix and coloured by party. Hover any node to isolate
  // its flows. `values` is [class][party]; everything is SVG so the labels are
  // axe-safe over coloured ribbons.
  import { fmtInt, fmtPct } from '../../format.js';

  /** @type {string[]} */ export let classes = [];
  /** @type {Array<{name: string, color: string}>} */ export let parties = [];
  /** @type {number[][]} [class][party] captured headcount */ export let values = [];

  const W = 1020;
  const H = 660;
  const padT = 22;
  const padB = 20;
  const nodeW = 13;
  const padL = 172;
  const padR = 224;
  const gap = 7;

  let hover = null; // { type: 'class' | 'party', key: number } | null
  const setHover = (h) => (hover = h);

  $: leftX = padL;
  $: rightX = W - padR - nodeW;
  $: rowSum = classes.map((_, ri) => (values[ri] ?? []).reduce((a, b) => a + (b ?? 0), 0));
  $: colSum = parties.map((_, ci) => classes.reduce((a, _2, ri) => a + (values[ri]?.[ci] ?? 0), 0));
  $: V = rowSum.reduce((a, b) => a + b, 0) || 1;
  $: availH = H - padT - padB;
  $: scale = Math.min(
    (availH - (classes.length - 1) * gap) / V,
    (availH - (parties.length - 1) * gap) / V,
  );
  $: leftOrder = classes.map((_, i) => i).sort((a, b) => rowSum[b] - rowSum[a]);
  $: colOrder = parties.map((_, i) => i).sort((a, b) => colSum[b] - colSum[a]);
  $: leftTop = (() => {
    const top = {};
    let y = padT + (availH - (rowSum.reduce((a, b) => a + b, 0) * scale + (classes.length - 1) * gap)) / 2;
    leftOrder.forEach((ri) => {
      top[ri] = y;
      y += rowSum[ri] * scale + gap;
    });
    return top;
  })();
  $: rightTop = (() => {
    const top = {};
    let y = padT + (availH - (colSum.reduce((a, b) => a + b, 0) * scale + (parties.length - 1) * gap)) / 2;
    colOrder.forEach((ci) => {
      top[ci] = y;
      y += colSum[ci] * scale + gap;
    });
    return top;
  })();

  function lit(ri, ci) {
    return (
      !hover ||
      (hover.type === 'class' && hover.key === ri) ||
      (hover.type === 'party' && hover.key === ci)
    );
  }
  function ribbonPath(x0, y0, x1, y1, t) {
    const xm = (x0 + x1) / 2;
    return `M ${x0} ${y0} C ${xm} ${y0}, ${xm} ${y1}, ${x1} ${y1} L ${x1} ${y1 + t} C ${xm} ${y1 + t}, ${xm} ${y0 + t}, ${x0} ${y0 + t} Z`;
  }

  $: ribbons = (() => {
    const lCur = { ...leftTop };
    const rCur = { ...rightTop };
    const out = [];
    leftOrder.forEach((ri) => {
      parties.forEach((p, ci) => {
        const v = values[ri]?.[ci] ?? 0;
        if (v <= 0) return;
        const t = v * scale;
        out.push({ ri, ci, v, t, y0: lCur[ri], y1: rCur[ci], color: parties[ci].color });
        lCur[ri] += t;
        rCur[ci] += t;
      });
    });
    // Lit ribbons drawn last (on top).
    return out.sort((a, b) => (lit(a.ri, a.ci) ? 1 : 0) - (lit(b.ri, b.ci) ? 1 : 0));
  })();
</script>

<svg viewBox="0 0 {W} {H}" class="sankey" role="img" aria-label="Class to party support flow. Left bars are classes by population; right bars are parties by captured support; ribbons show how each class's support splits across parties.">
  <text x={leftX} y="13" fill="var(--muted)" class="sk-head">CLASS</text>
  <text x={rightX + nodeW} y="13" text-anchor="end" fill="var(--muted)" class="sk-head">PARTY</text>

  {#each ribbons as rb}
    {@const on = lit(rb.ri, rb.ci)}
    <path
      d={ribbonPath(leftX + nodeW, rb.y0, rightX, rb.y1, rb.t)}
      fill={rb.color}
      fill-opacity={hover ? (on ? 0.78 : 0.05) : 0.4}
      on:pointerenter={() => setHover({ type: 'party', key: rb.ci })}
      on:pointerleave={() => setHover(null)}
    />
  {/each}

  {#each leftOrder as ri}
    {@const h = Math.max(1, rowSum[ri] * scale)}
    {@const on = !hover || (hover.type === 'class' && hover.key === ri)}
    <rect
      x={leftX}
      y={leftTop[ri]}
      width={nodeW}
      height={h}
      fill="var(--fg-dim)"
      fill-opacity={on ? 0.85 : 0.25}
      on:pointerenter={() => setHover({ type: 'class', key: ri })}
      on:pointerleave={() => setHover(null)}
      style="cursor:pointer"
    />
    <text x={leftX - 9} y={leftTop[ri] + h / 2 + 3.5} text-anchor="end" class="sk-label" opacity={on ? 1 : 0.5}>{classes[ri]}</text>
    <text x={leftX - 9} y={leftTop[ri] + h / 2 + 15} text-anchor="end" class="sk-sub" opacity={on ? 0.9 : 0.35}>{fmtInt(rowSum[ri])}</text>
  {/each}

  {#each colOrder as ci}
    {@const h = Math.max(1, colSum[ci] * scale)}
    {@const on = !hover || (hover.type === 'party' && hover.key === ci)}
    <rect
      x={rightX}
      y={rightTop[ci]}
      width={nodeW}
      height={h}
      fill={parties[ci].color}
      fill-opacity={on ? 1 : 0.3}
      on:pointerenter={() => setHover({ type: 'party', key: ci })}
      on:pointerleave={() => setHover(null)}
      style="cursor:pointer"
    />
    <text x={rightX + nodeW + 9} y={rightTop[ci] + h / 2 + 3} text-anchor="start" class="sk-label" opacity={on ? 1 : 0.45}>{parties[ci].name}</text>
    <text x={rightX + nodeW + 9} y={rightTop[ci] + h / 2 + 15} text-anchor="start" class="sk-sub" opacity={on ? 0.9 : 0.35}>{fmtInt(colSum[ci])} · {fmtPct(colSum[ci] / V)}</text>
  {/each}
</svg>

<style>
  .sankey {
    display: block;
    width: 100%;
    height: auto;
  }
  .sk-head {
    font-size: 11px;
    letter-spacing: 0.2em;
  }
  .sk-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.02em;
    fill: var(--fg);
    paint-order: stroke;
    stroke: var(--bg);
    stroke-width: 3.4px;
    stroke-linejoin: round;
  }
  .sk-sub {
    font-size: 9px;
    font-variant-numeric: tabular-nums;
    fill: var(--muted);
    paint-order: stroke;
    stroke: var(--bg);
    stroke-width: 3px;
    stroke-linejoin: round;
  }
</style>
