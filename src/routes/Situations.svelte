<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { situations, situationsError, loadSituations } from '../lib/stores/situations.js';
  import { pageTitle } from '../lib/page-title.js';
  import SituationCard from '../lib/components/SituationCard.svelte';
  import TierLadder from '../lib/components/TierLadder.svelte';

  let showEnded = false;

  onMount(() => {
    pageTitle.set('Situations');
    if ($meta?.synced_at) loadSituations($meta.synced_at);
  });

  $: empty = $situations &&
    $situations.active.length === 0 &&
    $situations.ended.length === 0 &&
    $situations.stability_modifiers.length === 0 &&
    $situations.tier_ladder.length === 0;
</script>

<section class="p-6">
  <h2 class="font-mono text-xl font-extrabold uppercase tracking-wider mb-4 border-b-4 border-border pb-2">
    Situations
  </h2>

  {#if $situationsError}
    <p class="text-crit">{$situationsError}</p>
  {:else if !$situations}
    <p class="text-muted">Loading…</p>
  {:else if empty}
    <p class="text-muted">
      Backend sheets pending — once the GM adds the <code>Situations</code>,
      <code>Stability Modifiers</code>, and <code>Tier Ladder</code> sheets, this page will populate.
    </p>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div>
        <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Active Situations</h3>
        <div class="space-y-2">
          {#each $situations.active as s}
            <SituationCard name={s.name} description={s.description} crisis_factor={s.crisis_factor} />
          {/each}
          {#if $situations.active.length === 0}
            <p class="text-muted text-sm">No active situations.</p>
          {/if}
        </div>
        {#if $situations.ended.length > 0}
          <button
            class="mt-3 text-xs uppercase tracking-widest border-2 border-border px-2 py-1"
            on:click={() => (showEnded = !showEnded)}
          >
            {showEnded ? 'Hide' : 'Show'} Ended ({$situations.ended.length})
          </button>
          {#if showEnded}
            <div class="space-y-2 mt-3">
              {#each $situations.ended as s}
                <SituationCard name={s.name} description={s.description} ended={true} />
              {/each}
            </div>
          {/if}
        {/if}
      </div>

      <div>
        <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">National Stability Modifiers</h3>
        <ul class="space-y-1 text-sm">
          {#each $situations.stability_modifiers as m}
            <li class="flex justify-between border-b border-border/30 pb-1">
              <span><strong>{m.name}</strong> — {m.description}</span>
              <span class="font-bold ml-2" class:text-crit={m.factor < 0}>{m.factor > 0 ? '+' : ''}{m.factor?.toFixed(2)}</span>
            </li>
          {/each}
          {#if $situations.stability_modifiers.length === 0}
            <li class="text-muted">No long-term modifiers.</li>
          {/if}
        </ul>
      </div>
    </div>

    {#if $situations.tier_ladder.length > 0}
      <h3 class="font-mono text-sm uppercase tracking-widest text-muted mb-2">Crisis Tier Ladder</h3>
      <TierLadder tiers={$situations.tier_ladder} />
    {/if}
  {/if}
</section>
