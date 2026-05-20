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
  const SIDE_LABEL_THRESHOLD = 3;

  function labelPlacement(point) {
    if (point.x > cx + SIDE_LABEL_THRESHOLD) {
      return { x: Math.min(point.x, size - LABEL_PAD), anchor: 'end' };
    }
    if (point.x < cx - SIDE_LABEL_THRESHOLD) {
      return { x: Math.max(point.x, LABEL_PAD), anchor: 'start' };
    }
    return { x: point.x, anchor: 'middle' };
  }

  $: cx = size / 2;
  $: cy = size / 2;
  // Spacing scales with size so compact (140) and large (200) charts stay
  // balanced: the polygon is inset enough to leave a clear ring before the
  // labels, which sit just inside the edge with a background halo for legibility.
  $: labelFont = Math.max(8, Math.min(10, size * 0.062));
  $: haloWidth = labelFont * 0.36;
  $: inset = Math.max(20, size * 0.15);
  $: radius = size / 2 - inset;
  $: labelGap = Math.max(11, size * 0.075);
  $: labelRadius = radius + labelGap;
  $: values = axes.map((a) => a.value);
  $: dataPoints = polarPoints(values, { cx, cy, radius, scaleMin, scaleMax });
  $: pathD = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
  $: gridLevels = [0.25, 0.5, 0.75, 1].map((f) => polarPoints(axes.map(() => scaleMin + (scaleMax - scaleMin) * f), { cx, cy, radius, scaleMin, scaleMax }));
  $: spokes = polarPoints(axes.map(() => scaleMax), { cx, cy, radius, scaleMin, scaleMax });
  $: labelPoints = polarPoints(axes.map(() => scaleMax), { cx, cy, radius: labelRadius, scaleMin, scaleMax });
  $: labels = axes.map((axis, i) => {
    const point = labelPoints[i];
    const place = labelPlacement(point);
    // Diagonal (side) labels nudge vertically outward so they clear the
    // polygon's vertices; top/bottom centre labels stay put. Clamp keeps every
    // label fully inside the viewBox.
    const nudge = place.anchor === 'middle' ? 0 : Math.sign(point.y - cy) * Math.max(3, size * 0.02);
    const halfText = labelFont * 0.6;
    const y = Math.max(halfText + 1, Math.min(size - halfText - 1, point.y + nudge));
    return { ...axis, x: place.x, anchor: place.anchor, y };
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

<svg width={size} height={size} viewBox="0 0 {size} {size}" class="font-mono">
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
