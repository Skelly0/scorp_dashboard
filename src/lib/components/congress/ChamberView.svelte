<script>
  // Congress "Chamber" tab: party-totals hemicycle + interactive coalition
  // builder + a roster ranked by seats with Banzhaf voting-power bars. Everything
  // is derived from congress.json seat counts; the all-zero pre-election chamber
  // is rendered faithfully as a "no seats apportioned" state (gotcha #56).
  import Band from '../Band.svelte';
  import KpiBlock from '../KpiBlock.svelte';
  import PartyHemicycle from './PartyHemicycle.svelte';
  import { partyColor } from '../../faction-colors.js';
  import { fmtInt, fmtPct, fmtNum } from '../../format.js';
  import {
    majorityQuota,
    banzhafPower,
    effectiveParties,
    coalitionSeats,
  } from '../../congress-power.js';

  /** @type {{ total_seats: number, parties: Array<{name: string, seats: number}> }} */
  export let chamber;

  function color(name) {
    return partyColor(name) ?? 'var(--accent)';
  }

  $: allParties = (chamber?.parties ?? []).map((p) => ({
    name: p.name,
    seats: Math.max(0, Math.round(p.seats ?? 0)),
    color: color(p.name),
  }));
  $: seated = allParties.filter((p) => p.seats > 0).sort((a, b) => b.seats - a.seats);
  $: chamberSeats = seated.reduce((a, p) => a + p.seats, 0);
  $: majority = majorityQuota(chamberSeats);
  $: powerMap = banzhafPower(seated, majority);
  $: maxPower = Math.max(0.0001, ...seated.map((p) => powerMap.get(p) ?? 0));
  $: maxSeats = Math.max(1, ...seated.map((p) => p.seats));
  $: enp = effectiveParties(seated);

  // ---- coalition state (ephemeral UI) ----
  let coalition = new Set();
  function toggle(name) {
    const next = new Set(coalition);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    coalition = next;
  }
  function setPreset(names) {
    coalition = new Set(names);
  }
  $: coalitionMembers = seated.filter((p) => coalition.has(p.name));
  $: coalSeats = coalitionSeats(coalitionMembers);
  $: win = coalSeats >= majority && majority > 0;
  $: statusText = win ? 'Working majority' : coalition.size ? 'Short of majority' : 'No coalition';
  $: statusTone = win ? 'good' : coalition.size ? 'crit' : 'muted';
  $: coalitionNote = (() => {
    if (chamberSeats === 0) return '';
    if (coalition.size === 0)
      return `Empty floor. Tap parties or seats to assemble a majority — you need ${majority} of ${chamberSeats}.`;
    const names = coalitionMembers.map((p) => p.name).join(' + ');
    if (win)
      return `${names} command ${coalSeats} seats — a working majority of ${coalSeats - majority + 1}.`;
    return `${names} hold only ${coalSeats} — ${majority - coalSeats} short of the ${majority} needed.`;
  })();

  $: topThree = seated.slice(0, 3).map((p) => p.name);

  // Coalition fill bar cells (one per apportioned seat).
  $: cells = Array.from({ length: chamberSeats }, (_, i) => i < coalSeats);
</script>

