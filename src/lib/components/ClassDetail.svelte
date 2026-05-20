<script>
  import Bar from './Bar.svelte';
  import RadarChart from './RadarChart.svelte';
  import Tag from './Tag.svelte';
  import { WORLDVIEW_AXES as AXES, AXIS_HIGH_LABELS } from '../worldview.js';

  /** @type {{
   *   name: string,
   *   standard_of_living: number|null,
   *   expected_sol: number|null,
   *   social_privileges: number|null,
   *   income: object|null,
   *   wealth: object|null,
   *   additional_income: object|null,
   *   consumption: object|null,
   *   status: object|null,
   *   workforce: object|null,
   *   satisfaction: number|null,
   *   satisfaction_breakdown: object|null,
   * }} */
  export let cls;
  /** @type {{name: string, tier: string|null, pop: number|null, share: number|null, political_weight: number|null, worldview: Record<string, number|null>}|null} */
  export let populationProfile = null;

  // Two-column split of the 11 satisfaction sources. Order MUST match
  // extractors/pops.py:SATISFACTION_SOURCES — a row in PopsimSatisfactionFullTable
  // is laid out left-to-right in this same sequence.
  const SAT_LEFT = [
    ['Food', 'food'],
    ['Housing', 'housing'],
    ['Employment', 'employment'],
    ['Ownership', 'ownership'],
    ['Services', 'services'],
    ['Faith', 'faith'],
  ];
  const SAT_RIGHT = [
    ['Entertainment', 'entertainment'],
    ['Tax', 'tax'],
    ['Wages', 'wages'],
    ['Safety', 'safety'],
    ['Situations', 'situations'],
  ];
  const CONSUMPTION_RESOURCES = [
    ['Water', 'water'],
    ['Energy', 'energy'],
    ['Materials', 'materials'],
  ];

  $: critRad = cls?.status?.radicalisation > 0.5;
  $: worldviewAxes = AXES.map((a) => ({
    label: AXIS_HIGH_LABELS[a],
    value: populationProfile?.worldview?.[a] ?? null,
  }));

  function num(v, decimals = 2) {
    return v == null ? '—' : v.toFixed(decimals);
  }
  function pct(v, decimals = 0) {
    return v == null ? '—' : (v * 100).toFixed(decimals) + '%';
  }
  function int(v) {
    return v == null ? '—' : Math.round(v).toLocaleString();
  }
  function whole(v) {
    return v == null ? '—' : v.toFixed(0);
  }
  function hours(v) {
    if (v == null) return '—';
    const display = Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1);
    return `${display} / wk`;
  }
</script>

