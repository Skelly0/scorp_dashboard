<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { tech, techError, loadTech, techByBranch } from '../lib/stores/tech.js';
  import { pageTitle } from '../lib/page-title.js';
  import Band from '../lib/components/Band.svelte';
  import TechCard from '../lib/components/TechCard.svelte';

  onMount(() => {
    pageTitle.set('Tech');
    if ($meta?.synced_at) loadTech($meta.synced_at);
  });

  $: empty = $tech && $tech.techs.length === 0;
  $: techByName = new Map(
    ($tech?.techs ?? []).map((t) => [t.name.toLowerCase(), t]),
  );
</script>

<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px]">
  {#if $techError}
    <p class="text-crit">{$techError}</p>
  {:else if !$tech}
    <p class="text-muted text-xs uppercase tracking-widest">Loading…</p>
  {:else if empty}
    <Band num="01" title="Tech &amp; Institutions" />
    <div class="s-card s-card-pad">
      <p class="text-muted text-sm">
        Tech tree not yet wired up — sync hasn't seen the
        <code>TechTable</code> named range.
      </p>
    </div>
  {:else}
    <Band num="01" title="Research Progress" meta={`${$tech.techs.length} techs`} />
    {@const total = $tech.techs.length}
    {@const researchedCount = $tech.techs.filter((t) => t.researched).length}
    {@const availableCount = $tech.techs.filter((t) => t.available && !t.researched).length}
    {@const lockedCount = total - researchedCount - availableCount}
    {@const rpCommitted = $tech.techs
      .filter((t) => t.researched)
      .reduce((acc, t) => acc + (t.cost_rp ?? 0), 0)}

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
      <div class="kpi-block">
        <div class="kpi-label">Researched</div>
        <div class="kpi-value tnum">{researchedCount} / {total}</div>
      </div>
      <div class="kpi-block">
        <div class="kpi-label">Available</div>
        <div class="kpi-value tnum">{availableCount}</div>
      </div>
      <div class="kpi-block">
        <div class="kpi-label">Locked</div>
        <div class="kpi-value tnum">{lockedCount}</div>
      </div>
      <div class="kpi-block">
        <div class="kpi-label">RP Committed</div>
        <div class="kpi-value tnum">{rpCommitted}</div>
      </div>
    </div>

    <div class="tech-progress-row">
      {#each $tech.branches as branch}
        {@const inBranch = $tech.techs.filter((t) => t.branch === branch)}
        {@const done = inBranch.filter((t) => t.researched).length}
        {@const pct = inBranch.length === 0 ? 0 : (done / inBranch.length) * 100}
        <div class="tech-progress-cell">
          <div class="tech-progress-label">
            <span>{branch}</span>
            <span class="tnum">{done}/{inBranch.length}</span>
          </div>
          <div class="tech-progress-bar"><div style="width:{pct}%"></div></div>
        </div>
      {/each}
    </div>

    <Band num="02" title="Tech Tree" meta={`${$tech.branches.length} branches`} />
    <div class="tech-grid">
      {#each $tech.branches as branch}
        {@const items = $techByBranch.get(branch) ?? []}
        {@const tiers = [...new Set(items.map((t) => t.tier).filter((x) => x != null))].sort((a, b) => a - b)}
        <div class="tech-grid-col">
          <div class="tech-grid-col-title">{branch}</div>
          {#each tiers as tier}
            {@const tierItems = items.filter((t) => t.tier === tier)}
            <div class="tech-tier-label">Tier {tier}</div>
            {#each tierItems as t (t.name)}
              <TechCard {t} {techByName} />
            {/each}
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</section>
