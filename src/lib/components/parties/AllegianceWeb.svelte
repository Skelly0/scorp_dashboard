<script>
  // Allegiance Web: a force-directed bipartite layout of classes ↔ parties.
  // Party nodes are filled (radius ∝ vote share); class nodes are outlined
  // (radius ∝ population) and tinted by the party that captures most of them.
  // Edges weight by captured share or headcount and colour by party. Drag nodes
  // to explore, hover to trace. Data-driven from parties.json / the capture
  // matrices — nothing hardcoded. Honours prefers-reduced-motion by settling the
  // layout synchronously instead of animating.
  import { onMount, onDestroy } from 'svelte';
  import { abbrevName } from '../../short-name.js';

  /** @type {string[]} */ export let classes = [];
  /** @type {Array<{name: string, color: string, vote_share: number}>} */ export let parties = [];
  /** @type {number[][]} [class][party] capture share 0..1 */ export let pctValues = [];
  /** @type {number[][]} [class][party] captured headcount */ export let popValues = [];

  const VBW = 900;
  const VBH = 600;
  const cx = VBW / 2;
  const cy = VBH / 2;

  let nodes = [];
  let idx = {};
  let edges = [];
  let wmax = 0.0001;
  let mode = 'share'; // 'share' | 'count'
  let params = { linkDist: 1.55, charge: 1.3, attract: 0.85, gravity: 0.6, threshold: 0.1 };
  let temp = 108;
  let raf = null;
  let dragId = null;
  let hoverId = null;
  let svgEl;
  let reduced = false;

  function buildNodes() {
    const partyNodes = parties.map((p, pi) => ({
      id: 'P' + pi,
      kind: 'party',
      label: abbrevName(p.name),
      full: p.name,
      color: p.color,
      r: 20 + (p.vote_share ?? 0) * 70,
    }));
    const classTot = classes.map((_, ri) => (popValues[ri] ?? []).reduce((a, b) => a + (b ?? 0), 0));
    const maxPop = Math.max(1, ...classTot);
    const classNodes = classes.map((cls, ri) => {
      let best = 0;
      (pctValues[ri] ?? []).forEach((v, ci) => {
        if ((v ?? 0) > (pctValues[ri][best] ?? 0)) best = ci;
      });
      return {
        id: 'C' + ri,
        kind: 'class',
        label: cls,
        color: parties[best]?.color ?? 'var(--accent)',
        r: 8 + Math.sqrt(classTot[ri] / maxPop) * 20,
      };
    });
    nodes = [...partyNodes, ...classNodes];
    idx = {};
    nodes.forEach((n, i) => (idx[n.id] = i));
    let seed = 20260628;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    nodes.forEach((n) => {
      const a = rnd() * Math.PI * 2;
      const rr = rnd() * 70 + 12;
      n.x = cx + Math.cos(a) * rr;
      n.y = cy + Math.sin(a) * rr * 0.7;
      n.fixed = false;
    });
  }

  function buildEdges() {
    let maxCount = 0;
    classes.forEach((_, ri) => (popValues[ri] ?? []).forEach((v) => {
      if ((v ?? 0) > maxCount) maxCount = v;
    }));
    maxCount = maxCount || 1;
    const out = [];
    classes.forEach((_, ri) =>
      parties.forEach((p, ci) => {
        const wt = mode === 'share' ? (pctValues[ri]?.[ci] ?? 0) : (popValues[ri]?.[ci] ?? 0) / maxCount;
        if (wt < 0.025) return;
        out.push({ a: idx['C' + ri], b: idx['P' + ci], w: wt, color: p.color });
      }),
    );
    edges = out;
    wmax = Math.max(...out.map((e) => e.w), 0.0001);
  }

  function tick() {
    const P = params;
    const k = Math.sqrt((VBW * VBH) / nodes.length) * 0.82 * P.linkDist;
    const disp = nodes.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[i].x - nodes[j].x;
        let dy = nodes[i].y - nodes[j].y;
        const d = Math.hypot(dx, dy) || 0.01;
        const minD = nodes[i].r + nodes[j].r + 8;
        let f = (k * k) / d * P.charge;
        if (d < minD) f *= 1.9;
        if (nodes[i].kind === 'party' && nodes[j].kind === 'party') f *= 2.3;
        const ux = dx / d;
        const uy = dy / d;
        disp[i].x += ux * f;
        disp[i].y += uy * f;
        disp[j].x -= ux * f;
        disp[j].y -= uy * f;
      }
    }
    edges.forEach((e) => {
      if (e.w / wmax < P.threshold) return;
      const A = nodes[e.a];
      const B = nodes[e.b];
      let dx = A.x - B.x;
      let dy = A.y - B.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (d * d) / k * (e.w / wmax) * 2.7 * P.attract;
      const ux = dx / d;
      const uy = dy / d;
      disp[e.a].x -= ux * f;
      disp[e.a].y -= uy * f;
      disp[e.b].x += ux * f;
      disp[e.b].y += uy * f;
    });
    nodes.forEach((n, i) => {
      disp[i].x += (cx - n.x) * 0.013 * P.gravity;
      disp[i].y += (cy - n.y) * 0.018 * P.gravity;
    });
    nodes.forEach((n, i) => {
      if (n.fixed) return;
      const dx = disp[i].x;
      const dy = disp[i].y;
      const d = Math.hypot(dx, dy) || 0.01;
      const m = Math.min(d, temp) * 0.62;
      n.x = Math.max(n.r + 6, Math.min(VBW - n.r - 6, n.x + (dx / d) * m));
      // Leave headroom below each node for its label so the bottom row isn't clipped.
      n.y = Math.max(n.r + 6, Math.min(VBH - n.r - 18, n.y + (dy / d) * m));
    });
    temp *= 0.975;
  }

  function loop() {
    tick();
    nodes = nodes;
    if (temp > 1.6 || dragId) raf = requestAnimationFrame(loop);
    else raf = null;
  }
  function start() {
    if (raf || reduced) return;
    raf = requestAnimationFrame(loop);
  }
  function settle(n = 320) {
    for (let i = 0; i < n; i++) tick();
    nodes = nodes;
  }
  function reheat(t) {
    temp = Math.max(temp, t);
    if (reduced) settle(180);
    else start();
  }
  function stop() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }
  function setMode(m) {
    if (mode === m) return;
    mode = m;
    buildEdges();
    temp = 110;
    if (reduced) settle();
    else start();
  }
  function setParam(key, val) {
    params = { ...params, [key]: Number(val) };
    temp = Math.max(temp, 42);
    if (reduced) settle(120);
    else start();
  }

  function down(e, id) {
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    const n = nodes[idx[id]];
    if (n) n.fixed = true;
    dragId = id;
    reheat(3);
  }
  function move(e) {
    if (!dragId || !svgEl) return;
    const r = svgEl.getBoundingClientRect();
    const n = nodes[idx[dragId]];
    if (n) {
      n.x = ((e.clientX - r.left) / r.width) * VBW;
      n.y = ((e.clientY - r.top) / r.height) * VBH;
    }
    nodes = nodes;
    if (!reduced) reheat(2.4);
  }
  function up() {
    if (dragId) {
      const n = nodes[idx[dragId]];
      if (n) n.fixed = false;
    }
    dragId = null;
    if (!reduced) reheat(5);
  }
  function hover(id) {
    hoverId = id;
  }

  onMount(() => {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    buildNodes();
    buildEdges();
    if (reduced) settle();
    else start();
  });
  onDestroy(stop);

  $: connected = (() => {
    const s = new Set();
    if (hoverId) {
      edges.forEach((e) => {
        if (nodes[e.a]?.id === hoverId || nodes[e.b]?.id === hoverId) {
          s.add(nodes[e.a].id);
          s.add(nodes[e.b].id);
        }
      });
    }
    return s;
  })();

  const sliders = [
    { key: 'linkDist', label: 'Link distance', min: 0.5, max: 2, step: 0.05, fmt: (v) => v.toFixed(2) + '×' },
    { key: 'charge', label: 'Repulsion', min: 0.4, max: 2.4, step: 0.05, fmt: (v) => v.toFixed(2) + '×' },
    { key: 'attract', label: 'Link pull', min: 0.4, max: 2.4, step: 0.05, fmt: (v) => v.toFixed(2) + '×' },
    { key: 'gravity', label: 'Gravity', min: 0, max: 2.4, step: 0.05, fmt: (v) => v.toFixed(2) + '×' },
    { key: 'threshold', label: 'Hide weak ties', min: 0, max: 0.4, step: 0.01, fmt: (v) => Math.round(v * 100) + '%' },
  ];
