import { describe, expect, test } from 'vitest';
import {
  buildCensus,
  classCode,
  zoneOf,
  satTone,
  radTone,
  fillTone,
  facetTone,
  foodTone,
  housingTone,
  dispTone,
  FACET_ORDER,
} from './census.js';

const pops = {
  classes: [
    {
      name: 'Industrial Workers',
      pop: 200,
      satisfaction: 0.17,
      standard_of_living: 8.3,
      expected_sol: 9,
      social_privileges: 5,
      births_per_turn: 40,
      deaths_per_turn: 30,
      mortality_rate: 0.015,
      mobility_in: 1,
      mobility_out: 2,
      unemployed_count: 0,
      income: { disposable_per_cap: 15, gross_per_cap: 16 },
      wealth: { per_cap: 64 },
      status: { radicalisation: 0.36, vote_share: 0.18, literacy: 0.22, organisation: 0.39, votes_total: 800 },
      workforce: { demand: 260, supply: 180, fill_ratio: 180 / 260, weekly_hours_worked: 40 },
      satisfaction_breakdown: { employment: 0.7, wages: 0.5, housing: 0.9, food: 0.85, services: 0.92, entertainment: 0.57, safety: 0.71, situations: 0.2, ownership: 0.4, tax: 0.95, faith: 0.42 },
    },
    {
      name: 'Capitalists',
      pop: 100,
      satisfaction: 0.09,
      standard_of_living: 9.1,
      expected_sol: 36,
      social_privileges: 4,
      births_per_turn: 4,
      deaths_per_turn: 2,
      mortality_rate: 0.012,
      mobility_in: 0,
      mobility_out: 0,
      unemployed_count: 80,
      income: { disposable_per_cap: 45, gross_per_cap: 45 },
      wealth: { per_cap: 180 },
      status: { radicalisation: 0.49, vote_share: 0.03, literacy: 0.39, organisation: 0.51, votes_total: 90 },
      workforce: { demand: 0, supply: 80, fill_ratio: 1, weekly_hours_worked: 0 },
      satisfaction_breakdown: { employment: 0.25, wages: 0.17, housing: 0.95, food: 0.88, services: 0.25, entertainment: 0.31, safety: 0.56, situations: 0.4, ownership: 0.4, tax: 1, faith: 0.5 },
    },
  ],
};

const population = {
  classes: [
    { name: 'Industrial Workers', tier: 'Lower', share: 0.66, political_weight: 1.1, worldview: { expansion: 5 } },
    { name: 'Capitalists', tier: 'Expropriated', share: 0.33, political_weight: 2, worldview: { expansion: 3 } },
  ],
};

const demographics = {
  totals: { pop: 300, avg_satisfaction: 0.26, total_births: 44, total_deaths: 32, effective_cdr: 0.015, effective_growth_rate: 0.011 },
  housing: { capacity: 280, pop: 300, ratio: 1.07, growth_mult: 0.82, overcrowding_exp: 3 },
  food: { security_ratio: 0.77, variety_index: 0.037, per_cap: 0.0098 },
};

describe('tone helpers', () => {
  test('satTone bands', () => {
    expect(satTone(0.5)).toBe('good');
    expect(satTone(0.3)).toBe('warn');
    expect(satTone(0.1)).toBe('crit');
    expect(satTone(null)).toBe(null);
  });
  test('radTone is inverted', () => {
    expect(radTone(0.5)).toBe('crit');
    expect(radTone(0.3)).toBe('warn');
    expect(radTone(0.1)).toBe('good');
  });
  test('fillTone bands', () => {
    expect(fillTone(0.9)).toBe('good');
    expect(fillTone(0.75)).toBe('warn');
    expect(fillTone(0.5)).toBe('crit');
  });
  test('facetTone bands', () => {
    expect(facetTone(0.7)).toBe('good');
    expect(facetTone(0.5)).toBe('warn');
    expect(facetTone(0.2)).toBe('crit');
  });
  test('foodTone targets 1.0', () => {
    expect(foodTone(1.0)).toBe('good');
    expect(foodTone(0.96)).toBe('warn');
    expect(foodTone(0.9)).toBe('crit');
  });
  test('housingTone flags over-capacity', () => {
    expect(housingTone(1.07)).toBe('crit');
    expect(housingTone(0.95)).toBe('warn');
    expect(housingTone(0.5)).toBe('good');
  });
  test('dispTone bands', () => {
    expect(dispTone(15)).toBe('crit');
    expect(dispTone(20)).toBe('warn');
    expect(dispTone(30)).toBe('good');
  });
});

