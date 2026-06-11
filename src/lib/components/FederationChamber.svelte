<script>
  // Trade Federation delegations: a hemicycle parliament diagram (one dot
  // per delegate, coloured by party; outer arc band coloured by federation)
  // above per-federation legend rows. Seats fill left → right delegation by
  // delegation in workbook order, parties in workbook column order within
  // each delegation, so every federation forms a contiguous angular wedge
  // (layout math in src/lib/parliament.js). Party split per row is repeated
  // as sr-only text because the mini strip and dots are colour-only.
  import { seatPositions, groupArcs, dotRadius } from '../parliament.js';
  import { federationColor, partyColor } from '../faction-colors.js';
  import { fmtInt, fmtPct } from '../format.js';

  /** @type {{ total_seats: number, delegations: Array<{name: string, seats: number | null, parties: Array<{name: string, seats: number | null}>}> }} */
  export let federations;

  // SVG geometry: unit hemicycle scaled by R around (CX, CY), y flipped.
  const CX = 110;
  const CY = 108;
  const R = 84;

  $: delegations = federations?.delegations ?? [];
  $: total = federations?.total_seats ?? 0;
  $: dots = delegations.flatMap((d) =>
    (d.parties ?? []).flatMap((p) =>
      Array.from({ length: Math.max(0, Math.round(p.seats ?? 0)) }, () => ({
        federation: d.name,
        party: p.name,
        color: seatColor(p.name),
      }))
    )
  );
  $: groupSizes = delegations.map((d) =>
    (d.parties ?? []).reduce((acc, p) => acc + Math.max(0, Math.round(p.seats ?? 0)), 0)
  );
  $: positions = seatPositions(dots.length);
  $: arcs = groupArcs(positions, groupSizes);
  $: dotR = dotRadius(dots.length) * R;
  $: arcRadius = R + dotR * 2.4;
  $: maxDelegation = Math.max(1, ...delegations.map((d) => d.seats ?? 0));

  function seatColor(name) {
    return partyColor(name) ?? 'var(--accent)';
  }

  function arcPath(arc, radius) {
    const x0 = CX + radius * Math.cos(arc.start);
    const y0 = CY - radius * Math.sin(arc.start);
    const x1 = CX + radius * Math.cos(arc.end);
    const y1 = CY - radius * Math.sin(arc.end);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  function splitLabel(d) {
    return (d.parties ?? []).map((p) => `${p.name} ${fmtInt(p.seats)}`).join(', ');
  }
</script>

<div class="s-card s-card-pad">
  {#if dots.length > 0}
    <div class="parliament-wrap">
      <svg
        class="parliament-svg"
        viewBox="0 0 220 118"
        role="img"
        aria-label="Parliament diagram: {fmtInt(total)} delegates across {delegations.length} trade federation delegations. Dots are coloured by party, the outer band by federation; the list below carries the full breakdown."
      >
        {#each arcs as arc, i}
          {#if arc}
            <path
              d={arcPath(arc, arcRadius)}
              fill="none"
              stroke={federationColor(delegations[i].name)}
              stroke-width={Math.max(2.5, dotR * 0.55)}
            >
              <title>{delegations[i].name} — {fmtInt(groupSizes[i])} delegates</title>
            </path>
          {/if}
        {/each}
        {#each positions as pos, i}
          <circle class="parliament-dot" cx={CX + pos.x * R} cy={CY - pos.y * R} r={dotR} fill={dots[i].color}>
            <title>{dots[i].federation} — {dots[i].party}</title>
          </circle>
        {/each}
      </svg>
    </div>
    <p class="parliament-caption" aria-hidden="true">dots · party — outer band · federation</p>
  {/if}
  <ul class="seat-rows">
    {#each delegations as d (d.name)}
      <li class="seat-row" class:muted={!((d.seats ?? 0) > 0)}>
        <span class="faction-bar" style="--bar-color: {federationColor(d.name)}"></span>
        <span class="seat-row-name">
          {d.name}
          <span class="sr-only">— {splitLabel(d)}</span>
        </span>
        <span class="bar seat-row-bar fed-bar" aria-hidden="true">
          {#each d.parties ?? [] as p (p.name)}
            <span style="width: {(Math.max(0, p.seats ?? 0) / maxDelegation) * 100}%; background: {seatColor(p.name)}"></span>
          {/each}
        </span>
        <b class="tnum">{fmtInt(d.seats)}</b>
        <span class="seat-row-share tnum">{fmtPct(total > 0 && d.seats != null ? d.seats / total : null)}</span>
      </li>
    {/each}
  </ul>
</div>
