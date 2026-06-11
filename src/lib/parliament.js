// Pure hemicycle seat-layout math for the Congress parliamentary diagram
// (FederationChamber.svelte). No DOM — fully unit-testable.
//
// seatPositions(n) returns one {x, y, angle, row} per seat in LEFT → RIGHT
// fill order (angle π → 0; inner rows first on angle ties), in unit space:
// the hemicycle is centred on (0, 0) with outer radius 1 and opens upward —
// x ∈ [-1, 1], y ∈ [0, 1]. Callers map into SVG space (flip y).
//
// Rows are concentric arcs from INNER_RADIUS out to 1; seats are distributed
// to rows proportionally to arc radius via largest remainder, then placed at
// even angular steps inclusive of both arc ends. Assigning a flat,
// group-ordered seat list to the returned order yields contiguous angular
// wedges per group — the classic Wikipedia-style parliament chart.

export const INNER_RADIUS = 0.42;

export function rowCount(n) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.ceil(Math.sqrt(n) / 1.8));
}

export function rowRadii(rows) {
  if (!Number.isFinite(rows) || rows <= 0) return [];
  if (rows === 1) return [(INNER_RADIUS + 1) / 2];
  const radii = [];
  for (let k = 0; k < rows; k++) {
    radii.push(INNER_RADIUS + ((1 - INNER_RADIUS) * k) / (rows - 1));
  }
  return radii;
}

export function seatPositions(n, rows = rowCount(n)) {
  if (!Number.isFinite(n) || n <= 0) return [];
  rows = Math.max(1, Math.min(Math.round(rows), n));
  const radii = rowRadii(rows);
  const totalR = radii.reduce((a, b) => a + b, 0);

  // Largest-remainder split of n seats across rows, quota ∝ radius.
  const counts = radii.map((r) => Math.floor((n * r) / totalR));
  const remainders = radii
    .map((r, k) => ({ k, frac: (n * r) / totalR - counts[k] }))
    .sort((a, b) => b.frac - a.frac || b.k - a.k); // outer rows win ties
  let placed = counts.reduce((a, b) => a + b, 0);
  for (let i = 0; placed < n; i = (i + 1) % remainders.length, placed++) {
    counts[remainders[i].k] += 1;
  }

  const seats = [];
  counts.forEach((m, k) => {
    const r = radii[k];
    for (let i = 0; i < m; i++) {
      const angle = m === 1 ? Math.PI / 2 : Math.PI - (Math.PI * i) / (m - 1);
      seats.push({ x: r * Math.cos(angle), y: r * Math.sin(angle), angle, row: k });
    }
  });
  seats.sort((a, b) => b.angle - a.angle || a.row - b.row);
  return seats;
}

// Dot radius (unit space) that clears both the mean angular gap between
// neighbours on a row and the radial gap between rows.
export function dotRadius(n, rows = rowCount(n)) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  rows = Math.max(1, Math.min(Math.round(rows), n));
  const radii = rowRadii(rows);
  const totalR = radii.reduce((a, b) => a + b, 0);
  const angularGap = (Math.PI * totalR) / n;
  const radialGap = rows > 1 ? (1 - INNER_RADIUS) / (rows - 1) : 1 - INNER_RADIUS;
  return 0.38 * Math.min(angularGap, radialGap);
}

// Contiguous angular wedge per group when the seats of `positions` are
// filled in order with groups of the given sizes. Boundaries between
// adjacent groups sit at the midpoint between their edge seats; the first
// group starts at π and the last ends at 0. Zero-size groups yield null.
export function groupArcs(positions, groupSizes) {
  const arcs = [];
  let idx = 0;
  for (const size of groupSizes) {
    const m = Number.isFinite(size) ? Math.max(0, Math.round(size)) : 0;
    if (m === 0 || idx + m > positions.length) {
      arcs.push(null);
      idx += m;
      continue;
    }
    arcs.push({ start: positions[idx].angle, end: positions[idx + m - 1].angle });
    idx += m;
  }
  let prev = null;
  for (let g = 0; g < arcs.length; g++) {
    if (!arcs[g]) continue;
    if (prev == null) {
      arcs[g].start = Math.PI;
    } else {
      const mid = (arcs[prev].end + arcs[g].start) / 2;
      arcs[prev].end = mid;
      arcs[g].start = mid;
    }
    prev = g;
  }
  if (prev != null) arcs[prev].end = 0;
  return arcs;
}
