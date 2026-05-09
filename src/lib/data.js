const BASE = './data';
const OPTIONAL_PAGES = new Set(['senate', 'tech']);

export async function fetchMeta() {
  const bust = Math.random().toString(36).slice(2);
  const r = await fetch(`${BASE}/meta.json?v=${bust}`);
  if (!r.ok) throw new Error(`meta.json fetch failed: ${r.status}`);
  return r.json();
}

export async function fetchPage(name, syncedAt) {
  const url = `${BASE}/${name}.json?v=${encodeURIComponent(syncedAt)}`;
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${name}.json fetch failed: ${r.status}`);
  if (OPTIONAL_PAGES.has(name) && r.headers.get('Content-Type')?.includes('text/html')) return null;
  return r.json();
}

export async function fetchHistoryIndex(syncedAt) {
  const url = `${BASE}/history/index.json?v=${encodeURIComponent(syncedAt)}`;
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`history/index.json fetch failed: ${r.status}`);
  return r.json();
}

export async function fetchHistoryYear(year, syncedAt) {
  const padded = String(year).padStart(3, '0');
  const url = `${BASE}/history/year-${padded}.json?v=${encodeURIComponent(syncedAt)}`;
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`history/year-${padded}.json fetch failed: ${r.status}`);
  return r.json();
}