{#if chamberSeats === 0}
  <Band num="01" title="All-Worker Congress" meta="Art. 15 — delegates apportioned to Trade Federations" />
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
    <KpiBlock label="Chamber Seats" value={fmtInt(chamber?.total_seats ?? 0)} />
  </div>
  <div class="s-card s-card-pad">
    <p class="text-muted text-sm">
      No seats apportioned yet — the chamber is in its pre-election state. Party
      totals populate here once elections are run and
      <code>CongressPartySeats</code> is published.
    </p>
  </div>
{:else}
  <div class="chamber-top">
    <div class="chamber-col">
      <Band num="01" title="All-Worker Congress" meta="Click seats to build a coalition" />
      <div class="s-card s-card-pad chamber-hemi">
        <PartyHemicycle parties={seated} {coalition} {majority} onToggle={toggle} />
      </div>
    </div>

    <div class="chamber-col">
      <Band num="02" title="Coalition Builder" />
      <div class="s-card s-card-pad coalition-card">
      <div class="coalition-head">
        <div>
          <div class="coalition-seats {statusTone}">
            {coalSeats}<span class="coalition-of"> / {chamberSeats}</span>
          </div>
          <div class="coalition-status {statusTone}">{statusText}</div>
        </div>
        <div class="coalition-majority">
          <div class="coalition-majority-lbl">Majority</div>
          <div class="coalition-majority-val tnum">{majority}</div>
        </div>
      </div>

      <div class="coalition-bar" role="img" aria-label="Coalition holds {coalSeats} of {chamberSeats} seats; {majority} needed for a majority.">
        {#each cells as filled, i}
          <span
            class="coalition-cell"
            class:filled
            class:win={filled && win}
            class:tick={i === majority - 1}
          ></span>
        {/each}
      </div>

      <div class="coalition-presets">
        <button type="button" class="s-chip" on:click={() => setPreset(topThree)}>Top 3</button>
        <button type="button" class="s-chip" on:click={() => setPreset([])}>Clear</button>
      </div>

      <div class="coalition-chip-lbl">Parties in coalition</div>
      <div class="coalition-chips">
        {#each seated as p (p.name)}
          <button
            type="button"
            class="coalition-chip"
            class:on={coalition.has(p.name)}
            aria-pressed={coalition.has(p.name)}
            on:click={() => toggle(p.name)}
          >
            <span class="faction-bar" style="--bar-color: {p.color}"></span>
            <span class="coalition-chip-name">{p.name}</span>
            <span class="coalition-chip-seats tnum">{p.seats}</span>
            <span class="coalition-chip-mark {coalition.has(p.name) ? 'good' : 'muted'}">{coalition.has(p.name) ? '✓' : '+'}</span>
          </button>
        {/each}
      </div>

        <p class="coalition-note">{coalitionNote}</p>
      </div>
    </div>
  </div>

  <Band num="03" title="Party Roster" meta="Voting power = Banzhaf index" />
  <div class="s-card s-card-pad">
    <div class="roster-grid roster-head">
      <span></span>
      <span>Party</span>
      <span class="roster-num">Seats</span>
      <span>Seat share</span>
      <span>Voting power</span>
    </div>
    {#each seated as p (p.name)}
      {@const power = powerMap.get(p) ?? 0}
      <div class="roster-grid roster-row">
        <span class="faction-bar" style="--bar-color: {p.color}"></span>
        <span class="roster-name">{p.name}</span>
        <span class="roster-num tnum"><b>{p.seats}</b></span>
        <div class="roster-meter">
          <span class="bar"><span style="width: {((p.seats / maxSeats) * 100).toFixed(1)}%; background: {p.color}"></span></span>
          <span class="roster-val tnum">{fmtPct(chamberSeats ? p.seats / chamberSeats : null)}</span>
        </div>
        <div class="roster-meter">
          <span class="bar"><span style="width: {((power / maxPower) * 100).toFixed(1)}%"></span></span>
          <span class="roster-val tnum {power >= maxPower - 0.0001 ? 'good' : 'muted'}">{fmtPct(power)}</span>
        </div>
      </div>
    {/each}
    {#if enp != null}
      <p class="roster-foot">
        Effective number of parties: <b class="tnum">{fmtNum(enp, 1)}</b> — voting
        power is each party's share of the coalitions where its votes are decisive,
        which can diverge sharply from raw seat share in a fragmented chamber.
      </p>
    {/if}
  </div>
{/if}

<style>
  .chamber-top {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
    margin-bottom: 4px;
  }
  @media (min-width: 1000px) {
    .chamber-top {
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
      align-items: start;
    }
  }
  .chamber-col { min-width: 0; display: flex; flex-direction: column; }
  .chamber-col :global(.band) { margin-top: 0; }
  /* Plain block so the hemicycle SVG fills the card width (a flex parent +
     auto-margin child shrink-wraps the SVG to its intrinsic size). */
  .chamber-hemi { display: block; }

  .coalition-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .coalition-seats {
    font-size: 42px;
    font-weight: 800;
    line-height: 0.9;
    font-variant-numeric: tabular-nums;
  }
  .coalition-of { font-size: 18px; color: var(--muted); }
  .coalition-status {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-top: 4px;
  }
  .coalition-seats.good, .coalition-status.good { color: var(--good); }
  .coalition-seats.crit, .coalition-status.crit { color: var(--crit); }
  .coalition-seats.muted, .coalition-status.muted { color: var(--muted); }
  .coalition-majority { text-align: right; }
  .coalition-majority-lbl {
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .coalition-majority-val { font-size: 18px; font-weight: 800; }

  .coalition-bar {
    display: flex;
    height: 18px;
    border: 1px solid var(--border-soft);
    margin-bottom: 14px;
  }
  .coalition-cell {
    flex: 1;
    height: 100%;
    background: var(--bg-2);
    border-right: 1px solid var(--bg);
  }
  .coalition-cell.filled { background: var(--accent); }
  .coalition-cell.win { background: var(--good); }
  .coalition-cell.tick { border-right: 2px solid var(--fg); }

  .coalition-presets { display: flex; gap: 8px; margin-bottom: 12px; }
  .coalition-chip-lbl {
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .coalition-chips { display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px; }
  .coalition-chip {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    gap: 10px;
    align-items: center;
    text-align: left;
    padding: 8px 11px;
    border: 1px solid var(--border-soft);
    background: var(--bg);
    cursor: pointer;
    font-family: inherit;
    color: var(--fg);
  }
  .coalition-chip:hover { border-color: var(--accent); }
  .coalition-chip.on { box-shadow: inset 0 0 0 2px var(--fg); }
  .coalition-chip-name { font-size: 11px; letter-spacing: 0.02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .coalition-chip-seats { font-size: 11px; font-weight: 700; }
  .coalition-chip-mark { font-size: 13px; width: 14px; text-align: center; }
  .coalition-chip-mark.good { color: var(--good); }
  .coalition-chip-mark.muted { color: var(--muted); }

  .coalition-note {
    margin: 0;
    font-size: 11px;
    line-height: 1.55;
    color: var(--fg-dim);
    border-left: 2px solid var(--border-soft);
    padding-left: 12px;
  }

  .roster-grid {
    display: grid;
    grid-template-columns: auto minmax(120px, 2fr) 0.7fr minmax(0, 1.6fr) minmax(0, 1.6fr);
    gap: 12px;
    align-items: center;
  }
  .roster-head {
    padding: 0 0 9px;
    border-bottom: 2px solid var(--border);
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .roster-row {
    padding: 11px 0;
    border-bottom: 1px solid var(--border-soft);
    font-size: 12px;
  }
  .roster-name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .roster-num { text-align: right; }
  .roster-num b { font-size: 14px; }
  .roster-meter { display: flex; align-items: center; gap: 8px; }
  .roster-val { font-size: 10px; width: 38px; text-align: right; }
  .roster-val.good { color: var(--good); font-weight: 700; }
  .roster-val.muted { color: var(--muted); }
  .roster-foot {
    margin: 12px 0 0;
    font-size: 11px;
    line-height: 1.5;
    color: var(--fg-dim);
  }

  @media (max-width: 720px) {
    .roster-grid { grid-template-columns: auto minmax(0, 1fr) auto; }
    .roster-head span:nth-child(4),
    .roster-head span:nth-child(5),
    .roster-row .roster-meter { display: none; }
  }
</style>
