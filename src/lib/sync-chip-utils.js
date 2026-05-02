const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000;

export function isStale(syncedAt, now = new Date()) {
  if (!syncedAt) return true;
  return now.getTime() - new Date(syncedAt).getTime() > STALE_THRESHOLD_MS;
}

export function formatSyncedAt(syncedAt) {
  if (!syncedAt) return '—';
  const d = new Date(syncedAt);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}
