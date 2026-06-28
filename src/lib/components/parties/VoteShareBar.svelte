<script>
  // A single proportional electorate bar split by vote share (sorted desc) with
  // a 50% reference tick, plus a legend row. Rendered as SVG so the on-segment
  // percentage labels carry their own contrast ink without tripping axe's
  // DOM-text contrast checks.
  import { fmtInt, fmtPct } from '../../format.js';
  import { contrastInk } from '../../contrast.js';
  import { abbrevName } from '../../short-name.js';

  /** @type {Array<{name: string, color: string, vote_share: number, supporters: number|null}>} */
  export let parties = [];

  const W = 1000;
  const H = 92;

  $: sorted = [...parties].sort((a, b) => (b.vote_share ?? 0) - (a.vote_share ?? 0));
  $: total = sorted.reduce((a, p) => a + (p.vote_share ?? 0), 0) || 1;
  $: segments = (() => {
    let x = 0;
    return sorted.map((p) => {
      const w = ((p.vote_share ?? 0) / total) * W;
      const seg = { ...p, x, w, wide: w >= W * 0.1, ink: contrastInk(p.color) ?? '#f6f3ec' };
      x += w;
      return seg;
    });
  })();
  $: summary = sorted.map((p) => `${p.name} ${fmtPct(p.vote_share, 1)}`).join(', ');
</script>

<svg class="vote-bar" viewBox="0 0 {W} {H + 18}" role="img" aria-label="Vote share: {summary}.">
  <g>
    {#each segments as s (s.name)}
      <rect x={s.x.toFixed(1)} y="18" width={Math.max(0, s.w - 2).toFixed(1)} height={H} fill={s.color} />
      {#if s.wide}
        <text x={(s.x + s.w / 2).toFixed(1)} y={18 + H / 2 - 6} text-anchor="middle" fill={s.ink} class="vote-name">{abbrevName(s.name)}</text>
        <text x={(s.x + s.w / 2).toFixed(1)} y={18 + H / 2 + 16} text-anchor="middle" fill={s.ink} class="vote-pct">{(s.vote_share * 100).toFixed(1)}%</text>
      {/if}
    {/each}
  </g>
  <!-- 50% reference tick -->
  <line x1={W / 2} y1="10" x2={W / 2} y2={18 + H + 4} stroke="var(--fg)" stroke-opacity="0.5" stroke-width="2" />
  <text x={W / 2} y="6" text-anchor="middle" fill="var(--muted)" class="vote-tick">50% OF VOTE</text>
</svg>

<div class="vote-legend">
  {#each segments as s (s.name)}
    <div class="vote-legend-item">
      <span class="vote-swatch" style="background: {s.color}"></span>
      <span class="vote-legend-name">{s.name}</span>
      <span class="vote-legend-pct tnum">{fmtPct(s.vote_share, 1)}</span>
      {#if s.supporters != null}<span class="vote-legend-sup tnum">{fmtInt(s.supporters)}</span>{/if}
    </div>
  {/each}
</div>

<style>
  .vote-bar {
    display: block;
    width: 100%;
    height: auto;
  }
  .vote-name {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .vote-pct {
    font-size: 26px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .vote-tick {
    font-size: 11px;
    letter-spacing: 0.12em;
  }
  .vote-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 20px;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--border-soft);
  }
  .vote-legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .vote-swatch {
    width: 11px;
    height: 11px;
    flex: 0 0 11px;
  }
  .vote-legend-name { font-size: 11px; letter-spacing: 0.02em; }
  .vote-legend-pct { font-size: 11px; font-weight: 800; }
  .vote-legend-sup { font-size: 9.5px; color: var(--muted); }
</style>
