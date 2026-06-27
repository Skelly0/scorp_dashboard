<script>
  // Three ring-gauge instruments for the shown frame: Stability, Crisis Pressure
  // and Gov Approval. Tone via statusMetricTone (Crisis is lower-is-better); the
  // percent value is the canonical formatStatusPercent read. Renders nothing when
  // there is no frame (parent shows a graceful note instead).
  import { statusMetricTone, formatStatusPercent, toneColor } from '../../command-format.js';
  import RingGauge from './RingGauge.svelte';

  export let frame = null;

  $: gauges = frame
    ? [
        { label: 'Stability', value: frame.stability, tone: statusMetricTone(frame.stability) },
        {
          label: 'Crisis Pressure',
          value: frame.crisis_factor,
          tone: statusMetricTone(frame.crisis_factor, { lowerIsBetter: true }),
        },
        { label: 'Gov Approval', value: frame.gov_approval, tone: statusMetricTone(frame.gov_approval) },
      ]
    : [];
</script>

<div class="instruments-grid">
  {#each gauges as g (g.label)}
    <div class="instrument-card">
      <div class="ring-wrap"><RingGauge value={g.value} tone={g.tone} /></div>
      <div class="instrument-value" style="color:{toneColor(g.tone)};">{formatStatusPercent(g.value)}</div>
      <div class="instrument-label">{g.label}</div>
    </div>
  {/each}
</div>

<style>
  .instruments-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .instrument-card {
    border: 2px solid var(--border);
    background: var(--bg);
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .ring-wrap {
    width: 100%;
    max-width: 180px;
  }
  .instrument-value {
    font-size: 20px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .instrument-label {
    font-size: 9.5px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
  }
  @media (max-width: 560px) {
    .instruments-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
