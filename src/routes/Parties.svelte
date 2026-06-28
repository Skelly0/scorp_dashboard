<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { parties, partiesError, loadParties } from '../lib/stores/parties.js';
  import { pops, popsError, loadPops } from '../lib/stores/pops.js';
  import { pageTitle } from '../lib/page-title.js';
  import { classCompatPopMatrix, partySupportOverview } from '../lib/party-compat.js';
  import { partyIdeology } from '../lib/party-ideology.js';
  import { partyColor } from '../lib/faction-colors.js';
  import PageState from '../lib/components/PageState.svelte';
  import Band from '../lib/components/Band.svelte';
  import RosterView from '../lib/components/parties/RosterView.svelte';
  import SpectrumView from '../lib/components/parties/SpectrumView.svelte';
  import SupportView from '../lib/components/parties/SupportView.svelte';

  const TABS = ['roster', 'spectrum', 'support'];

  function readPersist() {
    try {
      return JSON.parse(localStorage.getItem('scorp.parties') || '{}');
    } catch (e) {
      return {};
    }
  }
  function persist(patch) {
    try {
      localStorage.setItem('scorp.parties', JSON.stringify({ ...readPersist(), ...patch }));
    } catch (e) {
      /* ignore */
    }
  }

  let view = TABS.includes(readPersist().view) ? readPersist().view : 'roster';
  function setView(next) {
    view = next;
    persist({ view: next });
  }

  onMount(() => {
    pageTitle.set('Parties');
    if ($meta?.synced_at) {
      loadParties($meta.synced_at);
      loadPops($meta.synced_at);
    }
  });

  $: errorMsg = $partiesError ?? $popsError;

  $: supportOverview = partySupportOverview(
    $parties?.party_capture_pct_matrix,
    $parties?.party_capture_pop_matrix,
  );
  $: supportByParty = new Map(supportOverview.map((item) => [item.party, item]));
  $: classPopMatrix = classCompatPopMatrix($parties?.class_compat_matrix, $pops?.classes);

  // Enrich each party with its resolved accent + lean + authoritative supporters
  // count (summed captured pop, gotcha #44) and top-class breakdown.
  $: enriched = ($parties?.parties ?? []).map((p) => {
    const ideo = partyIdeology(p.stance);
    const support = supportByParty.get(p.name);
    return {
      ...p,
      color: partyColor(p.name) ?? ideo.color,
      leanLabel: ideo.leanLabel,
      supporters: support?.totalCapturedPop ?? p.estimated_support ?? null,
      topClasses: support?.topClasses ?? [],
    };
  });
</script>

<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px]">
  <PageState
    label="Parties"
    page={['parties', 'pops']}
    error={errorMsg}
    loading={!$parties || !$pops}
    retry={() => { loadParties($meta.synced_at); loadPops($meta.synced_at); }}
  >
    {#if enriched.length === 0}
      <Band num="01" title="Founded Parties" meta="0 parties" />
      <div class="s-card s-card-pad">
        <p class="text-muted text-sm">No parties founded yet — players form parties during play.</p>
      </div>
    {:else}
      <div class="cmd-tabs" role="tablist" aria-label="Parties view">
        <button type="button" role="tab" aria-selected={view === 'roster'} class:active={view === 'roster'} on:click={() => setView('roster')}>Roster</button>
        <button type="button" role="tab" aria-selected={view === 'spectrum'} class:active={view === 'spectrum'} on:click={() => setView('spectrum')}>Spectrum</button>
        <button type="button" role="tab" aria-selected={view === 'support'} class:active={view === 'support'} on:click={() => setView('support')}>Support</button>
      </div>

      {#if view === 'roster'}
        <RosterView parties={enriched} popMatrix={$parties.party_capture_pop_matrix} />
      {:else if view === 'spectrum'}
        <SpectrumView parties={enriched} />
      {:else}
        <SupportView
          pctMatrix={$parties.party_capture_pct_matrix}
          popMatrix={$parties.party_capture_pop_matrix}
          fallbackPopMatrix={classPopMatrix}
          goiMatrix={$parties.goi_compat_matrix}
        />
      {/if}
    {/if}
  </PageState>
</section>

<style>
  .cmd-tabs {
    display: flex;
    border: 1px solid var(--border-soft);
    margin-bottom: 14px;
    width: fit-content;
  }
  .cmd-tabs button {
    background: transparent;
    color: var(--fg-dim);
    border: none;
    border-right: 1px solid var(--border-soft);
    padding: 8px 18px;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    cursor: pointer;
    font-family: inherit;
  }
  .cmd-tabs button:last-child {
    border-right: none;
  }
  .cmd-tabs button:hover {
    color: var(--accent);
  }
  .cmd-tabs button.active {
    background: var(--accent);
    color: var(--alert-fg, var(--bg));
  }
</style>
