<script>
  import RadarChart from './RadarChart.svelte';
  import { goiColor } from '../faction-colors.js';
  import { WORLDVIEW_AXES as AXES, AXIS_HIGH_LABELS } from '../worldview.js';
  import { createEventDispatcher } from 'svelte';

  /** @type {{name: string, goal: string|null, influence: number|null,
   *          approval: number|null, national_share: number|null,
   *          effective_worldview: Record<string, number|null>|null}|null} */
  export let subfaction = null;
  /** @type {{name: string, effective_worldview: Record<string, number>}|null} */
  export let parent = null;

  const dispatch = createEventDispatcher();

  function close() { dispatch('close'); }

  function pct(v) {
    return v == null ? '—' : `${Math.round(v * 100)}%`;
  }
  function pctOneDec(v) {
    return v == null ? '—' : `${(Math.round(v * 1000) / 10).toFixed(1)}%`;
  }

  $: hasSubfactionWorldview = subfaction?.effective_worldview &&
    AXES.every((a) => subfaction.effective_worldview[a] != null);
  $: hasParentWorldview = parent?.effective_worldview &&
    AXES.every((a) => parent.effective_worldview[a] != null);
  $: subfactionAxes = hasSubfactionWorldview
    ? AXES.map((a) => ({ label: AXIS_HIGH_LABELS[a], value: subfaction.effective_worldview[a] }))
    : null;
  $: parentAxes = hasParentWorldview
    ? AXES.map((a) => ({ label: AXIS_HIGH_LABELS[a], value: parent.effective_worldview[a] }))
    : null;
</script>

{#if subfaction == null}
  <div class="s-rail-empty" role="region" aria-label="Sub-faction detail">
    <div class="s-rail-empty-icon" aria-hidden="true">◇</div>
    <p>Select a sub-faction to inspect</p>
  </div>
{:else}
  <div class="s-rail-panel" role="region" aria-label="Sub-faction detail">
    <header class="s-rail-header">
      <span
        class="faction-bar"
        style="--bar-color: {parent ? goiColor(parent.name) : 'var(--border)'}"
        aria-hidden="true"
      ></span>
      <div class="s-rail-titles">
        <h3 class="s-rail-name">{subfaction.name}</h3>
        {#if parent}
          <div class="s-rail-parent">{parent.name}</div>
        {/if}
      </div>
      <button
        type="button"
        class="s-rail-close"
        on:click={close}
        aria-label="Close sub-faction detail"
      >×</button>
    </header>

    <section class="s-rail-section">
      <div class="s-rail-section-label">Goal</div>
      {#if subfaction.goal}
        <p class="s-rail-goal">{subfaction.goal}</p>
      {:else}
        <p class="s-rail-goal s-rail-goal-empty"><em>No goal recorded</em></p>
      {/if}
    </section>

    {#if subfactionAxes || parentAxes}
      <section class="s-rail-section s-rail-radar">
        <RadarChart
          axes={subfactionAxes ?? parentAxes}
          overlay={subfactionAxes ? parentAxes : null}
          size={200}
        />
        {#if !subfactionAxes && parentAxes}
          <div class="s-rail-radar-note">
            <em>per-faction stance unavailable</em>
          </div>
        {/if}
      </section>
    {/if}

    <section class="s-rail-section s-rail-kpis">
      <div class="s-rail-kpi">
        <div class="s-rail-kpi-label">Influence</div>
        <div class="s-rail-kpi-value tnum">{pct(subfaction.influence)}</div>
      </div>
      <div class="s-rail-kpi">
        <div class="s-rail-kpi-label">Nat. Share</div>
        <div class="s-rail-kpi-value tnum">{pctOneDec(subfaction.national_share)}</div>
      </div>
      <div class="s-rail-kpi">
        <div class="s-rail-kpi-label">Approval</div>
        <div class="s-rail-kpi-value tnum">{pct(subfaction.approval)}</div>
      </div>
    </section>
  </div>
{/if}
