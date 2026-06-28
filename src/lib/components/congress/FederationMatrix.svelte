<script>
  // Federation × party seat matrix: the transpose-readable view of the
  // delegation data (per-party, which federations they draw seats from). Click a
  // party column or federation row to focus; an inspector panel summarises the
  // selection. Pure congress.json data — no fabricated bloc taxonomy.
  import { fmtInt, fmtPct } from '../../format.js';
  import { abbrevName } from '../../short-name.js';

  /** @type {Array<{name: string, seats: number, parties: Array<{name: string, seats: number}>}>} */
  export let delegations = [];
  /** @type {Array<{name: string, color: string, seats: number}>} seated parties, column order */
  export let partyColumns = [];

  let focus = null; // { type: 'party' | 'fed', key: string } | null

  function toggleFocus(type, key) {
    focus = focus && focus.type === type && focus.key === key ? null : { type, key };
  }

  $: cols = partyColumns;
  $: gridTemplate = `minmax(140px, 1.6fr) repeat(${cols.length}, minmax(52px, 1fr)) 44px`;

  function seatsIn(deleg, partyName) {
    const hit = (deleg.parties ?? []).find((p) => p.name === partyName);
    return hit ? Math.max(0, Math.round(hit.seats ?? 0)) : 0;
  }

  function colorFor(name) {
    return cols.find((c) => c.name === name)?.color ?? 'var(--accent)';
  }

  // ---- inspector panel rows ----
  $: panel = (() => {
    if (focus?.type === 'party') {
      const col = cols.find((c) => c.name === focus.key);
      const rows = delegations
        .map((d) => ({ label: d.name, value: seatsIn(d, focus.key) }))
        .filter((r) => r.value > 0);
      const max = Math.max(1, ...rows.map((r) => r.value));
      return {
        kicker: 'Party',
        title: focus.key,
        subtitle: `${fmtInt(col?.seats ?? 0)} seats · draws from ${rows.length} of ${delegations.length} federations`,
        color: col?.color ?? 'var(--accent)',
        rows: rows.map((r) => ({ ...r, frac: r.value / max, color: col?.color ?? 'var(--accent)' })),
      };
    }
    if (focus?.type === 'fed') {
      const d = delegations.find((x) => x.name === focus.key);
      const total = d?.seats ?? 0;
      const rows = (d?.parties ?? [])
        .map((p) => ({ label: p.name, value: Math.max(0, Math.round(p.seats ?? 0)) }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value);
      const max = Math.max(1, total);
      return {
        kicker: 'Federation',
        title: focus.key,
        subtitle: `${fmtInt(total)} seats · ${rows.length} parties`,
        color: 'var(--accent)',
        rows: rows.map((r) => ({ ...r, frac: r.value / max, color: colorFor(r.label) })),
      };
    }
    // Default overview: each party's federation footprint (breadth of support).
    const rows = cols
      .map((c) => ({
        label: c.name,
        value: delegations.filter((d) => seatsIn(d, c.name) > 0).length,
        color: c.color,
      }))
      .sort((a, b) => b.value - a.value);
    const max = Math.max(1, delegations.length);
    return {
      kicker: 'Overview',
      title: 'Federation footprint',
      subtitle: 'Click a federation row or party column to inspect',
      color: 'var(--accent)',
      rows: rows.map((r) => ({ ...r, frac: r.value / max, value: `${r.value}/${delegations.length}` })),
    };
  })();
</script>

<div class="fed-matrix-layout">
  <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
  <div class="fed-matrix-scroll" tabindex="0" role="region" aria-label="Federation by party seat matrix">
    <div class="fed-matrix" style="grid-template-columns: {gridTemplate};">
      <div class="fmx-corner"></div>
      {#each cols as c (c.name)}
        <button
          type="button"
          class="fmx-colhead"
          class:dim={focus?.type === 'party' && focus.key !== c.name}
          aria-pressed={focus?.type === 'party' && focus.key === c.name}
          style="--col-color: {c.color}"
          title={c.name}
          on:click={() => toggleFocus('party', c.name)}
        >
          <span class="fmx-code">{abbrevName(c.name)}</span>
          <span class="fmx-coltot tnum">{fmtInt(c.seats)}</span>
        </button>
      {/each}
      <div class="fmx-tothead">TOT</div>

      {#each delegations as d (d.name)}
        <button
          type="button"
          class="fmx-rowhead"
          class:dim={focus?.type === 'fed' && focus.key !== d.name}
          aria-pressed={focus?.type === 'fed' && focus.key === d.name}
          title={d.name}
          on:click={() => toggleFocus('fed', d.name)}
        >{d.name}</button>
        {#each cols as c (c.name)}
          {@const v = seatsIn(d, c.name)}
          {@const dim = focus?.type === 'party' && focus.key !== c.name}
          <div
            class="fmx-cell"
            class:empty={v === 0}
            class:dim={dim}
            style={v > 0 ? `background: color-mix(in srgb, ${c.color} ${v >= 2 ? 42 : 26}%, var(--bg-2));` : ''}
            title="{d.name} × {c.name} = {v}"
          >{v > 0 ? v : '·'}</div>
        {/each}
        <div class="fmx-rowtot tnum">{fmtInt(d.seats)}</div>
      {/each}
    </div>
  </div>

  <div class="s-card s-card-pad fed-panel">
    <div class="fed-panel-kicker">{panel.kicker}</div>
    <div class="fed-panel-title">{panel.title}</div>
    <div class="fed-panel-sub">{panel.subtitle}</div>
    <div class="fed-panel-rows">
      {#each panel.rows as row}
        <div class="fed-panel-row">
          <span class="faction-bar" style="--bar-color: {row.color}"></span>
          <div class="fed-panel-rowmain">
            <div class="fed-panel-rowlabel">{row.label}</div>
            <span class="bar"><span style="width: {(row.frac * 100).toFixed(1)}%; background: {row.color}"></span></span>
          </div>
          <span class="fed-panel-rowval tnum">{row.value}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .fed-matrix-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }
  @media (min-width: 1100px) {
    .fed-matrix-layout {
      grid-template-columns: minmax(0, 1.9fr) minmax(240px, 1fr);
      align-items: start;
    }
  }
  .fed-matrix-scroll {
    overflow-x: auto;
    border: 2px solid var(--border);
    background: var(--bg);
    padding: 12px;
  }
  .fed-matrix {
    display: grid;
    gap: 4px;
    min-width: 460px;
  }
  .fmx-corner {
    min-height: 30px;
  }
  .fmx-colhead {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px 2px;
    background: transparent;
    border: none;
    border-bottom: 2px solid var(--col-color, var(--border));
    color: var(--fg);
    cursor: pointer;
    font-family: inherit;
  }
  .fmx-colhead:hover { color: var(--accent); }
  .fmx-code { font-size: 10px; font-weight: 800; letter-spacing: 0.04em; }
  .fmx-coltot { font-size: 13px; font-weight: 800; }
  .fmx-tothead,
  .fmx-rowtot {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    letter-spacing: 0.1em;
    color: var(--muted);
  }
  .fmx-rowtot {
    font-size: 12px;
    font-weight: 800;
    color: var(--fg-dim);
  }
  .fmx-rowhead {
    display: flex;
    align-items: center;
    text-align: left;
    padding: 4px 6px 4px 0;
    background: transparent;
    border: none;
    color: var(--fg);
    cursor: pointer;
    font-family: inherit;
    font-size: 10px;
    letter-spacing: 0.02em;
    line-height: 1.15;
  }
  .fmx-rowhead:hover { color: var(--accent); }
  .fmx-cell {
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-soft);
    font-size: 13px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--fg);
  }
  .fmx-cell.empty {
    color: var(--muted);
    font-weight: 400;
    background: var(--bg-2);
  }
  .fmx-cell.dim,
  .fmx-colhead.dim,
  .fmx-rowhead.dim {
    opacity: 0.32;
  }

  .fed-panel-kicker {
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .fed-panel-title {
    font-size: 16px;
    font-weight: 800;
    margin-top: 2px;
  }
  .fed-panel-sub {
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 4px 0 14px;
  }
  .fed-panel-rows {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .fed-panel-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 9px;
    align-items: center;
  }
  .fed-panel-rowmain { min-width: 0; }
  .fed-panel-rowlabel {
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
  }
  .fed-panel-rowval {
    font-size: 13px;
    font-weight: 800;
  }
</style>
