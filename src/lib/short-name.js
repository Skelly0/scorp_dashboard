// Deterministic short label for a party/federation name, used where a full name
// won't fit (matrix column heads, scatter bubbles, vote-bar segments). Drops
// articles/conjunctions and takes initials; a single-word name yields its first
// three letters. e.g. "The All Lunar Labor Bund" → "ALLB", "Independent" → "IND".

const STOP = new Set(['the', 'and', 'of', '&']);

export function abbrevName(name) {
  const words = String(name ?? '')
    .split(/[\s-]+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()));
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0].toUpperCase()).join('').slice(0, 4);
}
