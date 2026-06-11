<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { congress, congressError, loadCongress } from '../lib/stores/congress.js';
  import { pageTitle } from '../lib/page-title.js';
  import Band from '../lib/components/Band.svelte';
  import PageState from '../lib/components/PageState.svelte';
  import SeatChamber from '../lib/components/SeatChamber.svelte';

  onMount(() => {
    pageTitle.set('Congress');
    if ($meta?.synced_at) loadCongress($meta.synced_at);
  });

  $: ready = $congress != null;
  $: empty = ready
    && $congress.congress.parties.length === 0
    && $congress.council.parties.length === 0;
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
          <code>CongressPartySeats</code> and <code>CouncilSeatsByParty</code>
          named ranges.
        </p>
      </div>
    {:else}
      <Band num="01" title="All-Worker Congress" meta="Art. 15 — delegates apportioned to Trade Federations" />
      <SeatChamber chamber={$congress.congress} />

      <Band num="02" title="Celestial Council" meta="Art. 16 — Congress totals scaled to Council size" />
      <SeatChamber chamber={$congress.council} />
    {/if}
  </PageState>
</section>