describe('classCode', () => {
  test('derives a 3-letter code from the first word', () => {
    expect(classCode('Industrial Workers')).toBe('IND');
    expect(classCode('Service Workers')).toBe('SER');
    expect(classCode('Bureaucrats')).toBe('BUR');
  });
  test('handles empty/odd names', () => {
    expect(classCode('')).toBe('—');
    expect(classCode('42 Crew')).toBe('CRE');
  });
});

describe('zoneOf', () => {
  test('classifies the four quadrants', () => {
    expect(zoneOf(0.2, 0.4)).toBe('Flashpoint');
    expect(zoneOf(0.5, 0.4)).toBe('Agitated');
    expect(zoneOf(0.2, 0.1)).toBe('Resigned');
    expect(zoneOf(0.5, 0.1)).toBe('Content');
  });
});

describe('buildCensus', () => {
  test('returns null until all three sources are present', () => {
    expect(buildCensus(null, population, demographics)).toBe(null);
    expect(buildCensus(pops, null, demographics)).toBe(null);
    expect(buildCensus(pops, population, null)).toBe(null);
  });

  test('merges per-class vitals with tier/share and keeps raw shapes', () => {
    const m = buildCensus(pops, population, demographics);
    const iw = m.classes.find((c) => c.name === 'Industrial Workers');
    expect(iw.tier).toBe('Lower');
    expect(iw.share).toBeCloseTo(0.66);
    expect(iw.sat).toBe(0.17);
    expect(iw.rad).toBe(0.36);
    expect(iw.weeklyHours).toBe(40);
    expect(iw.mobilityIn).toBe(1);
    // Raw pops object preserved for <ClassDetail> reuse.
    expect(iw.raw).toBe(pops.classes[0]);
    expect(iw.profile.political_weight).toBe(1.1);
  });

  test('aggregates workforce with owner-class supply excluded from fill', () => {
    const { agg } = buildCensus(pops, population, demographics);
    // Only Industrial Workers has demand>0 → supply counted = 180; demand = 260.
    expect(agg.totDemand).toBe(260);
    expect(agg.totSupply).toBe(180);
    expect(agg.avgFill).toBeCloseTo(180 / 260);
    expect(agg.totUnemp).toBe(80);
    expect(agg.mismatch).toBe(true);
    expect(agg.topShortage[0]).toEqual({ name: 'Industrial Workers', count: 80 });
    expect(agg.topUnemployed[0]).toEqual({ name: 'Capitalists', count: 80 });
  });

  test('lowerPop sums only Lower-tier classes for the working-class share', () => {
    const { agg } = buildCensus(pops, population, demographics);
    expect(agg.lowerPop).toBe(200);
  });

  test('avgRad is pop-weighted, avgSat comes from demographics totals', () => {
    const { agg } = buildCensus(pops, population, demographics);
    expect(agg.avgSat).toBe(0.26);
    // (0.36*200 + 0.49*100) / 300
    expect(agg.avgRad).toBeCloseTo((0.36 * 200 + 0.49 * 100) / 300);
  });

  test('facetAverages are pop-weighted and sorted ascending', () => {
    const { agg } = buildCensus(pops, population, demographics);
    expect(agg.facetAverages.length).toBe(FACET_ORDER.length);
    for (let i = 1; i < agg.facetAverages.length; i++) {
      expect(agg.facetAverages[i].value).toBeGreaterThanOrEqual(agg.facetAverages[i - 1].value);
    }
  });

  test('housing + food aggregates pass through', () => {
    const { agg } = buildCensus(pops, population, demographics);
    expect(agg.housingCap).toBe(280);
    expect(agg.housingRatio).toBe(1.07);
    expect(agg.overcrowdingExp).toBe(3);
    expect(agg.foodSecurity).toBe(0.77);
    expect(agg.foodPerCap).toBe(0.0098);
  });
});
