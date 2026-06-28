<script>
  // Parties "Roster" tab: party dossier cards (vote / establishment / supporters,
  // MAD index, top classes, worldview radar) + a proportional vote-share bar +
  // the class → party support Sankey. All data-backed by parties.json / pops.json.
  import Band from '../Band.svelte';
  import RadarChart from '../RadarChart.svelte';
  import MadIndex from '../MadIndex.svelte';
  import VoteShareBar from './VoteShareBar.svelte';
  import SupportSankey from './SupportSankey.svelte';
  import { WORLDVIEW_AXES as AXES, AXIS_HIGH_LABELS } from '../../worldview.js';
  import { fmtInt, fmtPct } from '../../format.js';

  /** @type {Array<{name, color, leanLabel, stance, vote_share, establishment, mad_index, supporters, topClasses}>} */
  export let parties = [];
  /** @type {{classes: string[], parties: string[], values: number[][]} | null} */
  export let popMatrix = null;

  $: ranked = [...parties].sort((a, b) => (b.vote_share ?? 0) - (a.vote_share ?? 0));
  $: electorate = parties.reduce((a, p) => a + (p.supporters ?? 0), 0);

  // Sankey columns reuse each party's resolved accent.
  $: colorOf = new Map(parties.map((p) => [p.name, p.color]));
  $: sankeyParties =
    popMatrix?.parties?.map((name) => ({ name, color: colorOf.get(name) ?? 'var(--accent)' })) ?? [];
</script>

<Band num="01" title="Founded Parties" meta="{parties.length} parties" />
<div class="roster-cards">
  {#each ranked as p (p.name)}
    <div class="s-card barred" style="--bar-color: {p.color}">
      <div class="s-card-header">
        <h3>{p.name}</h3>
        <span class="party-lean" title="Ideological lean">
          <span class="party-lean-swatch" aria-hidden="true"></span>
          {p.leanLabel}
        </span>
      </div>
      <div class="s-card-pad party-card-body">
        <div class="flex flex-col gap-2">
          <div class="party-stat-grid">
            <div>
              <div class="text-muted text-[9px] uppercase tracking-widest">Vote</div>
              <div class="font-extrabold text-base tnum">{fmtPct(p.vote_share)}</div>
            </div>
            <div>
              <div class="text-muted text-[9px] uppercase tracking-widest">Establishment</div>
              <div class="font-extrabold text-base tnum">{fmtPct(p.establishment)}</div>
            </div>
            <div>
              <div class="text-muted text-[9px] uppercase tracking-widest">Supporters</div>
              <div class="font-extrabold text-base tnum">{fmtInt(p.supporters)}</div>
            </div>
          </div>
          <MadIndex value={p.mad_index} />

          {#if p.topClasses?.length}
            <div class="party-support">
              <div class="party-support-head"><span>Top Classes</span></div>
              <ul>
                {#each p.topClasses as row}
                  <li>
                    <span>{row.className}</span>
                    <span class="text-muted tnum">{fmtInt(row.capturedPop)}</span>
                    <span class="text-muted tnum">{fmtPct(row.classCapturePct)} class</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
        <div class="party-radar-frame">
          <RadarChart
            axes={AXES.map((a) => ({ label: AXIS_HIGH_LABELS[a], value: p.stance?.[a] ?? 0 }))}
            size={140}
            accent={p.color}
          />
        </div>
      </div>
    </div>
  {/each}
</div>

<Band num="02" title="Vote Share" meta="Electorate {fmtInt(electorate)}" />
<div class="s-card s-card-pad">
  <VoteShareBar parties={ranked} />
</div>

{#if popMatrix?.values?.length}
  <Band num="03" title="Support Flow" meta="Class → Party · hover to isolate" />
  <div class="s-card s-card-pad">
    <SupportSankey classes={popMatrix.classes} parties={sankeyParties} values={popMatrix.values} />
  </div>
{/if}

<style>
  .roster-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 460px), 1fr));
    gap: 16px;
  }
  .party-lean {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
    white-space: nowrap;
  }
  .party-lean-swatch {
    display: inline-block;
    width: 4px;
    height: 11px;
    background: var(--bar-color, var(--accent));
  }
  .party-card-body { display: grid; grid-template-columns: minmax(0, 1fr) 150px; gap: 14px; }
  .party-stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 10px; }
  .party-support { margin-top: 4px; border-top: 1px dashed var(--border-soft); padding-top: 8px; }
  .party-support-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .party-support ul { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 3px; }
  .party-support li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 8px;
    align-items: baseline;
    font-size: 11px;
  }
  .party-support li span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .party-radar-frame { display: grid; }
  .party-radar-frame :global(svg) { max-width: min(150px, 45vw); height: auto; justify-self: center; }

  @media (max-width: 520px) {
    .party-card-body { grid-template-columns: 1fr; }
    .party-stat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .party-support li { grid-template-columns: minmax(0, 1fr) auto; }
    .party-support li span:last-child { grid-column: 1 / -1; }
  }
</style>