<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
  <div class="s-card">
    <div class="s-card-header"><h3>Population Profile</h3></div>
    <div class="s-card-pad">
      <dl class="kv">
        <dt>Tier</dt><dd>{populationProfile?.tier ?? '—'}</dd>
        <dt>Population</dt><dd>{int(populationProfile?.pop)}</dd>
        <dt>Pop Share</dt><dd>{pct(populationProfile?.share, 1)}</dd>
        <dt>Political Weight</dt><dd>{num(populationProfile?.political_weight, 1)}</dd>
        <dt>Votes</dt><dd>{int(cls.status?.votes_total)}</dd>
      </dl>
    </div>
  </div>

  <div class="s-card">
    <div class="s-card-header"><h3>Class Pressure</h3></div>
    <div class="s-card-pad">
      <Bar label="Pop Share" value={populationProfile?.share} max={0.25} format="pct" />
      <Bar label="Vote Share" value={cls.status?.vote_share} max={0.25} format="pct" />
      <Bar
        label="Work Fill"
        value={cls.workforce?.fill_ratio}
        max={1}
        format="pct"
        variant={cls.workforce?.fill_ratio != null && cls.workforce.fill_ratio < 0.85 ? 'crit' : 'good'}
      />
    </div>
  </div>

  <div class="s-card">
    <div class="s-card-header"><h3>Worldview Chart</h3></div>
    <div class="s-card-pad flex justify-center">
      <RadarChart axes={worldviewAxes} size={170} scaleMin={0} scaleMax={6} />
    </div>
  </div>

  <div class="s-card">
    <div class="s-card-header"><h3>Living Standards</h3></div>
    <div class="s-card-pad">
      <dl class="kv">
        <dt>SoL</dt><dd>{num(cls.standard_of_living)}</dd>
        <dt>Expected</dt><dd>{num(cls.expected_sol)}</dd>
        <dt>Privilege</dt><dd>{pct(cls.social_privileges)}</dd>
      </dl>
    </div>
  </div>

  <div class="s-card md:col-span-2 xl:col-span-3">
    <div class="s-card-header"><h3>Consumption</h3></div>
    <div class="s-card-pad grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
      {#each CONSUMPTION_RESOURCES as [label, key]}
        <div>
          <div class="text-[10px] uppercase tracking-widest text-muted mb-2">{label}</div>
          <dl class="kv">
            <dt>Per cap</dt><dd>{num(cls.consumption?.[key]?.per_cap, 3)}</dd>
            <dt>Total / turn</dt><dd>{num(cls.consumption?.[key]?.total_per_turn)}</dd>
          </dl>
        </div>
      {/each}
    </div>
  </div>

  <div class="s-card">
    <div class="s-card-header"><h3>Income · per cap</h3></div>
    <div class="s-card-pad">
      <dl class="kv">
        <dt>Gross</dt><dd>{num(cls.income?.gross_per_cap)}</dd>
        <dt>Income tax</dt><dd>{num(cls.income?.income_tax_per_cap)}</dd>
        <dt>Wealth tax</dt><dd>{num(cls.income?.wealth_tax_per_cap)}</dd>
        <dt>Effective rate</dt>
        <dd>
          {cls.income?.effective_tax_rate != null
            ? (cls.income.effective_tax_rate * 100).toFixed(1) + '%'
            : '—'}
        </dd>
        <dt>Disposable</dt><dd>{num(cls.income?.disposable_per_cap)}</dd>
      </dl>
    </div>
  </div>

  <div class="s-card">
    <div class="s-card-header"><h3>Income · totals</h3></div>
    <div class="s-card-pad">
      <dl class="kv">
        <dt>Pre-tax</dt><dd>{whole(cls.income?.total_gross)}</dd>
        <dt>Post-tax</dt><dd>{whole(cls.income?.total_disposable)}</dd>
        <dt>Class wealth</dt><dd>{whole(cls.wealth?.total)}</dd>
        <dt>Wealth/cap</dt><dd>{num(cls.wealth?.per_cap)}</dd>
      </dl>
    </div>
  </div>

  <div class="s-card">
    <div class="s-card-header"><h3>Additional Income</h3></div>
    <div class="s-card-pad">
      <dl class="kv">
        <dt>Welfare</dt><dd>{num(cls.additional_income?.welfare)}</dd>
        <dt>Dividends</dt><dd>{num(cls.additional_income?.dividends)}</dd>
        <dt>Subsidies</dt><dd>{num(cls.additional_income?.subsidies)}</dd>
        <dt>Other</dt><dd>{num(cls.additional_income?.other)}</dd>
        <dt><strong>Total</strong></dt>
        <dd><strong>{num(cls.additional_income?.total)}</strong></dd>
      </dl>
    </div>
  </div>

  <div class="s-card md:col-span-2" class:critical={critRad}>
    <div class="s-card-header">
      <h3>Status</h3>
      {#if critRad}<Tag variant="crit">⚠ Radicalised</Tag>{/if}
    </div>
    <div class="s-card-pad grid grid-cols-1 md:grid-cols-2 gap-x-6">
      <div>
        <Bar
          label="Radicalisation"
          value={cls.status?.radicalisation}
          max={1}
          variant={critRad ? 'crit' : ''}
        />
        <Bar label="Abject Poverty" value={cls.status?.abject_poverty} max={1} variant="crit" />
        <Bar label="Organisation" value={cls.status?.organisation} max={1} />
      </div>
      <div>
        <Bar label="Education" value={cls.status?.literacy} max={1} variant="good" />
        <Bar label="Vote Share" value={cls.status?.vote_share} max={1} />
      </div>
    </div>
  </div>

  <div class="s-card md:col-span-2 xl:col-span-3">
    <div class="s-card-header"><h3>Workforce</h3></div>
    <div class="s-card-pad grid grid-cols-1 md:grid-cols-2 gap-x-6">
      <dl class="kv">
        <dt>Supply</dt><dd>{int(cls.workforce?.supply)}</dd>
        <dt>Demand</dt><dd>{int(cls.workforce?.demand)}</dd>
        <dt>Weekly Hours</dt><dd>{hours(cls.workforce?.weekly_hours_worked)}</dd>
      </dl>
      <div>
        <Bar label="Fill Ratio" value={cls.workforce?.fill_ratio} max={1} variant="good" />
        <Bar
          label="Unemployment"
          value={cls.workforce?.unemployment}
          max={1}
          variant={cls.workforce?.unemployment != null && cls.workforce.unemployment > 0.15
            ? 'crit'
            : ''}
        />
      </div>
    </div>
  </div>

  <div class="s-card md:col-span-2 xl:col-span-3">
    <div class="s-card-header">
      <h3>Satisfaction · sources</h3>
      <span class="text-muted text-[10px] tracking-widest">
        OVERALL {num(cls.satisfaction)}
      </span>
    </div>
    <div class="s-card-pad grid grid-cols-1 md:grid-cols-2 gap-x-6">
      <table class="tbl">
        <thead>
          <tr><th>Source</th><th class="num">Value</th></tr>
        </thead>
        <tbody>
          {#each SAT_LEFT as [label, key]}
            <tr>
              <td>{label}</td>
              <td class="num">{num(cls.satisfaction_breakdown?.[key])}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <table class="tbl">
        <thead>
          <tr><th>Source</th><th class="num">Value</th></tr>
        </thead>
        <tbody>
          {#each SAT_RIGHT as [label, key]}
            <tr>
              <td>{label}</td>
              <td class="num">{num(cls.satisfaction_breakdown?.[key])}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
