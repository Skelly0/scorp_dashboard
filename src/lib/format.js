// Shared number formatters. Display formatters return '—' for null/non-finite
// (KpiBlock/StatTile render the dash directly); chip formatters return null so
// detail chips are omitted entirely (both components filter on detail?.text).
// Locale is pinned to 'en-US' so grouping/decimal separators are stable across
// environments and consistent with toFixed-based formatters like fmtPct.
const DASH = '—';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// Round to integer, normalize -0 → 0, sign + group from the rounded value.
function signedInt(value) {
  const rounded = Math.round(value) || 0;
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('en-US')}`;
}

export function fmtInt(value) {
  if (!finite(value)) return DASH;
  const rounded = Math.round(value) || 0;
  return rounded.toLocaleString('en-US');
}

export function fmtNum(value, digits = 2) {
  if (!finite(value)) return DASH;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtSignedInt(value) {
  if (!finite(value)) return DASH;
  return signedInt(value);
}

export function fmtSigned(value, digits = 1) {
  if (!finite(value)) return DASH;
  const r = Math.round(value * 10 ** digits) / 10 ** digits || 0;
  const sign = r > 0 ? '+' : r < 0 ? '-' : '';
  return sign + fmtNum(Math.abs(r), digits);
}

export function fmtPct(value, digits = 0) {
  if (!finite(value)) return DASH;
  // Normalize "-0"/"-0.0" (tiny negatives rounded to zero) to the unsigned form,
  // matching the -0 handling in the integer formatters above.
  const fixed = (value * 100).toFixed(digits);
  return `${fixed.startsWith('-') && Number(fixed) === 0 ? fixed.slice(1) : fixed}%`;
}

export function chipSignedFlow(value) {
  if (!finite(value)) return null;
  return signedInt(value);
}

// Positive upkeep is a cost (rendered "-846"); negative upkeep is a refund.
export function chipUpkeepFlow(value) {
  if (!finite(value)) return null;
  const rounded = Math.round(value) || 0;
  if (rounded === 0) return '0';
  return rounded > 0
    ? `-${rounded.toLocaleString('en-US')}`
    : `+${Math.abs(rounded).toLocaleString('en-US')}`;
}