</script>

<div class="web-layout">
  <div class="web-graph">
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <svg
      bind:this={svgEl}
      viewBox="0 0 {VBW} {VBH}"
      class="web-svg"
      role="img"
      aria-label="Allegiance web: a force-directed graph linking each class to the parties that capture its support. Filled nodes are parties (sized by vote share); ringed nodes are classes (sized by population)."
      on:pointermove={move}
      on:pointerup={up}
      on:pointercancel={up}
    >
      <g>
        {#each edges as e, i}
          {@const A = nodes[e.a]}
          {@const B = nodes[e.b]}
          {@const wn = e.w / wmax}
          {#if A && B && wn >= params.threshold}
            {@const on = hoverId && (A.id === hoverId || B.id === hoverId)}
            {@const base = 0.1 + wn * 0.5}
            {@const sw = 0.7 + wn * 5.2}
            <line
              x1={A.x}
              y1={A.y}
              x2={B.x}
              y2={B.y}
              stroke={e.color}
              stroke-opacity={hoverId ? (on ? Math.min(0.92, 0.42 + wn * 0.6) : 0.04) : base}
              stroke-width={hoverId ? (on ? sw + 0.7 : Math.max(0.4, sw * 0.5)) : sw}
              stroke-linecap="round"
            />
          {/if}
        {/each}
      </g>
      <g>
        {#each nodes as n (n.id)}
          {@const dim = hoverId && n.id !== hoverId && !connected.has(n.id)}
          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
          {#if n.kind === 'party'}
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={n.color}
              fill-opacity={dim ? 0.22 : 1}
              stroke="var(--bg)"
              stroke-width="2.5"
              style="cursor:grab"
              on:pointerdown={(e) => down(e, n.id)}
              on:pointerenter={() => hover(n.id)}
              on:pointerleave={() => hover(null)}
            >
              <title>{n.full}</title>
            </circle>
          {:else}
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill="var(--bg)"
              stroke={n.color}
              stroke-width="2.5"
              fill-opacity={dim ? 0.4 : 1}
              style="cursor:grab"
              on:pointerdown={(e) => down(e, n.id)}
              on:pointerenter={() => hover(n.id)}
              on:pointerleave={() => hover(null)}
            >
              <title>{n.label}</title>
            </circle>
            <circle cx={n.x} cy={n.y} r={Math.max(2.2, n.r * 0.32)} fill={n.color} fill-opacity={dim ? 0.4 : 0.92} style="pointer-events:none" />
          {/if}
        {/each}
      </g>
      <g>
        {#each nodes as n (n.id)}
          {@const dim = hoverId && n.id !== hoverId && !connected.has(n.id)}
          <text
            x={n.x}
            y={n.y + n.r + (n.kind === 'party' ? 13 : 11)}
            text-anchor="middle"
            class="web-label {n.kind}"
            opacity={dim ? 0.5 : 1}
          >{n.label}</text>
        {/each}
      </g>
    </svg>

    <div class="web-legend">
      {#each parties as p (p.name)}
        <span class="web-legend-item"><span class="web-legend-dot" style="background: {p.color}"></span>{abbrevName(p.name)}</span>
      {/each}
      <span class="web-legend-item"><span class="web-legend-ring"></span>Class · size = population</span>
    </div>
  </div>

  <div class="web-panel">
    <div class="web-panel-head">⚙ Simulation</div>
    <div class="web-control">
      <span class="web-control-lbl">Edge weight</span>
      <div class="layer-tabs">
        <button type="button" aria-pressed={mode === 'share'} on:click={() => setMode('share')}>Share of class</button>
        <button type="button" aria-pressed={mode === 'count'} on:click={() => setMode('count')}>Headcount</button>
      </div>
    </div>
    {#each sliders as s (s.key)}
      <div class="web-control">
        <div class="web-control-row">
          <span class="web-control-lbl">{s.label}</span>
          <span class="web-control-val">{s.fmt(params[s.key])}</span>
        </div>
        <input
          type="range"
          min={s.min}
          max={s.max}
          step={s.step}
          value={params[s.key]}
          aria-label={s.label}
          on:input={(e) => setParam(s.key, e.target.value)}
        />
      </div>
    {/each}
    <button type="button" class="web-reheat" on:click={() => reheat(135)}>⟳ Reheat layout</button>
  </div>
</div>

<style>
  .web-layout {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    align-items: stretch;
  }
  .web-graph {
    flex: 1 1 540px;
    min-width: 0;
    border: 2px solid var(--border);
    background: var(--bg);
    position: relative;
  }
  .web-svg {
    display: block;
    width: 100%;
    height: auto;
    touch-action: none;
  }
  .web-label {
    paint-order: stroke;
    stroke: var(--bg);
    stroke-width: 3.4px;
    stroke-linejoin: round;
    letter-spacing: 0.03em;
    pointer-events: none;
  }
  .web-label.party {
    font-size: 10.5px;
    font-weight: 800;
    fill: var(--fg);
  }
  .web-label.class {
    font-size: 8.5px;
    font-weight: 500;
    fill: var(--fg-dim);
  }
  .web-legend {
    position: absolute;
    left: 14px;
    bottom: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    align-items: center;
    padding: 9px 13px;
    background: color-mix(in srgb, var(--bg) 86%, transparent);
    border: 1px solid var(--border-soft);
    max-width: calc(100% - 28px);
  }
  .web-legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 9px;
    letter-spacing: 0.04em;
    color: var(--fg-dim);
  }
  .web-legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: 0 0 10px;
  }
  .web-legend-ring {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 2px solid var(--muted);
    flex: 0 0 11px;
  }
  .web-panel {
    flex: 0 1 256px;
    min-width: 230px;
    border: 2px solid var(--border);
    background: var(--bg);
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  .web-panel-head {
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--fg-dim);
    border-bottom: 1px solid var(--border-soft);
    padding-bottom: 9px;
  }
  .web-control {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .web-control-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .web-control-lbl {
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .web-control-val {
    font-size: 10px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--accent);
  }
  .web-control input[type='range'] {
    width: 100%;
    accent-color: var(--accent);
    cursor: pointer;
  }
  .web-reheat {
    margin-top: auto;
    background: var(--accent);
    color: var(--alert-fg, var(--bg));
    border: none;
    padding: 9px 13px;
    font-size: 9.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    cursor: pointer;
    font-family: inherit;
  }
</style>
