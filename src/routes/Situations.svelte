<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { situations, situationsError, loadSituations } from '../lib/stores/situations.js';
  import { pageTitle } from '../lib/page-title.js';
  import Band from '../lib/components/Band.svelte';
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

  $: totalCF = $situations
    ? $situations.active.reduce((a, s) => a + (Number(s.crisis_factor) || 0), 0)
    : 0;
  $: ciSeverity = totalCF >= 0.6 ? 'crit' : totalCF >= 0.3 ? 'warn' : 'low';
  $: ciTier =
    totalCF >= 0.8 ? 'T5 · Collapse'
    : totalCF >= 0.6 ? 'T4 · Crisis'
    : totalCF >= 0.4 ? 'T3 · Elevated'
    : totalCF >= 0.2 ? 'T2 · Watch'
    : 'T1 · Calm';
  $: ciPct = Math.max(0, Math.min(100, totalCF * 100));
</script>

<section class="px-6 py-5 max-w-[1600px]">
  {#if $situationsError}
    <p class="text-crit">{$situationsError}</p>
  {:else if !$situations}
    <p class="text-muted text-xs uppercase tracking-widest">Loading…</p>
  {:else if empty}
    <Band num="01" title="Situations" />
    <div class="s-card s-card-pad">
      <p class="text-muted text-sm">
        Backend sheets pending — once the GM populates Situations, Stability Modifiers,
        and Tier Ladder, this page will fill in.
      </p>
    </div>
  {:else}
    {#if $situations.active.length > 0}
      <Band num="00" title="Crisis Index" meta={`${$situations.active.length} active · Σ CF`} />
      <div class="crisis-index sev-{ciSeverity}">
        <div>
          <div class="ci-num">{totalCF.toFixed(2)}</div>
          <div class="ci-meta">aggregate cf</div>
        </div>
        <div>
          <div class="ci-bar"><div class="ci-bar-fill" style="width: {ciPct}%"></div></div>
          <div class="ci-meta" style="margin-top:6px">0.00 ─────────── 1.00</div>
        </div>
        <div class="ci-tier">{ciTier}</div>
      </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-7 gap-4">
      <div class="lg:col-span-4">
        <Band num="01" title="Active Situations" meta={`${$situations.active.length} active`} />
        {#if $situations.active.length === 0}
          <p class="text-muted text-xs uppercase tracking-widest">No active situations.</p>
        {:else}
          <div class="flex flex-col gap-2">
            {#each $situations.active as s}
              <SituationCard
                name={s.name}
                description={s.description}
                crisis_factor={s.crisis_factor}
              />
            {/each}
          </div>
        {/if}

        {#if $situations.ended.length > 0}
          <button
            class="s-chip mt-3"
            on:click={() => (showEnded = !showEnded)}
            aria-pressed={showEnded}
          >
            {showEnded ? 'Hide' : 'Show'} Ended ({$situations.ended.length})
          </button>
          {#if showEnded}
            <div class="flex flex-col gap-2 mt-2">
              {#each $situations.ended as s}
                <SituationCard name={s.name} description={s.description} ended={true} />
              {/each}
            </div>
          {/if}
        {/if}
      </div>

      <div class="lg:col-span-3">
        <Band num="02" title="Stability Modifiers" meta="long-term" />
        {#if $situations.stability_modifiers.length === 0}
          <p class="text-muted text-xs uppercase tracking-widest">No long-term modifiers.</p>
        {:else}
          <ul class="m-0 p-0 list-none text-[11px]">
            {#each $situations.stability_modifiers as m}
              <li class="flex justify-between items-baseline border-b border-[var(--border-soft)] border-dashed py-2 gap-3">
                <span><strong>{m.name}</strong> <span class="text-muted">— {m.description}</span></span>
                <strong class={m.factor < 0 ? 'crit tnum' : 'good tnum'}>
                  {m.factor > 0 ? '+' : ''}{m.factor?.toFixed(2)}
                </strong>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>

    {#if $situations.tier_ladder.length > 0}
      <Band num="03" title="Crisis Tier Ladder" meta="0.00 — 1.00" />
      <TierLadder tiers={$situations.tier_ladder} />
    {/if}
  {/if}
</section>
