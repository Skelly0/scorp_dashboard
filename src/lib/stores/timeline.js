// Colony Command timeline store. Composes the per-year frames (from history +
// live status) with a selected-year cursor, and exposes the loaders the route
// needs. Party stances and the active situation board are year-independent /
// live-only, so they ride along from their own stores in the components.

import { derived, writable } from 'svelte/store';
import { history, loadHistory } from './history.js';
import { status, loadStatus } from './status.js';
import { parties, loadParties } from './parties.js';
import { buildFrames } from '../timeline-frames.js';

const PERSIST_KEY = 'scorp.command';

export function readCommandPersist() {
  try {
    return JSON.parse(localStorage.getItem(PERSIST_KEY) || '{}');
  } catch {
    return {};
  }
}

export function persistCommand(patch) {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify({ ...readCommandPersist(), ...patch }));
  } catch {
    /* private mode / quota — non-fatal, selection just won't persist */
  }
}

// null = "follow the live (latest) year"; an integer pins a specific frame.
// Session-only: never persisted, so every fresh visit opens on the live year.
// (A legacy yearIdx left in scorp.command by older builds is simply ignored.)
export const selectedYearIdx = writable(null);

export const frames = derived([history, status], ([$history, $status]) =>
  buildFrames($history, $status),
);

export const frameCount = derived(frames, ($frames) => $frames.length);
export const liveIdx = derived(frames, ($frames) => ($frames.length ? $frames.length - 1 : 0));

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

// The index actually shown: follows live when unpinned, clamped to range.
export const effectiveIdx = derived([selectedYearIdx, frames], ([$selected, $frames]) => {
  if (!$frames.length) return 0;
  if ($selected == null) return $frames.length - 1;
  return clamp($selected, 0, $frames.length - 1);
});

export const currentFrame = derived([frames, effectiveIdx], ([$frames, $idx]) => $frames[$idx] ?? null);
export const prevFrame = derived([frames, effectiveIdx], ([$frames, $idx]) =>
  $idx > 0 ? $frames[$idx - 1] : null,
);

// True when the shown year is the live one (drives the Live/Archive chip and
// gates live-only surfaces: births, active situations).
export const isLiveYear = derived([effectiveIdx, frames], ([$idx, $frames]) =>
  $frames.length > 0 && $idx === $frames.length - 1,
);

export function selectYear(idx) {
  selectedYearIdx.set(idx == null ? null : Math.round(idx));
}

export function loadTimeline(syncedAt) {
  // Command calls this on every mount — reset so each visit opens live.
  selectedYearIdx.set(null);
  loadStatus(syncedAt);
  loadHistory(syncedAt);
  loadParties(syncedAt);
}

// Re-export the raw stores the route also reads directly.
export { status, history, parties };
