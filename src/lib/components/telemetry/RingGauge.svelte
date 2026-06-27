<script>
  // Half-circle instrument ring. Ported from the Colony Command mock's
  // `ringGauge`: a semicircular arc with a faint background, dashed tick marks,
  // and a value arc whose length encodes `value` (0..1). Purely visual — the
  // numeric value is rendered as adjacent text by the parent, so the SVG is
  // aria-hidden.
  import { clamp, toneColor } from '../../command-format.js';

  export let value = 0;
  export let tone = null;

  const W = 140;
  const H = 84;
  const cx = 70;
  const cy = 76;
  const r = 58;
  const len = Math.PI * r;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const tickDash = `1 ${(len / 24).toFixed(1)}`;

  $: numeric = Number(value);
  $: frac = clamp(Number.isFinite(numeric) ? numeric : 0, 0, 1);
  $: valueDash = `${(frac * len).toFixed(1)} ${len.toFixed(1)}`;
  $: col = toneColor(tone);
</script>

<svg viewBox="0 0 {W} {H}" style="display:block; width:100%; height:auto;" aria-hidden="true">
  <path d={arc} fill="none" stroke="var(--bg-2)" stroke-width="11" />
  <path d={arc} fill="none" stroke="var(--border-soft)" stroke-width="11" stroke-dasharray={tickDash} />
  <path d={arc} fill="none" stroke={col} stroke-width="11" stroke-dasharray={valueDash} stroke-linecap="butt" />
</svg>
