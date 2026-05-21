<script>
  import { polarPoints } from '../radar-utils.js';

  /** @type {{label: string, value: number | null}[]} */
  export let axes = [];
  /** Optional ghost overlay polygon (e.g. parent worldview behind sub-faction). */
  /** @type {{label: string, value: number | null}[] | null} */
  export let overlay = null;
  export let size = 160;
  export let scaleMin = 1;
  export let scaleMax = 7;
  /** Accent colour for the data polygon (fill + stroke); themeable var by default. */
  export let accent = 'var(--accent)';

  const LABEL_PAD = 4;
  const CENTER_BAND = 0.3; // |cos| below this ⇒ a top/bottom (not side) axis

  $: cx = size / 2;
  $: cy = size / 2;
  // Long single-word axis labels can't wrap, so a square box forces the side
  // labels to overlap the polygon. Instead we add vertical gutters (taller SVG,
  // same width ⇒ font stays crisp): the top/bottom labels live in those
  // gutters, the diagonal labels are lifted to the corners where the polygon is
  // narrow, and nothing sits beside the polygon's wide middle. The result is a
  // clean grid of labels around an unobstructed chart.
  $: labelFont = Math.max(8, Math.min(10.5, size * 0.064));
  $: haloWidth = labelFont * 0.36;
  $: inset = Math.max(14, size * 0.13);
  $: radius = size / 2 - inset;
  $: vGutter = labelFont * 1.7;
  $: vbY = -vGutter;
  $: vbH = size + 2 * vGutter;
  $: values = axes.map((a) => a.value);
  $: dataPoints = polarPoints(values, { cx, cy, radius, scaleMin, scaleMax });
  $: pathD = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
  $: gridLevels = [0.25, 0.5, 0.75, 1].map((f) => polarPoints(axes.map(() => scaleMin + (scaleMax - scaleMin) * f), { cx, cy, radius, scaleMin, scaleMax }));
  $: spokes = polarPoints(axes.map(() => scaleMax), { cx, cy, radius, scaleMin, scaleMax });
  $: labels = axes.map((axis, i) => {
    const angle = (i / axes.length) * 2 * Math.PI - Math.PI / 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    if (Math.abs(c) < CENTER_BAND) {
      // Top / bottom axis — parked in the vertical gutter, clear of the plot.
      return { ...axis, x: cx, anchor: 'middle', y: s < 0 ? -vGutter * 0.55 : size + vGutter * 0.55 };
    }
    // Side axis — pinned to the horizontal edge and lifted toward its corner,
    // where the polygon tapers to a vertex so the inward-reading word clears it.
    return {
      ...axis,
      x: c > 0 ? size - LABEL_PAD : LABEL_PAD,
      anchor: c > 0 ? 'end' : 'start',
      y: cy + Math.sign(s) * radius * 0.92,
    };
  });

  $: overlayValid = (() => {
    if (!overlay) return false;
    if (overlay.length !== axes.length) {
      console.warn('[RadarChart] overlay/axes length mismatch — overlay ignored');
      return false;
    }
    for (let i = 0; i < axes.length; i++) {
      if (overlay[i].label !== axes[i].label) {
        console.warn(
          `[RadarChart] overlay/axes label mismatch at index ${i} ` +
          `(axes='${axes[i].label}', overlay='${overlay[i].label}') — overlay ignored`,
        );
        return false;
      }
    }
    return true;
  })();
  $: overlayPoints = overlayValid
    ? polarPoints(overlay.map((a) => a.value), { cx, cy, radius, scaleMin, scaleMax })
    : null;
  $: overlayPathD = overlayPoints
    ? overlayPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'
    : null;
</script>

<svg width={size} height={vbH} viewBox="0 {vbY} {size} {vbH}" class="font-mono">
  <!-- grid rings -->
  {#each gridLevels as ring}
    <polygon
      points={ring.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
      fill="none"
      stroke="var(--border)"
      stroke-width="1"
      stroke-opacity="0.25"
    />
  {/each}
  <!-- spokes -->
  {#each spokes as p}
    <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border)" stroke-opacity="0.25" stroke-width="1" />
  {/each}
  <!-- overlay (ghost) shape — drawn first so primary renders on top -->
  {#if overlayPathD}
    <path
      d={overlayPathD}
      fill="none"
      stroke="var(--radar-overlay)"
      stroke-width="1.5"
      stroke-dasharray="3 2"
      stroke-opacity="0.85"
    />
  {/if}
  <!-- data shape -->
  <path d={pathD} fill={accent} fill-opacity="0.25" stroke={accent} stroke-width="2" />
  <!-- axis labels -->
  {#each labels as a}
    <text
      x={a.x.toFixed(1)}
      y={a.y.toFixed(1)}
      text-anchor={a.anchor}
      dominant-baseline="central"
      font-size={labelFont.toFixed(1)}
      fill="var(--muted)"
      class="radar-label"
      style="--halo:{haloWidth.toFixed(2)}px"
    >
      {a.label}
    </text>
  {/each}
</svg>

<style>
  /* Knockout halo so labels stay legible where they sit near grid/polygon. */
  .radar-label {
    paint-order: stroke;
    stroke: var(--bg);
    stroke-width: var(--halo, 3px);
    stroke-linejoin: round;
  }
</style>
