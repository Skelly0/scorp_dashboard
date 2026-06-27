// Census model + tone helpers for the Demographics (Colony Census) page.
//
// Pure functions only — no Svelte, no DOM — so the transforms are unit-tested in
// census.test.js. The page (`Demographics.svelte`) and its sub-components consume
// `buildCensus()` and the tone helpers; nothing here reaches into stores.
//
// All inputs are the parsed JSON shapes: `pops.json` (per-class vitals),
// `population.json` (tier / share / worldview), and `demographics.json`
// (colony aggregates). Every field is null-safe — the GM workbook can leave any
// named range blank, so callers render '—' for null.

import { classColor } from './faction-colors.js';

// Satisfaction-driver order. Mirrors the design's FACET_ORDER and the 11
// `satisfaction_breakdown` keys emitted by extractors/pops.py.
export const FACET_ORDER = [
  ['employment', 'Employment'],
  ['wages', 'Wages'],
  ['housing', 'Housing'],
  ['food', 'Food'],
  ['services', 'Services'],
  ['entertainment', 'Leisure'],
  ['safety', 'Safety'],
  ['situations', 'Situations'],
  ['ownership', 'Ownership'],
  ['tax', 'Tax'],
  ['faith', 'Faith'],
];

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

// --- tone thresholds (ported verbatim from the Census mockup) ---
export function satTone(v) {
  if (!finite(v)) return null;
  return v >= 0.4 ? 'good' : v >= 0.25 ? 'warn' : 'crit';
}
export function radTone(v) {
  if (!finite(v)) return null;
  return v >= 0.4 ? 'crit' : v >= 0.25 ? 'warn' : 'good';
}
export function fillTone(v) {
  if (!finite(v)) return null;
  return v >= 0.85 ? 'good' : v >= 0.7 ? 'warn' : 'crit';
}
export function facetTone(v) {
  if (!finite(v)) return null;
  return v >= 0.66 ? 'good' : v >= 0.4 ? 'warn' : 'crit';
}
// Food security targets ~1.0 (cropsim semantics, gotcha #34) — not the 0.33/0.66
// satisfaction scale.
export function foodTone(v) {
  if (!finite(v)) return null;
  return v >= 1 ? 'good' : v >= 0.95 ? 'warn' : 'crit';
}
export function housingTone(ratio) {
  if (!finite(ratio)) return null;
  return ratio > 1 ? 'crit' : ratio > 0.9 ? 'warn' : 'good';
}
// Disposable income / cap tone for the Standard-of-Living rows.
export function dispTone(v) {
  if (!finite(v)) return null;
  return v < 16 ? 'crit' : v < 22 ? 'warn' : 'good';
}

export function toneVar(tone) {
  switch (tone) {
    case 'crit':
      return 'var(--crit)';
    case 'warn':
      return 'var(--warn)';
    case 'good':
      return 'var(--good)';
    case 'muted':
      return 'var(--muted)';
    default:
      return 'var(--accent)';
  }
}

// Stability quadrant zone from satisfaction + radicalisation.
export function zoneOf(sat, rad) {
  const lowSat = sat < 0.3;
  const hiRad = rad > 0.3;
  if (lowSat && hiRad) return 'Flashpoint';
  if (!lowSat && hiRad) return 'Agitated';
  if (lowSat && !hiRad) return 'Resigned';
  return 'Content';
}

// 3-letter scatter code derived from the class name (data-driven so it survives
// GM renames). First word, letters only, upper-cased, first three chars.
export function classCode(name) {
  if (!name) return '—';
  const word = String(name).trim().split(/\s+/)[0] || '';
  let letters = word.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (!letters) letters = String(name).replace(/[^A-Za-z]/g, '').toUpperCase();
  return letters.slice(0, 3) || '—';
}

function popWeighted(classes, pick) {
  let sum = 0;
  let pop = 0;
  for (const c of classes) {
    const v = pick(c);
    if (finite(v) && finite(c.pop)) {
      sum += v * c.pop;
      pop += c.pop;
    }
  }
  return pop > 0 ? sum / pop : null;
}

