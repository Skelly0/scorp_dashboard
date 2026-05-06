import { derived } from 'svelte/store';
import { pops } from './pops.js';

export const workforce = derived(pops, ($pops) => {
  if (!$pops?.classes?.length) return null;

  const classes = $pops.classes;
  const totalDemand = classes.reduce((s, c) => s + (c.workforce?.demand ?? 0), 0);
  const totalSupply = classes.reduce((s, c) => s + (c.workforce?.supply ?? 0), 0);
  const totalUnemployed = classes.reduce((s, c) => s + (c.unemployed_count ?? 0), 0);
  const fillRatio = totalDemand > 0 ? totalSupply / totalDemand : null;

  const perClassShortage = classes.map((c) => ({
    name: c.name,
    count: Math.max(0, (c.workforce?.demand ?? 0) - (c.workforce?.supply ?? 0)),
  }));
  const shortage = perClassShortage.reduce((s, x) => s + x.count, 0);

  const topUnemployed = [...classes]
    .filter((c) => (c.unemployed_count ?? 0) > 0)
    .sort((a, b) => (b.unemployed_count ?? 0) - (a.unemployed_count ?? 0))
    .slice(0, 2)
    .map((c) => ({ name: c.name, count: Math.round(c.unemployed_count) }));

  const topShortage = perClassShortage
    .map((x) => ({ name: x.name, count: Math.round(x.count) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2);

  return {
    totalDemand,
    totalSupply,
    totalUnemployed,
    fillRatio,
    shortage,
    topUnemployed,
    topShortage,
    mismatch: totalUnemployed > 0 && shortage > 0,
  };
});
