// Pure seat-math for the Congress Chamber view — voting power and coalition
// analysis derived from party seat counts only (no fabricated metadata). All
// inputs are the seat totals already in congress.json; nothing here reaches the
// workbook. Fully unit-testable.

// Quota for a simple majority of `total` seats: ⌊total/2⌋ + 1.
export function majorityQuota(total) {
  const n = Number(total);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n / 2) + 1;
}

// Normalised Banzhaf power index per party. A party is "critical" to a winning
// coalition when removing it drops the coalition below quota; the index is each
// party's share of all such critical memberships across every coalition. Returns
// a Map keyed by the party object (reference) → power in [0, 1].
//
// Enumerates 2^n subsets, so callers must keep n small (Congress has ≤ ~7
// seated parties). Parties with non-positive seats contribute 0.
export function banzhafPower(parties, quota) {
  const list = Array.isArray(parties) ? parties : [];
  const weights = list.map((p) => Math.max(0, Math.round(p?.seats ?? 0)));
  const n = weights.length;
  const power = new Map(list.map((p) => [p, 0]));
  if (n === 0 || !Number.isFinite(quota) || quota <= 0) return power;

  const counts = new Array(n).fill(0);
  let total = 0;
  for (let mask = 0; mask < 1 << n; mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) sum += weights[i];
    if (sum < quota) continue;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i) && sum - weights[i] < quota) {
        counts[i] += 1;
        total += 1;
      }
    }
  }
  list.forEach((p, i) => power.set(p, total > 0 ? counts[i] / total : 0));
  return power;
}

// Effective number of parties (Laakso–Taagepera): 1 / Σ(seatShareᵢ²). A single
// dominant party → ~1; perfectly even split of k parties → k. Returns null when
// there are no seats.
export function effectiveParties(parties) {
  const seats = (Array.isArray(parties) ? parties : []).map((p) =>
    Math.max(0, Math.round(p?.seats ?? 0)),
  );
  const total = seats.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const sumSq = seats.reduce((a, s) => a + (s / total) ** 2, 0);
  return sumSq > 0 ? 1 / sumSq : null;
}

// Seat sum of a set of parties (used by the coalition builder).
export function coalitionSeats(parties) {
  return (Array.isArray(parties) ? parties : []).reduce(
    (a, p) => a + Math.max(0, Math.round(p?.seats ?? 0)),
    0,
  );
}
