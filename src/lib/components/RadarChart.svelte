<script>
  import { polarPoints } from '../radar-utils.js';

  /** @type {{label: string, value: number | null}[]} */
  export let axes = [];
  export let size = 160;
  export let scaleMin = 1;
  export let scaleMax = 7;

  $: cx = size / 2;
  $: cy = size / 2;
  $: radius = size / 2 - 18;
  $: values = axes.map((a) => a.value);
  $: dataPoints = polarPoints(values, { cx, cy, radius, scaleMin, scaleMax });
  $: pathD = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
  $: gridLevels = [0.25, 0.5, 0.75, 1].map((f) => polarPoints(axes.map(() => scaleMin + (scaleMax - scaleMin) * f), { cx, cy, radius, scaleMin, scaleMax }));
  $: spokes = polarPoints(axes.map(() => scaleMax), { cx, cy, radius, scaleMin, scaleMax });
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
  <!-- data shape -->
  <path d={pathD} fill="var(--accent)" fill-opacity="0.25" stroke="var(--accent)" stroke-width="2" />
  <!-- axis labels -->
  {#each axes as a, i}
    {@const lp = polarPoints(axes.map((_, j) => (j === i ? scaleMax : scaleMin)), { cx, cy, radius: radius + 12, scaleMin, scaleMax })[i]}
    <text x={lp.x.toFixed(1)} y={lp.y.toFixed(1)} text-anchor="middle" dominant-baseline="central" font-size="9" fill="var(--muted)" text-transform="uppercase">
      {a.label.slice(0, 4)}
    </text>
  {/each}
</svg>
