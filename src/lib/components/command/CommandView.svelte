<script>
  // Command sub-view: Vital Signs, Resource Telemetry, Overton Window, Situation
  // Board. Store-driven — composes the section pieces under Band headers.
  import Band from '../Band.svelte';
  import VitalSigns from './VitalSigns.svelte';
  import ResourceTelemetry from './ResourceTelemetry.svelte';
  import OvertonWindow from './OvertonWindow.svelte';
  import SituationBoard from './SituationBoard.svelte';
  import { situations } from '../../stores/situations.js';
  import { isLiveYear } from '../../stores/timeline.js';

  $: sitCount = $isLiveYear ? $situations?.active?.length ?? 0 : 0;
</script>

<Band num="01" title="Vital Signs" meta="Click a tile to drill down" />
<VitalSigns />

<div class="grid grid-cols-12 gap-4 mt-6">
  <div class="col-span-12 lg:col-span-7 min-w-0">
    <Band num="02" title="Resource Telemetry" />
    <ResourceTelemetry />
    <div class="mt-6">
      <Band num="03" title="Overton Window" meta="Click axis for parties" />
    </div>
    <OvertonWindow />
  </div>
  <div class="col-span-12 lg:col-span-5 min-w-0">
    <Band num="04" title="Situation Board" meta={`${sitCount} active`} />
    <SituationBoard />
  </div>
</div>
