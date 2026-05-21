<script>
  import { crisisGaugeGeometry } from '../crisis-breach.js';
  export let factor;
  export let label = 'Situation Load';
  $: g = crisisGaugeGeometry(factor);
  $: value = (Number(factor) || 0).toFixed(2);
</script>

<div class="crisis-gauge-head">
  <span class="crisis-gauge-label">{label}</span>
  <span class="crisis-gauge-val">{value}</span>
</div>
<div class="crisis-gauge" aria-hidden="true">
  <div class="solid" style="width:{g.solidPct}%"></div>
  <div class="surplus" style="left:{g.tickPct}%;width:{g.surplusPct}%"></div>
  <div class="tick" style="left:{g.tickPct}%"></div>
</div>
<div class="crisis-gauge-cap">capacity 1.00 · <span class="sp">surplus +{g.surplus.toFixed(2)}</span></div>
