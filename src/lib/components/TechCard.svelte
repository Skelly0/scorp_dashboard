<script>
  import { techState } from '../stores/tech.js';

  export let t;            // single tech record
  export let techByName;   // Map<lowercased name → tech record> (for prereq cross-branch lookup)

  $: state = techState(t);

  // Effect chip colour — direction-of-good. See spec §5.2.2.
  function chipDirection(eff) {
    const m = eff.mag;
    if (m == null || m === 0) return 'neutral';
    const ty = (eff.type || '').toLowerCase();
    if (ty === 'yield')     return m > 0 ? 'pos' : 'neg';
    if (ty === 'workforce') return m < 0 ? 'pos' : 'neg';
    if (ty === 'upkeep')    return m < 0 ? 'pos' : 'neg';
    return 'neutral';
  }

  function fmtMag(mag) {
    if (mag == null) return '—';
    const pct = Math.round(Math.abs(mag) * 100);
    const sign = mag > 0 ? '+' : (mag < 0 ? '−' : '');
    return `${sign}${pct}%`;
  }

  function lookupPrereq(name) {
    return techByName?.get(name.toLowerCase()) ?? null;
  }

  $: badge = state === 'researched' ? '✓'
            : state === 'available' ? '⚡'
            : '🔒';
  $: badgeLabel = state === 'researched' ? 'Researched'
                : state === 'available' ? 'Available'
                : 'Locked';
  $: isActive = t.researched === true;
  $: activeLabel = isActive ? 'Active' : 'Inactive';
  $: activeAria = isActive ? 'Effects active' : 'Effects inactive';
</script>

<div class="tech-card {state}">
  <div class="tech-card-header">
    <span class="tech-card-tier tnum">T{t.tier ?? '—'}</span>
    <span class="tech-card-cost tnum">{t.cost_rp ?? '—'} RP</span>
    <span
      class="tech-active-chip {isActive ? 'on' : 'off'}"
      title={activeAria}
      aria-label={activeAria}
    >{activeLabel}</span>
    <span class="tech-card-badge" title={badgeLabel} aria-label={badgeLabel}>{badge}</span>
  </div>

  <div class="tech-card-title">{t.name}</div>

  {#if t.effects.length > 0}
    <div class="tech-card-effects">
      {#each t.effects as eff}
        {@const dir = chipDirection(eff)}
        <div class="tech-effect-chip {dir}">
          <span class="tech-effect-mag tnum">{fmtMag(eff.mag)}</span>
          <span class="tech-effect-type">{eff.type_raw ?? '—'}</span>
          <span class="tech-effect-target">{eff.target}</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if t.prereqs.length > 0}
    <div class="tech-card-prereqs">
      {#each t.prereqs as p}
        {@const found = lookupPrereq(p)}
        {@const crossBranch = found && found.branch !== t.branch}
        {@const unmet = state === 'locked' && (!found || !found.researched)}
        <span class="tech-prereq-chip" class:unmet>
          ⤷ {p}{#if crossBranch} <span class="tech-prereq-branch">↗ {found.branch}</span>{/if}
        </span>
      {/each}
    </div>
  {/if}

  {#if t.description}
    <div class="tech-card-desc">{t.description}</div>
  {/if}
</div>
