<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { congress, congressError, loadCongress } from '../lib/stores/congress.js';
  import { pageTitle } from '../lib/page-title.js';
  import Band from '../lib/components/Band.svelte';
  import PageState from '../lib/components/PageState.svelte';
  import ChamberView from '../lib/components/congress/ChamberView.svelte';
  import FederationsView from '../lib/components/congress/FederationsView.svelte';

  const TABS = ['chamber', 'federations'];

  function readPersist() {
    try {
      return JSON.parse(localStorage.getItem('scorp.congress') || '{}');
    } catch (e) {
      return {};
    }
  }
  function persist(patch) {
    try {
      localStorage.setItem('scorp.congress', JSON.stringify({ ...readPersist(), ...patch }));
    } catch (e) {
      /* ignore */
    }
  }

  let view = TABS.includes(readPersist().view) ? readPersist().view : 'chamber';
  function setView(next) {
    view = next;
    persist({ view: next });
  }

  onMount(() => {
    pageTitle.set('Congress');
    if ($meta?.synced_at) loadCongress($meta.synced_at);
  });

  $: ready = $congress != null;
  $: hasParties = ready && $congress.congress.parties.length > 0;
  $: hasDelegations = ready && $congress.federations.delegations.length > 0;
  $: empty = ready && !hasParties && !hasDelegations;
</script>

<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1600px]">
  <PageState
    label="Congress"
    page="congress"
    error={$congressError}
    loading={!ready}
    loadingText="Counting delegates..."
    retry={() => loadCongress($meta.synced_at)}
  >
    {#if empty}
      <Band num="01" title="All-Worker Congress" />
      <div class="s-card s-card-pad">
        <p class="text-muted text-sm">
          Congress data is not yet wired up. Sync has not seen the
          <code>CongressPartyNames</code> range or the
          <code>DELEGATION → PARTY SEATS</code> block on the All-Worker
          Congress sheet.
        </p>
      </div>
    {:else}
      <div class="cmd-tabs" role="tablist" aria-label="Congress view">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'chamber'}
          class:active={view === 'chamber'}
          on:click={() => setView('chamber')}>Chamber</button
        >
        <button
          type="button"
          role="tab"
          aria-selected={view === 'federations'}
          class:active={view === 'federations'}
          on:click={() => setView('federations')}>Federations</button
        >
      </div>

      {#if view === 'chamber'}
        <ChamberView chamber={$congress.congress} />
      {:else if hasDelegations}
        <FederationsView federations={$congress.federations} />
      {:else}
        <Band num="01" title="Trade Federation Delegations" meta="Art. 15 — each delegation split by party support" />
        <div class="s-card s-card-pad">
          <p class="text-muted text-sm">
            No delegation results published yet — seat splits appear here
            once the workbook pins the seat matrix to the
            <code>CongressDelegationSeats</code> named range.
          </p>
        </div>
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
