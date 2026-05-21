<script>
  import { crisisGaugeGeometry } from '../crisis-breach.js';
  export let factor;
  $: g = crisisGaugeGeometry(factor);
</script>

<div class="crisis-gauge" aria-hidden="true">
  <div class="solid" style="width:{g.solidPct}%"></div>
  <div class="surplus" style="left:{g.tickPct}%;width:{g.surplusPct}%"></div>
  <div class="tick" style="left:{g.tickPct}%"></div>
</div>
<div class="crisis-gauge-cap">capacity 1.00 · <span class="sp">surplus +{g.surplus.toFixed(2)}</span></div>
