<script>
  // One legislative chamber: Total Seats KPI, stacked party-coloured seat
  // strip, then per-party rows sorted seats-desc. Zero-seat (but named)
  // parties render muted at the bottom and are omitted from the strip.
  import KpiBlock from './KpiBlock.svelte';
  import { partyColor } from '../faction-colors.js';
  import { fmtInt, fmtPct } from '../format.js';

  /** @type {{ total_seats: number, parties: Array<{name: string, seats: number | null}> }} */
  export let chamber;

  $: total = chamber?.total_seats ?? 0;
  $: sorted = [...(chamber?.parties ?? [])].sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0));
  $: seated = sorted.filter((p) => (p.seats ?? 0) > 0);
  $: stripLabel = seated.map((p) => `${p.name} ${fmtInt(p.seats)}`).join(', ');

  function color(name) {
    return partyColor(name) ?? 'var(--accent)';
  }

  function sharePct(p) {
    return total > 0 && p.seats != null ? (p.seats / total) * 100 : 0;
  }
</script>

<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
  <KpiBlock label="Total Seats" value={fmtInt(total)} />
</div>

<div class="s-card s-card-pad">
  <div class="seat-strip" role="img" aria-label="Seat composition: {stripLabel}">
    {#each seated as p (p.name)}
      <i style="width: {((p.seats ?? 0) / Math.max(total, 1)) * 100}%; --seg-color: {color(p.name)}"></i>
    {/each}
  </div>
  <ul class="seat-rows">
    {#each sorted as p (p.name)}
      <li class="seat-row" class:muted={!((p.seats ?? 0) > 0)}>
        <span class="faction-bar" style="--bar-color: {color(p.name)}"></span>
        <span class="seat-row-name">{p.name}</span>
        <!-- md+: proportional seat meter fills the wide middle column so the
             count/share stay scannable next to the name (share % carries the
             value for AT). Hidden at phone widths where rows pack tight. -->
        <span class="bar seat-row-bar" aria-hidden="true">
          <span style="width: {sharePct(p)}%; background: {color(p.name)}"></span>
        </span>
        <b class="tnum">{fmtInt(p.seats)}</b>
        <span class="seat-row-share tnum">{fmtPct(total > 0 && p.seats != null ? p.seats / total : null)}</span>
      </li>
    {/each}
  </ul>
</div>
