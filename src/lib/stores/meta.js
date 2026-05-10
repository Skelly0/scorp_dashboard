import { writable } from 'svelte/store';
import { fetchMeta } from '../data.js';

export const meta = writable(null);
export const metaError = writable(null);

const EXPECTED_SCHEMA_VERSION = 10;

export async function loadMeta() {
  try {
    const data = await fetchMeta();
    if (data.schema_version !== EXPECTED_SCHEMA_VERSION) {
      metaError.set({
        kind: 'schema_mismatch',
        expected: EXPECTED_SCHEMA_VERSION,
        actual: data.schema_version,
      });
      return null;
    }
    meta.set(data);
    return data;
  } catch (err) {
    metaError.set({ kind: 'fetch_failed', message: err.message });
    return null;
  }
}
