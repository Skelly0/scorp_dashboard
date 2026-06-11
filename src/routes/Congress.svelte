<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { congress, congressError, loadCongress } from '../lib/stores/congress.js';
  import { pageTitle } from '../lib/page-title.js';
  import Band from '../lib/components/Band.svelte';
  import PageState from '../lib/components/PageState.svelte';
  import SeatChamber from '../lib/components/SeatChamber.svelte';
  import FederationChamber from '../lib/components/FederationChamber.svelte';

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
      <Band num="01" title="All-Worker Congress" meta="Art. 15 — delegates apportioned to Trade Federations" />
      <SeatChamber chamber={$congress.congress} />

      <Band num="02" title="Trade Federation Delegations" meta="Art. 15 — each delegation split by party support" />
      {#if hasDelegations}
        <FederationChamber federations={$congress.federations} />
      {:else}
        <div class="s-card s-card-pad">
          <p class="text-muted text-sm">
            Delegation data hasn't synced yet — the
            <code>DELEGATION → PARTY SEATS</code> block was not found on the
            All-Worker Congress sheet.
          </p>
        </div>
      {/if}
    {/if}
  </PageState>
</section>
