<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { tech, techError, loadTech, techByBranch } from '../lib/stores/tech.js';
  import { pageTitle } from '../lib/page-title.js';
  import Band from '../lib/components/Band.svelte';
  import KpiBlock from '../lib/components/KpiBlock.svelte';
  import TechCard from '../lib/components/TechCard.svelte';

  onMount(() => {
    pageTitle.set('Tech');
    if ($meta?.synced_at) loadTech($meta.synced_at);
  });

  $: empty = $tech && $tech.techs.length === 0;
  $: techs = $tech?.techs ?? [];
  $: total = techs.length;
  $: researchedCount = techs.filter((t) => t.researched).length;
  $: availableCount = techs.filter((t) => t.available && !t.researched).length;
  $: lockedCount = total - researchedCount - availableCount;
  $: rpCommitted = techs
    .filter((t) => t.researched)
    .reduce((acc, t) => acc + (t.cost_rp ?? 0), 0);
  $: accruedRp = $tech?.research_points?.accrued ?? null;
  $: rpRemaining = accruedRp == null ? null : accruedRp - rpCommitted;
  $: accruedDetails = rpRemaining == null
    ? []
    : [{
        key: 'remaining',
        text: `${fmtSignedInt(rpRemaining)} remaining`,
        tone: rpRemaining < 0 ? 'crit' : rpRemaining > 0 ? 'good' : null,
      }];
  $: techByName = new Map(
    techs.map((t) => [t.name.toLowerCase(), t]),
  );

  function fmtInt(n) {
    if (n == null || !Number.isFinite(n)) return null;
    return Math.round(n).toLocaleString();
  }

  function fmtSignedInt(n) {
    if (n == null || !Number.isFinite(n)) return '—';
    const rounded = Math.round(n);
    return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString()}`;
  }
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
    <Band num="01" title="Research Progress" meta={`${total} techs`} />

    <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
      <KpiBlock label="Researched" value={`${researchedCount} / ${total}`} />
      <KpiBlock label="Available" value={fmtInt(availableCount)} />
      <KpiBlock label="Locked" value={fmtInt(lockedCount)} />
      <KpiBlock
        label="RP Accrued"
        value={fmtInt(accruedRp)}
        details={accruedDetails}
        tone={rpRemaining != null && rpRemaining < 0 ? 'crit' : null}
      />
      <KpiBlock label="RP Committed" value={fmtInt(rpCommitted)} />
    </div>

    <div class="tech-progress-row">
      {#each $tech.branches as branch}
        {@const inBranch = techs.filter((t) => t.branch === branch)}
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
