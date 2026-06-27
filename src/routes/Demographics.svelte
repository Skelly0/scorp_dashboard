<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { pops, popsError, loadPops } from '../lib/stores/pops.js';
  import { population, populationError, loadPopulation } from '../lib/stores/population.js';
  import { demographics, demographicsError, loadDemographics } from '../lib/stores/demographics.js';
  import { loadHistory, avgSatHistory, populationDeltaHistory } from '../lib/stores/history.js';
  import { pageTitle } from '../lib/page-title.js';
  import { fmtInt, fmtPct, fmtNum } from '../lib/format.js';
  import {
    buildCensus, FACET_ORDER, TIERS,
    satTone, radTone, fillTone, facetTone, foodTone, housingTone, dispTone, toneVar,
  } from '../lib/census.js';
  import PageState from '../lib/components/PageState.svelte';
  import Band from '../lib/components/Band.svelte';
  import CBar from '../lib/components/CBar.svelte';
  import CensusKpiTile from '../lib/components/CensusKpiTile.svelte';
  import StabilityScatter from '../lib/components/StabilityScatter.svelte';
  import ClassDossier from '../lib/components/ClassDossier.svelte';
  import CompositionStrip from '../lib/components/CompositionStrip.svelte';
  import ClassDetail from '../lib/components/ClassDetail.svelte';

  const VIEW_KEY = 'scorp.census.view';
  const VIEWS = [
    ['register', 'Register'],
    ['quadrant', 'Quadrant'],
    ['conditions', 'Conditions'],
  ];

  let view = 'register';
  let openKpi = null;
  let openClass = null;
  let selected = null;
  let sort = 'pop';
  let tier = 'All';
  let comp = 'class';

  function readView() {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v && VIEWS.some(([k]) => k === v)) return v;
    } catch (e) {
      /* ignore */
    }
    return 'register';
  }
  function setView(v) {
    view = v;
    openKpi = null;
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch (e) {
      /* ignore */
    }
  }

  onMount(() => {
    pageTitle.set('Demographics');
    view = readView();
    loadAll();
  });

  function loadAll() {
    if ($meta?.synced_at) {
      loadPops($meta.synced_at);
      loadPopulation($meta.synced_at);
      loadDemographics($meta.synced_at);
      loadHistory($meta.synced_at);
    }
  }

  $: errorMsg = $demographicsError ?? $popsError ?? $populationError;
  $: ready = $pops && $population && $demographics;
  $: model = ready ? buildCensus($pops, $population, $demographics) : null;
  $: agg = model?.agg ?? null;
  $: classes = model?.classes ?? [];

  // Default the quadrant selection to the largest class; reset if it vanishes.
  $: if (model && (!selected || !classes.some((c) => c.name === selected))) {
    selected = [...classes].sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0))[0]?.name ?? null;
  }
  $: if (openClass && model && !classes.some((c) => c.name === openClass)) openClass = null;
  $: selectedClass = classes.find((c) => c.name === selected) ?? null;

  function selectClass(name) {
    selected = name;
  }
  function toggleKpi(key) {
    openKpi = openKpi === key ? null : key;
  }
  function toggleClass(name) {
    openClass = openClass === name ? null : name;
  }
  function rowKey(e, name) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleClass(name);
    }
  }
  function onWindowKey(e) {
    if (e.key === 'Escape') {
      if (openClass) openClass = null;
      else if (openKpi) openKpi = null;
    }
  }

  // ---- safe ratio helper ----
  const ratio = (n, d) => (Number.isFinite(n) && Number.isFinite(d) && d > 0 ? n / d : 0);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const colon = (v, d = 1) => (v == null || !Number.isFinite(v) ? '—' : `₡ ${v.toFixed(d)}`);

  // ---- KPI tiles ----
  $: kpis = agg
    ? [
        {
          key: 'pop',
          span: 4,
          label: 'Population',
          value: fmtInt(agg.pop),
          sub: `Residents · ${classes.length} classes`,
          tone: null,
          bar: { frac: ratio(agg.lowerPop, agg.pop), tone: 'good' },
          history: $populationDeltaHistory.length >= 2 ? $populationDeltaHistory : null,
          historyColor: 'var(--good)',
          detail: {
            rows: [
              { label: 'Births / turn', valueText: `+${fmtInt(agg.births)}`, tone: 'good', bar: { frac: ratio(agg.births, (agg.births ?? 0) + (agg.deaths ?? 0)), tone: 'good' } },
              { label: 'Deaths / turn', valueText: `−${fmtInt(agg.deaths)}`, tone: 'crit', bar: { frac: ratio(agg.deaths, (agg.births ?? 0) + (agg.deaths ?? 0)), tone: 'crit' } },
              { label: 'Natural increase', valueText: `+${fmtInt((agg.births ?? 0) - (agg.deaths ?? 0))}`, tone: 'good', bar: { frac: ratio((agg.births ?? 0) - (agg.deaths ?? 0), agg.births), tone: 'good' } },
              { label: 'Working class share', valueText: fmtPct(ratio(agg.lowerPop, agg.pop)), tone: 'warn', bar: { frac: ratio(agg.lowerPop, agg.pop), tone: 'warn' } },
            ],
            note: `Crude death rate ${fmtPct(agg.cdr, 1)} · growth ${fmtPct(agg.growth, 1)}. Lower-tier classes are ${fmtPct(ratio(agg.lowerPop, agg.pop))} of the colony.`,
          },
        },
        {
          key: 'sat',
          span: 2,
          label: 'Avg Satisfaction',
          value: fmtPct(agg.avgSat),
          sub: 'Pop-weighted',
          tone: satTone(agg.avgSat),
          bar: { frac: agg.avgSat ?? 0, tone: satTone(agg.avgSat) },
          history: $avgSatHistory.length >= 2 ? $avgSatHistory : null,
          historyColor: toneVar(satTone(agg.avgSat)),
          detail: {
            rows: agg.facetAverages.slice(0, 4).map((f) => ({
              label: f.label,
              valueText: fmtPct(f.value),
              tone: facetTone(f.value),
              bar: { frac: f.value ?? 0, tone: facetTone(f.value) },
            })),
            note: 'Lowest colony-wide drivers. Ownership and Situations drag every class down.',
          },
        },
        {
          key: 'rad',
          span: 2,
          label: 'Radicalisation',
          value: fmtPct(agg.avgRad),
          sub: 'Pop-weighted index',
          tone: radTone(agg.avgRad),
          bar: { frac: agg.avgRad ?? 0, tone: radTone(agg.avgRad) },
          detail: {
            rows: [...classes]
              .filter((c) => Number.isFinite(c.rad))
              .sort((a, b) => b.rad - a.rad)
              .slice(0, 4)
              .map((c) => ({ label: c.name, valueText: fmtPct(c.rad), tone: radTone(c.rad), bar: { frac: c.rad, tone: radTone(c.rad) } })),
            note: 'Most radicalised classes. The dispossessed owner-classes lead, then Industrial Workers en masse.',
          },
        },
        {
          key: 'fill',
          span: 2,
          label: 'Workforce Fill',
          value: fmtPct(agg.avgFill),
          sub: 'Supply / demand',
          tone: fillTone(agg.avgFill),
          bar: { frac: agg.avgFill ?? 0, tone: fillTone(agg.avgFill) },
          detail: {
            rows: [
              { label: 'Total demand', valueText: fmtInt(agg.totDemand), tone: null, bar: { frac: 1, tone: 'muted' } },
              { label: 'Total supply', valueText: fmtInt(agg.totSupply), tone: 'warn', bar: { frac: agg.avgFill ?? 0, tone: 'warn' } },
              { label: 'Labour shortfall', valueText: fmtInt(agg.totDemand - agg.totSupply), tone: 'crit', bar: { frac: ratio(agg.totDemand - agg.totSupply, agg.totDemand), tone: 'crit' } },
              { label: 'Unemployed (owners)', valueText: fmtInt(agg.totUnemp), tone: 'crit', bar: { frac: ratio(agg.totUnemp, agg.pop), tone: 'crit' } },
            ],
            note: `Every working sector is under-filled while ${fmtInt(agg.totUnemp)} owner-class residents sit idle — no labour demand for them.`,
          },
        },
        {
          key: 'house',
          span: 2,
          label: 'Housing Use',
          value: fmtPct(agg.housingRatio),
          sub: 'Of capacity',
          tone: housingTone(agg.housingRatio),
          bar: { frac: clamp01(ratio(agg.housingRatio, 1.3)), tone: housingTone(agg.housingRatio) },
          detail: {
            rows: [
              { label: 'Population', valueText: fmtInt(agg.pop), tone: null, bar: { frac: ratio(agg.pop, (agg.housingCap ?? 0) * 1.3), tone: 'muted' } },
              { label: 'Housing capacity', valueText: fmtInt(agg.housingCap), tone: null, bar: { frac: ratio(agg.housingCap, (agg.housingCap ?? 0) * 1.3), tone: 'muted' } },
              { label: 'Overcrowded by', valueText: `+${fmtInt((agg.pop ?? 0) - (agg.housingCap ?? 0))}`, tone: 'crit', bar: { frac: ratio((agg.pop ?? 0) - (agg.housingCap ?? 0), agg.housingCap), tone: 'crit' } },
              { label: 'Food security', valueText: fmtPct(agg.foodSecurity), tone: foodTone(agg.foodSecurity), bar: { frac: agg.foodSecurity ?? 0, tone: foodTone(agg.foodSecurity) } },
            ],
            note: `Habitats run ${fmtPct(agg.housingRatio)} full — ${fmtInt((agg.pop ?? 0) - (agg.housingCap ?? 0))} residents beyond rated capacity.`,
          },
        },
      ]
    : [];

  // ---- readout strip ----
  $: readout = agg
    ? [
        { label: 'Population', value: fmtInt(agg.pop), tone: null },
        { label: 'Avg Satisfaction', value: fmtPct(agg.avgSat), tone: satTone(agg.avgSat) },
        { label: 'Radicalisation', value: fmtPct(agg.avgRad), tone: radTone(agg.avgRad) },
        { label: 'Housing', value: fmtPct(agg.housingRatio), tone: housingTone(agg.housingRatio) },
        { label: 'Food Security', value: fmtPct(agg.foodSecurity), tone: foodTone(agg.foodSecurity) },
        { label: 'Workforce Fill', value: fmtPct(agg.avgFill), tone: fillTone(agg.avgFill) },
      ]
    : [];

  // ---- register list (tier filter + sort) ----
  function byAsc(key) {
    return (a, b) => {
      const x = a[key], y = b[key];
      if (x == null) return 1;
      if (y == null) return -1;
      return x - y;
    };
  }
  function byDesc(key) {
    return (a, b) => {
      const x = a[key], y = b[key];
      if (x == null) return 1;
      if (y == null) return -1;
      return y - x;
    };
  }
  const SORT_FNS = { pop: byDesc('pop'), sat: byAsc('sat'), rad: byDesc('rad'), fill: byAsc('fill'), vote: byDesc('vote') };
  const SORT_TABS = [
    ['pop', 'Population'],
    ['sat', 'Satisfaction'],
    ['rad', 'Radical'],
    ['fill', 'Workforce'],
    ['vote', 'Vote'],
  ];
  $: registerList = (() => {
    let list = classes.slice();
    if (tier !== 'All') list = list.filter((c) => c.tier === tier);
    list.sort(SORT_FNS[sort] ?? SORT_FNS.pop);
    return list;
  })();

  // Per-class "Standing" rows for the register expand.
  function standingRows(c) {
    return [
      { label: 'Disposable / cap', valueText: colon(c.disp), tone: null },
      { label: 'Wealth / cap', valueText: c.wealthpc == null ? '—' : `₡ ${fmtInt(c.wealthpc)}`, tone: null },
      { label: 'Expected SoL', valueText: c.expSol == null ? '—' : `${c.expSol} yrs`, tone: null },
      { label: 'Literacy', valueText: fmtPct(c.lit), tone: c.lit == null ? null : c.lit >= 0.3 ? 'good' : 'warn' },
      { label: 'Organisation', valueText: fmtPct(c.org), tone: c.org == null ? null : c.org >= 0.5 ? 'crit' : 'muted' },
      { label: 'Social privilege', valueText: c.priv == null ? '—' : `${c.priv}/10`, tone: null },
    ];
  }
  function workforceSummary(c) {
    if (Number.isFinite(c.demand) && c.demand > 0) {
      return {
        label: 'Jobs filled',
        tone: fillTone(c.fill),
        valueText: `${fmtInt(c.supply)} / ${fmtInt(c.demand)}`,
        frac: c.fill ?? 0,
        note: `Sector under-staffed by ${fmtInt((c.demand ?? 0) - (c.supply ?? 0))} (${fmtPct(1 - (c.fill ?? 0))} short of demand).`,
      };
    }
    return {
      label: 'Unemployed',
      tone: 'crit',
      valueText: fmtInt(c.unemp),
      frac: 1,
      note: `No labour demand for this owner-class — ${fmtInt(c.unemp)} residents without work.`,
    };
  }

  // ---- conditions ----
  $: gauges = agg
    ? [
        {
          label: 'Housing Occupancy',
          value: fmtPct(agg.housingRatio),
          tone: housingTone(agg.housingRatio),
          frac: clamp01(ratio(agg.housingRatio, 1.3)),
          note: `Capacity ${fmtInt(agg.housingCap)} vs ${fmtInt(agg.pop)} residents — ${fmtInt((agg.pop ?? 0) - (agg.housingCap ?? 0))} over. Growth multiplier suppressed to ${agg.growthMult == null ? '—' : agg.growthMult.toFixed(2) + '×'}; overcrowding exponent ${agg.overcrowdingExp == null ? '—' : agg.overcrowdingExp.toFixed(2)}.`,
        },
        {
          label: 'Food Security',
          value: fmtPct(agg.foodSecurity),
          tone: foodTone(agg.foodSecurity),
          frac: agg.foodSecurity ?? 0,
          note: `Calories cover ${fmtPct(agg.foodSecurity)} of need at ${fmtNum(agg.foodPerCap, 3)} per-capita food.`,
        },
        {
          label: 'Food Variety',
          value: fmtPct(agg.foodVariety, 1),
          tone: 'crit',
          frac: agg.foodVariety ?? 0,
          note: `A near-monotonous diet — variety index ${fmtNum(agg.foodVariety, 3)}. A standing drag on every class’s food satisfaction.`,
        },
      ]
    : [];

  $: labour = classes
    .filter((c) => Number.isFinite(c.demand) && c.demand > 0)
    .slice()
    .sort((a, b) => (a.fill ?? 0) - (b.fill ?? 0));

  $: maxSol = classes.reduce((m, c) => Math.max(m, Number.isFinite(c.sol) ? c.sol : 0), 0) || 1;
  $: solRows = [...classes]
    .filter((c) => Number.isFinite(c.sol))
    .sort((a, b) => b.sol - a.sol);

  // ---- composition tabs ----
  const COMP_TABS = [
    ['class', 'By class'],
    ['sat', 'By satisfaction'],
    ['rad', 'By radicalisation'],
  ];
