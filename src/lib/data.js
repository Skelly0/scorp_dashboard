const BASE = './data';

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
  return r.json();
}
