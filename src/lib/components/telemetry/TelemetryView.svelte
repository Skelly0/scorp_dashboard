<script>
  // Telemetry sub-view: trend chart, ring-gauge instruments, resource sparklines,
  // situation readout. Store-driven; composes the section pieces under Bands.
  import Band from '../Band.svelte';
  import TrendChart from './TrendChart.svelte';
  import Instruments from './Instruments.svelte';
  import ResourceSparklines from './ResourceSparklines.svelte';
  import SituationReadout from './SituationReadout.svelte';
  import { currentFrame } from '../../stores/timeline.js';
</script>

<Band num="01" title="Trend Telemetry" meta="first → latest · before / after" />
<TrendChart />

<div class="mt-6">
  <Band num="02" title="Instruments" />
</div>
<Instruments frame={$currentFrame} />

<div class="mt-6">
  <Band num="03" title="Resource Sparklines" />
</div>
<ResourceSparklines />

<div class="mt-6">
  <Band num="04" title="Situation Readout" />
</div>
<SituationReadout />
