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

  const LABEL_PAD = 4;
  const SIDE_LABEL_THRESHOLD = 3;

  function labelPlacement(point) {
    if (point.x > cx + SIDE_LABEL_THRESHOLD) {
      return {
        x: Math.min(point.x, size - LABEL_PAD),
        anchor: 'end',
      };
    }
    if (point.x < cx - SIDE_LABEL_THRESHOLD) {
      return {
        x: Math.max(point.x, LABEL_PAD),
        anchor: 'start',
      };
    }
    return {
      x: point.x,
      anchor: 'middle',
    };
  }

  $: cx = size / 2;
  $: cy = size / 2;
  $: radius = size / 2 - 18;
  $: values = axes.map((a) => a.value);
  $: dataPoints = polarPoints(values, { cx, cy, radius, scaleMin, scaleMax });
  $: pathD = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
  $: gridLevels = [0.25, 0.5, 0.75, 1].map((f) => polarPoints(axes.map(() => scaleMin + (scaleMax - scaleMin) * f), { cx, cy, radius, scaleMin, scaleMax }));
  $: spokes = polarPoints(axes.map(() => scaleMax), { cx, cy, radius, scaleMin, scaleMax });
  $: labelPoints = polarPoints(axes.map(() => scaleMax), { cx, cy, radius: radius + 12, scaleMin, scaleMax });
  $: labels = axes.map((axis, i) => ({
    ...axis,
    y: labelPoints[i].y,
    ...labelPlacement(labelPoints[i]),
  }));

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
  <path d={pathD} fill="var(--accent)" fill-opacity="0.25" stroke="var(--accent)" stroke-width="2" />
  <!-- axis labels -->
  {#each labels as a}
    <text x={a.x.toFixed(1)} y={a.y.toFixed(1)} text-anchor={a.anchor} dominant-baseline="central" font-size="9" fill="var(--muted)" text-transform="uppercase">
      {a.label}
    </text>
  {/each}
</svg>
