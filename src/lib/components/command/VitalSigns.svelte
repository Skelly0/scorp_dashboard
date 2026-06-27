<script>
  // The five headline vitals + their drill-downs. This component owns the
  // parity-critical maths (tones, deltas, drill-down rows) so the old Status
  // page's behaviour is preserved exactly. Tiles are dumb (VitalTile).
  import VitalTile from './VitalTile.svelte';
  import {
    frames,
    currentFrame,
    prevFrame,
    effectiveIdx,
    isLiveYear,
  } from '../../stores/timeline.js';
  import { situations } from '../../stores/situations.js';
  import { situationLoad, crisisBreach } from '../../stores/crisis.js';
  import { parties } from '../../stores/parties.js';
  import {
    fmtInt,
    fmtSignedInt,
    fmtPct,
    formatStatusPercent,
    statusMetricTone,
    toneColor,
    arrowFor,
    deltaTone,
    clamp,
  } from '../../command-format.js';

  const CRIT_LOWER = { lowerIsBetter: true };

  $: f = $currentFrame;
  $: pf = $prevFrame;
  $: hist = $frames.slice(0, $effectiveIdx + 1);

  function spark(selector) {
    return hist.map(selector).filter((v) => v != null && Number.isFinite(v));
  }

  // Percentage-point delta (for 0..1 metrics). raw is in pp.
  function ppDelta(key, lowerIsBetter) {
    if (!pf || f?.[key] == null || pf?.[key] == null) return null;
    const raw = Math.round((f[key] - pf[key]) * 100);
    const text = `${raw > 0 ? '+' : raw < 0 ? '−' : ''}${Math.abs(raw)} pp`;
    return { text, arrow: arrowFor(raw), tone: deltaTone(raw, lowerIsBetter) };
  }

  function intDelta(cur, prev, lowerIsBetter = false) {
    if (cur == null || prev == null) return null;
    const raw = Math.round(cur - prev);
    return { text: fmtSignedInt(raw), arrow: arrowFor(raw), tone: deltaTone(raw, lowerIsBetter) };
  }

  // Population headline delta: births − deaths on the live year (Status parity,
  // CLAUDE.md #24), else year-over-year population change on archive years.
  function popDelta() {
    if (f?.population_birth_death_net != null) {
      const raw = f.population_birth_death_net;
      return { text: fmtSignedInt(raw), arrow: arrowFor(raw), tone: deltaTone(raw, false) };
    }
    return intDelta(f?.population, pf?.population);
  }

  // ---- drill-down builders (ported from the mock's *Detail methods) ----
  function moneyDetail() {
    const m = f?.money;
    if (!m) return null;
    const inc = m.income ?? 0;
    const up = m.upkeep ?? 0;
    const net = m.net ?? 0;
    const res = m.current ?? 0;
    const mx = Math.max(inc, up, 1);
    const peak = Math.max(...$frames.map((fr) => fr.money?.current ?? 0), 1);
    return {
      rows: [
        { label: 'Income / yr', valueText: `+₡ ${fmtInt(inc)}`, tone: 'good', frac: inc / mx },
        { label: 'Upkeep / yr', valueText: `−₡ ${fmtInt(up)}`, tone: 'crit', frac: up / mx },
        {
          label: 'Net flow / yr',
          valueText: `${net >= 0 ? '+' : '−'}₡ ${fmtInt(Math.abs(net))}`,
          tone: net >= 0 ? 'good' : 'crit',
          frac: Math.abs(net) / mx,
        },
        {
          label: 'Treasury reserve',
          valueText: `₡ ${fmtInt(res)}`,
          tone: null,
          frac: clamp(res / peak, 0, 1),
          color: toneColor('muted'),
        },
      ],
      note: `Annual net flow ${net >= 0 ? '+' : '−'}₡${fmtInt(Math.abs(net))} · treasury reserve ₡${fmtInt(res)}.`,
    };
  }

  function stabilityDetail() {
    if (!f) return null;
    const approval = f.gov_approval;
    const housing = f.housing_util;
    const sat = f.avg_satisfaction;
    const food = f.resourcesByName?.food;
    const foodSec = food ? clamp((food.income ?? 0) / Math.max(food.upkeep ?? 1, 1), 0, 1.4) : null;
    return {
      rows: [
        { label: 'Public approval', valueText: fmtPct(approval), tone: statusMetricTone(approval), frac: approval ?? 0 },
        { label: 'Avg satisfaction', valueText: fmtPct(sat), tone: statusMetricTone(sat), frac: sat ?? 0 },
        {
          label: 'Food security',
          valueText: fmtPct(foodSec),
          tone: foodSec == null ? 'muted' : foodSec >= 1 ? 'good' : foodSec >= 0.9 ? 'warn' : 'crit',
          frac: clamp(foodSec ?? 0, 0, 1),
        },
        {
          label: 'Housing pressure',
          valueText: fmtPct(housing),
          tone: housing == null ? 'muted' : housing > 1 ? 'crit' : housing > 0.95 ? 'warn' : 'good',
          frac: clamp(housing ?? 0, 0, 1.2) / 1.2,
        },
      ],
      note: 'Composite read across approval, satisfaction, food security and housing pressure.',
    };
  }

  function sevOf(cf) {
    return cf < 0 ? 'good' : cf >= 0.4 ? 'crit' : cf >= 0.2 ? 'warn' : 'good';
  }

  function crisisDetail() {
    if (!$isLiveYear) {
      return { rows: [], note: 'Archive year — no situation record.' };
    }
    const sits = ($situations?.active ?? []).slice().sort((a, b) => b.crisis_factor - a.crisis_factor);
    const mx = Math.max(...sits.map((s) => Math.abs(s.crisis_factor)), 0.0001);
    const rows = sits.map((s) => ({
      label: s.name,
      valueText: s.crisis_factor.toFixed(2),
      tone: sevOf(s.crisis_factor),
      frac: Math.abs(s.crisis_factor) / mx,
    }));
    const note = sits.length
      ? `Situation load ${($situationLoad ?? 0).toFixed(2)} vs capacity 1.00 · ${sits.length} active.`
      : 'No active situations this year.';
    return { rows, note };
  }

  // Population drill-down. PARITY: in addition to the mock's births/deaths/net,
  // surfaces Projected Growth % and Housing capacity/util (the old Status page's
  // Pulse band exposed projected-growth-rate and housing-util — keep both).
  function populationDetail() {
    if (!f) return null;
    const b = f.total_births;
    const d = f.total_deaths;
    const net = f.population_birth_death_net;
    const rate = f.projected_growth_rate;
    const housing = f.housing_util;
    const cap = f.housing?.current;
    const pop = f.population;
    const mx = Math.max(b ?? 0, d ?? 0, 1);
    return {
      rows: [
        { label: 'Births / yr', valueText: b != null ? `+${fmtInt(b)}` : '—', tone: 'good', frac: (b ?? 0) / mx },
        { label: 'Deaths / yr', valueText: `−${fmtInt(d)}`, tone: 'crit', frac: (d ?? 0) / mx },
        {
          label: 'Net / yr',
          valueText: net != null ? fmtSignedInt(net) : '—',
          tone: net == null ? 'muted' : net >= 0 ? 'good' : 'crit',
          frac: Math.abs(net ?? 0) / mx,
        },
        {
          label: 'Projected growth',
          valueText: rate != null ? `${rate >= 0 ? '+' : ''}${rate.toFixed(2)}%` : '—',
          tone: rate == null ? 'muted' : rate >= 0 ? 'good' : 'crit',
          frac: clamp(Math.abs(rate ?? 0) / 5, 0, 1),
        },
        {
          label: 'Housing capacity',
          valueText: fmtInt(cap),
          tone: null,
          frac: clamp((cap ?? 0) / Math.max(pop ?? 1, 1), 0, 1),
          color: toneColor('muted'),
        },
        {
          label: 'Housing util',
          valueText: fmtPct(housing),
          tone: housing == null ? 'muted' : housing > 1 ? 'crit' : 'good',
          frac: clamp(housing ?? 0, 0, 1.2) / 1.2,
        },
      ],
      note: `Housing capacity ${fmtInt(cap)} vs population ${fmtInt(pop)} · util ${fmtPct(housing)}.`,
    };
  }

  function approvalDetail() {
    if (!f) return null;
    const list = ($parties?.parties ?? []).slice().sort((a, b) => (b.vote_share ?? 0) - (a.vote_share ?? 0));
    const mx = Math.max(...list.map((p) => p.vote_share ?? 0), 0.0001);
    return {
      rows: list.map((p) => ({
        label: p.name,
        valueText: fmtPct(p.vote_share, 1),
        tone: null,
        frac: (p.vote_share ?? 0) / mx,
        color: toneColor('muted'),
      })),
      note: `Government approval ${formatStatusPercent(f.gov_approval)} · vote share by party (latest poll).`,
    };
  }

  $: stabTone = statusMetricTone(f?.stability);
  $: crisTone = statusMetricTone(f?.crisis_factor, CRIT_LOWER);
  $: apprTone = statusMetricTone(f?.gov_approval);

  $: tiles = f
    ? [
        {
          key: 'money',
          span: 'col-span-12 md:col-span-4',
          label: 'Treasury',
          prefix: '₡ ',
          value: fmtInt(f.money?.current),
          sub: 'Reserve · credits',
          tone: null,
          delta: intDelta(f.money?.current, pf?.money?.current),
          sparkData: spark((fr) => fr.money?.current),
          sparkColor: 'var(--accent)',
          detail: moneyDetail(),
        },
        {
          key: 'stability',
          span: 'col-span-6 md:col-span-2',
          label: 'Stability',
          value: formatStatusPercent(f.stability),
          sub: 'Cohesion index',
          tone: stabTone,
          delta: ppDelta('stability', false),
          sparkData: spark((fr) => fr.stability),
          sparkColor: toneColor(stabTone),
          detail: stabilityDetail(),
        },
        {
          key: 'crisis',
          span: 'col-span-6 md:col-span-2',
          label: 'Crisis Pressure',
          value: formatStatusPercent(f.crisis_factor),
          sub: 'Pressure scalar',
          tone: crisTone,
          delta: ppDelta('crisis_factor', true),
          tag: $isLiveYear && $crisisBreach.breached ? 'OVER 1.0' : null,
          sparkData: spark((fr) => fr.crisis_factor),
          sparkColor: toneColor(crisTone),
          detail: crisisDetail(),
        },
        {
          key: 'population',
          span: 'col-span-6 md:col-span-2',
          label: 'Population',
          value: fmtInt(f.population),
          sub: 'Residents',
          tone: null,
          delta: popDelta(),
          sparkData: spark((fr) => fr.population),
          sparkColor: 'var(--accent)',
          detail: populationDetail(),
        },
        {
          key: 'approval',
          span: 'col-span-6 md:col-span-2',
          label: 'Gov Approval',
          value: formatStatusPercent(f.gov_approval),
          sub: 'Coalition mean',
          tone: apprTone,
          delta: ppDelta('gov_approval', false),
          sparkData: spark((fr) => fr.gov_approval),
          sparkColor: toneColor(apprTone),
          detail: approvalDetail(),
        },
      ]
    : [];
</script>

<div class="grid grid-cols-12 gap-3">
  {#each tiles as t (t.key)}
    <div class={t.span} style="min-width:0;">
      <VitalTile
        label={t.label}
        value={t.value}
        prefix={t.prefix ?? ''}
        sub={t.sub}
        tone={t.tone}
        delta={t.delta}
        tag={t.tag}
        sparkData={t.sparkData}
        sparkColor={t.sparkColor}
        detail={t.detail}
      />
    </div>
  {/each}
</div>