</script>

<svelte:window on:keydown={onWindowKey} />

<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1660px]">
  <PageState
    label="Demographics"
    page={['demographics', 'pops', 'population']}
    error={errorMsg}
    loading={!ready}
    loadingText="Reading vital signs…"
    retry={loadAll}
  >
    <!-- readout strip + view tabs -->
    <div class="census-top">
      <div class="readout" role="group" aria-label="Colony readout">
        {#each readout as r}
          <div class="readout-cell">
            <span class="readout-label">{r.label}</span>
            <span class="readout-value" style={r.tone ? `color:${toneVar(r.tone)}` : ''}>{r.value}</span>
          </div>
        {/each}
      </div>
      <div class="layer-tabs view-tabs" role="group" aria-label="Census view">
        {#each VIEWS as [key, label]}
          <button type="button" aria-pressed={view === key} on:click={() => setView(key)}>{label}</button>
        {/each}
      </div>
    </div>

    {#if view === 'register'}
      <!-- ============ REGISTER ============ -->
      <Band num="01" title="Colony Indicators" meta="click a tile to drill down" />
      <div class="g12">
        {#each kpis as t (t.key)}
          <div class="span-{t.span}">
            <CensusKpiTile tile={t} open={openKpi === t.key} on:toggle={() => toggleKpi(t.key)} />
          </div>
        {/each}
      </div>

      <Band num="02" title="Class Register" meta={`${classes.length} classes · click a row`} />
      <div class="filters">
        <div class="filter-group">
          <span class="filter-label">Tier</span>
          <div class="layer-tabs">
            {#each TIERS as s}
              <button type="button" aria-pressed={tier === s} on:click={() => (tier = s)}>{s}</button>
            {/each}
          </div>
        </div>
        <div class="filter-group">
          <span class="filter-label">Sort by</span>
          <div class="layer-tabs">
            {#each SORT_TABS as [key, label]}
              <button type="button" aria-pressed={sort === key} on:click={() => (sort = key)}>{label}</button>
            {/each}
          </div>
        </div>
      </div>

      <div class="s-card reg-card">
        <div class="reg-head reg-cols">
          <span></span><span>Class</span><span class="ralign">Population</span>
          <span>Satisfaction</span><span class="reg-collapse">Radicalisation</span>
          <span class="reg-collapse">Workforce</span><span class="ralign reg-collapse">Vote</span>
        </div>
        {#each registerList as c (c.name)}
          {@const open = openClass === c.name}
          <div class="reg-rowwrap">
            <div
              class="reg-row reg-cols"
              class:open
              role="button"
              tabindex="0"
              aria-pressed={open}
              on:click={() => toggleClass(c.name)}
              on:keydown={(e) => rowKey(e, c.name)}
            >
              <span class="reg-swatch" style="background:{c.color}"></span>
              <div class="reg-name-cell">
                <div class="reg-name">{c.name}</div>
                <div class="reg-name-sub">{c.tier ?? '—'} · {open ? 'collapse' : 'expand'}</div>
              </div>
              <div class="ralign">
                <div class="reg-pop">{fmtInt(c.pop)}</div>
                <div class="reg-share">{fmtPct(c.share, 1)}</div>
              </div>
              <div class="reg-metric">
                <CBar value={c.sat} tone={satTone(c.sat)} />
                <span class="reg-metric-val" style="color:{toneVar(satTone(c.sat))}">{fmtPct(c.sat)}</span>
              </div>
              <div class="reg-metric reg-collapse">
                <CBar value={c.rad} tone={radTone(c.rad)} />
                <span class="reg-metric-val" style="color:{toneVar(radTone(c.rad))}">{fmtPct(c.rad)}</span>
              </div>
              <div class="reg-metric reg-collapse">
                <CBar value={c.fill} tone={fillTone(c.fill)} />
                <span class="reg-metric-val" style="color:{toneVar(fillTone(c.fill))}">{fmtPct(c.fill)}</span>
              </div>
              <span class="ralign reg-collapse reg-vote">{fmtPct(c.vote, 1)}</span>
            </div>

            {#if open}
              {@const w = workforceSummary(c)}
              <div class="reg-expand">
                <div class="reg-summary">
                  <div>
                    <div class="reg-sub">Satisfaction Drivers · 11 facets</div>
                    <div class="facet-grid">
                      {#each FACET_ORDER as [key, label]}
                        {@const v = c.facets?.[key]}
                        <div class="facet">
                          <span class="facet-label">{label}</span>
                          <span class="facet-val" style="color:{toneVar(facetTone(v))}">{fmtPct(v)}</span>
                          <div class="facet-bar"><CBar value={v} tone={facetTone(v)} /></div>
                        </div>
                      {/each}
                    </div>
                  </div>
                  <div class="reg-standing">
                    <div>
                      <div class="reg-sub">Standing</div>
                      <div class="standing-grid">
                        {#each standingRows(c) as st}
                          <span class="standing-label">{st.label}</span>
                          <span class="standing-val" style={st.tone ? `color:${toneVar(st.tone)}` : ''}>{st.valueText}</span>
                        {/each}
                      </div>
                    </div>
                    <div>
                      <div class="reg-sub">Workforce</div>
                      <div class="work-head">
                        <span>{w.label}</span>
                        <span style="color:{toneVar(w.tone)}; font-weight:700;">{w.valueText}</span>
                      </div>
                      <CBar value={w.frac} tone={w.tone} />
                      <div class="work-note">{w.note}</div>
                    </div>
                  </div>
                </div>

                <div class="reg-fullrec">Full record</div>
                <ClassDetail cls={c.raw} populationProfile={c.profile} showSatisfactionSources={false} />
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else if view === 'quadrant'}
      <!-- ============ QUADRANT ============ -->
      <div class="g12 quad-grid">
        <div class="span-7">
          <Band num="01" title="Stability Quadrant" meta="click a class" />
          <div class="s-card scatter-card">
            <StabilityScatter {classes} {selected} on:select={(e) => selectClass(e.detail)} />
            <div class="scatter-legend">
              <span>Bubble size = population</span>
              <span>Shaded zone = flashpoint (low satisfaction · high radicalisation)</span>
            </div>
          </div>
        </div>
        <div class="span-5">
          <Band num="02" title="Class Dossier" />
          <ClassDossier cls={selectedClass} />
        </div>
        <div class="span-12">
          <div class="sec-head">
            <span class="sec-num">03</span>
            <h2 class="sec-title">Population Composition</h2>
            <span class="sec-rule"></span>
            <div class="layer-tabs comp-tabs">
              {#each COMP_TABS as [key, label]}
                <button type="button" aria-pressed={comp === key} on:click={() => (comp = key)}>{label}</button>
              {/each}
            </div>
          </div>
          <div class="s-card s-card-pad">
            <CompositionStrip {classes} totalPop={agg?.pop ?? 0} mode={comp} on:select={(e) => selectClass(e.detail)} />
          </div>
        </div>
      </div>
    {:else}
      <!-- ============ CONDITIONS ============ -->
      <div class="g12 cond-grid">
        <div class="span-6">
          <Band num="01" title="Housing & Sustenance" />
          <div class="gauge-stack">
            {#each gauges as g}
              <div class="s-card gauge">
                <div class="gauge-head">
                  <span class="gauge-label">{g.label}</span>
                  <span class="gauge-value" style={g.tone ? `color:${toneVar(g.tone)}` : ''}>{g.value}</span>
                </div>
                <div class="gauge-bar"><CBar value={g.frac} tone={g.tone} height={9} /></div>
                <div class="gauge-note">{g.note}</div>
              </div>
            {/each}
          </div>
        </div>

        <div class="span-6">
          <Band num="02" title="Labour Market" meta="demand vs supply" />
          <div class="s-card labour-card">
            {#if agg?.mismatch}
              <div class="labour-mismatch" role="status" aria-label="Skill mismatch">
                <strong>Skill mismatch</strong>
                <span class="labour-mismatch-detail">
                  short {fmtInt(agg.shortage)}{#if agg.topShortage.length} · {agg.topShortage.map((t) => `${t.name} −${t.count.toLocaleString()}`).join(', ')}{/if}
                  · idle {fmtInt(agg.totUnemp)}{#if agg.topUnemployed.length} · {agg.topUnemployed.map((t) => `${t.name} +${t.count.toLocaleString()}`).join(', ')}{/if}
                </span>
              </div>
            {/if}
            {#each labour as l}
              <div class="labour-row">
                <div class="labour-row-head">
                  <span class="labour-name"><span class="labour-dot" style="background:{l.color}"></span>{l.name}</span>
                  <span class="labour-status" style="color:{toneVar(fillTone(l.fill))}">{fmtPct(l.fill)} filled</span>
                </div>
                <CBar value={l.fill} tone={fillTone(l.fill)} />
                <div class="labour-foot">
                  <span>supply {fmtInt(l.supply)}</span><span>demand {fmtInt(l.demand)}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <div class="span-12">
          <Band num="03" title="Standard of Living by Class" meta="expected SoL · disposable income" />
          <div class="s-card sol-card">
            {#each solRows as s}
              <div class="sol-row">
                <span class="sol-name"><span class="sol-dot" style="background:{s.color}"></span><span class="sol-name-text">{s.name}</span></span>
                <div class="sol-bar"><CBar value={ratio(s.sol, maxSol)} color={s.color} /></div>
                <span class="sol-val">{s.sol == null ? '—' : s.sol.toFixed(1)}</span>
                <span class="sol-disp" style="color:{toneVar(dispTone(s.disp))}">{colon(s.disp)}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </PageState>
</section>

<style>
  /* ---- readout strip + view tabs ---- */
  .census-top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 4px;
  }
  .readout {
    display: flex;
    flex-wrap: wrap;
    border: 1px solid var(--border-soft);
  }
  .readout-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 7px 16px;
    border-right: 1px solid var(--border-soft);
  }
  .readout-label {
    font-size: 8.5px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .readout-value {
    font-size: 14px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .view-tabs button {
    padding: 8px 16px;
    font-size: 10px;
    letter-spacing: 0.2em;
  }

  /* ---- 12-col grid + responsive spans (mirrors the mockup breakpoints) ---- */
  .g12 {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 12px;
  }
  .quad-grid,
  .cond-grid {
    gap: 18px;
  }
  .span-2 { grid-column: span 2; min-width: 0; }
  .span-4 { grid-column: span 4; min-width: 0; }
  .span-5 { grid-column: span 5; min-width: 0; }
  .span-6 { grid-column: span 6; min-width: 0; }
  .span-7 { grid-column: span 7; min-width: 0; }
  .span-12 { grid-column: span 12; min-width: 0; }
  @media (max-width: 1100px) {
    .span-7, .span-5 { grid-column: span 12; }
  }
  @media (max-width: 900px) {
    .span-4, .span-6 { grid-column: span 6; }
  }
  @media (max-width: 560px) {
    .span-2, .span-4, .span-5, .span-6, .span-7 { grid-column: span 12; }
  }

  /* ---- filters ---- */
  .filters {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 12px;
    align-items: flex-end;
  }
  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .filter-label {
    font-size: 8.5px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .filters .layer-tabs {
    flex-wrap: wrap;
  }
  .filters .layer-tabs button {
    font-size: 9.5px;
    padding: 7px 12px;
    letter-spacing: 0.16em;
  }

  /* ---- class register ---- */
  .reg-card {
    overflow: hidden;
  }
  .reg-cols {
    display: grid;
    grid-template-columns: 18px 2fr 1.2fr 1.4fr 1.4fr 1.2fr 0.7fr;
    gap: 12px;
    align-items: center;
  }
  .reg-head {
    padding: 9px 14px;
    border-bottom: 2px solid var(--border);
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .ralign { text-align: right; }
  .reg-rowwrap { border-bottom: 1px solid var(--border-soft); }
  .reg-row {
    padding: 11px 14px;
    cursor: pointer;
    font-size: 12px;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    color: inherit;
    font-family: inherit;
  }
  .reg-row:hover { background: var(--accent-soft); }
  .reg-row.open { background: var(--accent-soft); }
  .reg-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .reg-swatch { width: 8px; height: 26px; display: inline-block; }
  .reg-name-cell { min-width: 0; }
  .reg-name {
    font-weight: 700;
    letter-spacing: 0.03em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .reg-name-sub {
    font-size: 8.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
    margin-top: 1px;
  }
  .reg-pop { font-weight: 700; font-variant-numeric: tabular-nums; }
  .reg-share { font-size: 9px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .reg-metric { display: flex; align-items: center; gap: 8px; }
  .reg-metric > :global(.cbar) { flex: 1; }
  .reg-metric-val {
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    width: 34px;
    text-align: right;
  }
  .reg-vote { font-variant-numeric: tabular-nums; color: var(--fg-dim); }

  @media (max-width: 720px) {
    .reg-cols { grid-template-columns: 14px 1.7fr 1fr 1.3fr; }
    .reg-collapse { display: none; }
  }

  /* ---- register expand ---- */
  .reg-expand {
    padding: 16px 14px;
    background: var(--bg-2);
    border-top: 1px dashed var(--border-soft);
  }
  .reg-summary {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 22px;
  }
  @media (max-width: 760px) {
    .reg-summary { grid-template-columns: 1fr; }
  }
  .reg-sub {
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 10px;
  }
  .facet-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7px 18px;
  }
  @media (max-width: 480px) {
    .facet-grid { grid-template-columns: 1fr; }
  }
  .facet {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 8px;
    align-items: baseline;
  }
  .facet-label {
    font-size: 9.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-dim);
  }
  .facet-val { font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .facet-bar { grid-column: 1 / -1; }
  .reg-standing { display: flex; flex-direction: column; gap: 14px; }
  .standing-grid {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px 12px;
    font-size: 11px;
  }
  .standing-label {
    color: var(--fg-dim);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 9.5px;
  }
  .standing-val { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
  .work-head {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--fg-dim);
    margin-bottom: 5px;
    font-variant-numeric: tabular-nums;
  }
  .work-note { font-size: 9.5px; color: var(--muted); margin-top: 6px; line-height: 1.5; }
  .reg-fullrec {
    margin: 18px 0 10px;
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    border-top: 1px dashed var(--border-soft);
    padding-top: 12px;
  }

  /* ---- quadrant ---- */
  .scatter-card { padding: 14px; }
  .scatter-legend {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    margin-top: 10px;
    font-size: 9px;
    letter-spacing: 0.06em;
    color: var(--muted);
    text-transform: uppercase;
  }
  .sec-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 8px 0 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-soft);
  }
  .sec-num { font-size: 10px; color: var(--muted); letter-spacing: 0.2em; }
  .sec-title {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    font-weight: 700;
  }
  .sec-rule { flex: 1; height: 1px; background: var(--border-soft); }
  .comp-tabs button { font-size: 9px; padding: 6px 11px; letter-spacing: 0.14em; }

  /* ---- conditions ---- */
  .gauge-stack { display: flex; flex-direction: column; gap: 12px; }
  .gauge { padding: 15px 16px; }
  .gauge-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 4px;
  }
  .gauge-label { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
  .gauge-value { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .gauge-bar { margin: 8px 0 7px; }
  .gauge-note { font-size: 10px; color: var(--fg-dim); line-height: 1.5; }

  .labour-card { padding: 6px 16px; }
  .labour-mismatch {
    padding: 10px 0;
    border-bottom: 1px dashed var(--border-soft);
    font-size: 10px;
    color: var(--warn);
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .labour-mismatch-detail { color: var(--muted); letter-spacing: 0.02em; }
  .labour-row { padding: 10px 0; border-bottom: 1px dashed var(--border-soft); }
  .labour-row:last-child { border-bottom: none; }
  .labour-row-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 6px;
  }
  .labour-name {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .labour-dot { width: 8px; height: 8px; display: inline-block; flex: 0 0 8px; }
  .labour-status { font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .labour-foot {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: var(--muted);
    margin-top: 4px;
    font-variant-numeric: tabular-nums;
  }

  .sol-card { padding: 6px 16px; }
  .sol-row {
    display: grid;
    grid-template-columns: 150px 1fr 78px 64px;
    gap: 14px;
    align-items: center;
    padding: 9px 0;
    border-bottom: 1px dashed var(--border-soft);
    font-size: 11px;
  }
  .sol-row:last-child { border-bottom: none; }
  .sol-name {
    text-transform: uppercase;
    letter-spacing: 0.04em;
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .sol-dot { width: 8px; height: 8px; display: inline-block; flex: 0 0 8px; }
  .sol-name-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sol-val { text-align: right; font-variant-numeric: tabular-nums; color: var(--fg-dim); }
  .sol-disp { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
  @media (max-width: 560px) {
    .sol-row { grid-template-columns: 110px 1fr 54px; }
    .sol-val { display: none; }
  }
</style>
