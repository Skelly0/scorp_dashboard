<script>
  // Congress "Federations" tab: the federation × party seat matrix (transpose
  // view) + focus panel, matching the mockup. Party columns are derived from the
  // delegation data itself (sum across delegations), so the matrix is internally
  // consistent regardless of the separate CongressPartySeats totals channel.
  import Band from '../Band.svelte';
  import FederationMatrix from './FederationMatrix.svelte';
  import { partyColor } from '../../faction-colors.js';

  /** @type {{ total_seats: number, delegations: Array<{name: string, seats: number, parties: Array<{name: string, seats: number}>}> }} */
  export let federations;

  $: delegations = federations?.delegations ?? [];
  $: partyColumns = (() => {
    const totals = new Map();
    for (const d of delegations) {
      for (const p of d.parties ?? []) {
        const s = Math.max(0, Math.round(p.seats ?? 0));
        if (s > 0) totals.set(p.name, (totals.get(p.name) ?? 0) + s);
      }
    }
    return [...totals.entries()]
      .map(([name, seats]) => ({ name, seats, color: partyColor(name) ?? 'var(--accent)' }))
      .sort((a, b) => b.seats - a.seats);
  })();
</script>

{#if partyColumns.length}
  <Band num="01" title="Federation Seat Matrix" meta="Which federations each party draws delegates from" />
  <FederationMatrix {delegations} {partyColumns} />
{/if}
