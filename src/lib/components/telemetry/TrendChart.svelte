<script>
  // Before/after trend chart comparing the first and last available years.
  // Ported from the mock's historyChart(). Each metric's connecting segment is
  // coloured by direction-of-good (improved → good, worsened → crit).
  import { frames } from '../../stores/timeline.js';
  import { clamp } from '../../command-format.js';

  const W = 760;
  const ROW_H = 46;
  const PAD_T = 10;
  const LABEL_W = 152;
  const VAL_W = 52;
  const PAD_X = 12;
  const trackX = LABEL_W + VAL_W;
  const trackW = W - trackX - VAL_W - PAD_X;

  const METRICS = [
    { label: 'Stability', key: 'stability', up: true },
    { label: 'Crisis Pressure', key: 'crisis_factor', up: false },
    { label: 'Gov Approval', key: 'gov_approval', up: true },
    { label: 'Satisfaction', key: 'avg_satisfaction', up: true },
    { label: 'Housing Util', key: 'housing_util', up: false, scale: (v) => clamp(v / 1.3, 0, 1) },
  ];

  const pctf = (v) => `${Math.round(v * 100)}%`;

  $: first = $frames[0] ?? null;
  $: last = $frames.length ? $frames[$frames.length - 1] : null;
  $: ready = first && last && first !== last;
  $: H = PAD_T * 2 + METRICS.length * ROW_H;

  $: rows = ready
    ? METRICS.map((m, i) => {
        const a = first[m.key];
        const b = last[m.key];
        const sc = m.scale ?? ((v) => clamp(v, 0, 1));
        const cy = PAD_T + 8 + i * ROW_H + ROW_H / 2;
        const xa = trackX + sc(a) * trackW;
        const xb = trackX + sc(b) * trackW;
        const improved = m.up ? b >= a : b <= a;
        return { ...m, a, b, cy, xa, xb, col: improved ? 'var(--good)' : 'var(--crit)' };
      })
    : [];
</script>

<div class="tc-card">
  {#if ready}
    <div class="tc-legend">
      <div class="tc-key"><span class="tc-swatch" style="background:var(--good)"></span>Improved {first.year}→{last.year}</div>
      <div class="tc-key"><span class="tc-swatch" style="background:var(--crit)"></span>Worsened</div>
    </div>
    <svg viewBox="0 0 {W} {H}" style="display:block; width:100%; height:auto;" aria-hidden="true">
      <text x={trackX} y="14" fill="var(--muted)" style="font-size:10px; font-weight:700; letter-spacing:0.14em;">{first.year}</text>
      <text x={W - PAD_X} y="14" text-anchor="end" fill="var(--fg)" style="font-size:10px; font-weight:700; letter-spacing:0.14em;">{last.year}</text>
      {#each rows as r (r.key)}
        <text x={PAD_X} y={r.cy + 4} fill="var(--fg)" style="font-size:11px; font-weight:600; letter-spacing:0.04em;">{r.label}</text>
        <text x={LABEL_W + VAL_W - 14} y={r.cy + 4} text-anchor="end" fill="var(--muted)" style="font-size:11px; font-weight:600;">{pctf(r.a)}</text>
        <line x1={trackX} y1={r.cy} x2={trackX + trackW} y2={r.cy} stroke="var(--border-soft)" stroke-width="1" />
        <line x1={r.xa} y1={r.cy} x2={r.xb} y2={r.cy} stroke={r.col} stroke-width="3" />
        <circle cx={r.xa} cy={r.cy} r="4" fill="var(--bg)" stroke="var(--fg-dim)" stroke-width="1.5" />
        <circle cx={r.xb} cy={r.cy} r="5" fill={r.col} stroke="var(--bg)" stroke-width="1.5" />
        <text x={W - PAD_X} y={r.cy + 4} text-anchor="end" fill={r.col} style="font-size:11px; font-weight:700;">{pctf(r.b)}</text>
      {/each}
    </svg>
  {:else}
    <p class="tc-empty">Two years of history are needed to chart a trend.</p>
  {/if}
</div>

<style>
  .tc-card {
    border: 2px solid var(--border);
    background: var(--bg);
    padding: 16px;
  }
  .tc-legend {
    display: flex;
    gap: 18px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
  .tc-key {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--fg-dim);
  }
  .tc-swatch {
    width: 14px;
    height: 3px;
    display: block;
  }
  .tc-empty {
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.18em;
    padding: 14px 0;
  }
</style>