// Merge a pops class + population profile into one flat record used everywhere.
function enrichClass(c, profile, totalPop) {
  const pop = finite(c.pop) ? c.pop : null;
  return {
    name: c.name,
    code: classCode(c.name),
    color: classColor(c.name),
    tier: profile?.tier ?? null,
    pop,
    share: finite(profile?.share)
      ? profile.share
      : finite(pop) && finite(totalPop) && totalPop > 0
        ? pop / totalPop
        : null,
    sat: c.satisfaction ?? null,
    rad: c.status?.radicalisation ?? null,
    vote: c.status?.vote_share ?? null,
    votesTotal: c.status?.votes_total ?? null,
    lit: c.status?.literacy ?? null,
    org: c.status?.organisation ?? null,
    abjectPoverty: c.status?.abject_poverty ?? null,
    sol: c.standard_of_living ?? null,
    expSol: c.expected_sol ?? null,
    priv: c.social_privileges ?? null,
    fill: c.workforce?.fill_ratio ?? null,
    demand: c.workforce?.demand ?? null,
    supply: c.workforce?.supply ?? null,
    weeklyHours: c.workforce?.weekly_hours_worked ?? null,
    unemp: c.unemployed_count ?? null,
    disp: c.income?.disposable_per_cap ?? null,
    gross: c.income?.gross_per_cap ?? null,
    wealthpc: c.wealth?.per_cap ?? null,
    births: c.births_per_turn ?? null,
    deaths: c.deaths_per_turn ?? null,
    mortality: c.mortality_rate ?? null,
    mobilityIn: c.mobility_in ?? null,
    mobilityOut: c.mobility_out ?? null,
    facets: c.satisfaction_breakdown ?? {},
    worldview: profile?.worldview ?? null,
    politicalWeight: profile?.political_weight ?? null,
    // Raw shapes kept verbatim so the page can hand them to <ClassDetail> for
    // the full per-class record without remapping.
    raw: c,
    profile: profile ?? null,
  };
}

/**
 * Build the unified census view-model from the three data sources.
 * Returns null until pops + population + demographics are all present.
 */
export function buildCensus(pops, population, demographics) {
  if (!pops?.classes?.length || !population?.classes || !demographics) return null;

  const profileByName = new Map((population.classes ?? []).map((p) => [p.name, p]));
  const totals = demographics.totals ?? {};
  const totalPop = finite(totals.pop)
    ? totals.pop
    : pops.classes.reduce((s, c) => s + (finite(c.pop) ? c.pop : 0), 0);

  const classes = pops.classes.map((c) =>
    enrichClass(c, profileByName.get(c.name), totalPop)
  );

  // Workforce aggregates: supply only counts toward fill for classes that have
  // labour demand (owner classes have demand 0 but non-zero supply — idle).
  const totDemand = classes.reduce((s, c) => s + (finite(c.demand) ? c.demand : 0), 0);
  const totSupply = classes.reduce(
    (s, c) => s + (finite(c.demand) && c.demand > 0 && finite(c.supply) ? c.supply : 0),
    0
  );
  const totUnemp = classes.reduce((s, c) => s + (finite(c.unemp) ? c.unemp : 0), 0);
  const shortage = classes.reduce(
    (s, c) => s + Math.max(0, (finite(c.demand) ? c.demand : 0) - (finite(c.supply) ? c.supply : 0)),
    0
  );

  const topShortage = classes
    .map((c) => ({ name: c.name, count: Math.round(Math.max(0, (c.demand ?? 0) - (c.supply ?? 0))) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2);
  const topUnemployed = classes
    .filter((c) => finite(c.unemp) && c.unemp > 0)
    .sort((a, b) => b.unemp - a.unemp)
    .slice(0, 2)
    .map((c) => ({ name: c.name, count: Math.round(c.unemp) }));

  const housing = demographics.housing ?? {};
  const food = demographics.food ?? {};

  // Pop-weighted facet averages (lowest-first) for the Avg-Satisfaction tile.
  const facetAverages = FACET_ORDER.map(([key, label]) => ({
    key,
    label,
    value: popWeighted(classes, (c) => c.facets?.[key]),
  })).sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity));

  const lowerPop = classes
    .filter((c) => c.tier === 'Lower')
    .reduce((s, c) => s + (finite(c.pop) ? c.pop : 0), 0);

  const agg = {
    pop: totalPop,
    avgSat: totals.avg_satisfaction ?? null,
    avgRad: popWeighted(classes, (c) => c.rad),
    births: totals.total_births ?? null,
    deaths: totals.total_deaths ?? null,
    growth: totals.effective_growth_rate ?? null,
    cdr: totals.effective_cdr ?? null,
    housingCap: housing.capacity ?? null,
    housingPop: housing.pop ?? null,
    housingRatio: housing.ratio ?? null,
    growthMult: housing.growth_mult ?? null,
    overcrowdingExp: housing.overcrowding_exp ?? null,
    foodSecurity: food.security_ratio ?? null,
    foodVariety: food.variety_index ?? null,
    foodPerCap: food.per_cap ?? null,
    totDemand,
    totSupply,
    totUnemp,
    shortage,
    topShortage,
    topUnemployed,
    avgFill: totDemand > 0 ? totSupply / totDemand : null,
    lowerPop,
    facetAverages,
    mismatch: totUnemp > 0 && shortage > 0,
  };

  return { classes, agg };
}

export const TIERS = ['All', 'Upper', 'Middle', 'Lower', 'Expropriated'];
