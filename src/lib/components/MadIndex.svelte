<script>
  export let value = null;
  export let compact = false;

  const helpText =
    'MAD Index: weighted absolute worldview distance from the current Overton center. Lower or negative means closer to the mainstream; positive means further outside it.';

  function classify(v) {
    if (v == null || Number.isNaN(v)) {
      return {
        label: 'No signal',
        tone: 'muted',
        aria: 'MAD Index unavailable'
      };
    }

    if (v <= -0.5) {
      return {
        label: 'Overton center',
        tone: 'good',
        aria: 'at the Overton center'
      };
    }

    if (v < 0) {
      return {
        label: 'Inside window',
        tone: 'good',
        aria: 'inside the Overton window'
      };
    }

    if (v < 0.25) {
      return {
        label: 'At the edge',
        tone: 'warn',
        aria: 'near the edge of the Overton window'
      };
    }

    return {
      label: 'Outside window',
      tone: 'crit',
      aria: 'outside the Overton window'
    };
  }

  $: state = classify(value);
  $: displayValue = value != null && !Number.isNaN(value) ? value.toFixed(2) : '—';
  $: ariaLabel = value != null && !Number.isNaN(value)
    ? `MAD Index ${displayValue}: ${state.aria}. ${helpText}`
    : helpText;
</script>

<div class:compact class="mad-index" title={helpText} aria-label={ariaLabel}>
  <div class="mad-topline">
    <div>
      <div class="mad-label">Overton distance</div>
      <div class="mad-alias">MAD Index</div>
    </div>
    <div class="mad-value tnum">{displayValue}</div>
  </div>
  <div class="mad-state {state.tone}">{state.label}</div>
  {#if !compact}
    <div class="mad-help">Lower/negative = closer to mainstream.</div>
  {/if}
</div>

<style>
  .mad-index {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .mad-topline {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }

  .mad-label,
  .mad-alias,
  .mad-state,
  .mad-help {
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .mad-label {
    color: var(--fg);
    font-size: 9px;
    font-weight: 800;
  }

  .mad-alias,
  .mad-help {
    color: var(--muted);
    font-size: 9px;
  }

  .mad-value {
    color: var(--fg);
    font-size: 18px;
    font-weight: 800;
    line-height: 1;
  }

  .mad-state {
    width: fit-content;
    border-left: 3px solid var(--muted);
    padding-left: 6px;
    color: var(--muted);
    font-size: 9px;
    font-weight: 800;
    line-height: 1.35;
  }

  .mad-state.good {
    border-left-color: var(--good);
    color: var(--good);
  }

  .mad-state.warn {
    border-left-color: var(--warn);
    color: var(--warn);
  }

  .mad-state.crit {
    border-left-color: var(--crit);
    color: var(--crit);
  }

  .mad-help {
    line-height: 1.35;
  }

  .compact .mad-alias,
  .compact .mad-help {
    display: none;
  }

  .compact .mad-topline {
    display: block;
  }

  .compact .mad-value {
    margin-top: 2px;
    font-size: 17px;
  }

  .compact .mad-label,
  .compact .mad-state {
    font-size: 8px;
    letter-spacing: 0.12em;
  }
</style>
