<script>
  // Year scrubber for the Colony Command timeline. Reads the timeline store's
  // frame list + effective cursor and drives selectYear(). Includes a ▶ play
  // control that auto-advances through the available years (stops at the last).
  import { onDestroy } from 'svelte';
  import { frames, effectiveIdx, isLiveYear, selectYear } from '../stores/timeline.js';

  let playing = false;
  let timer = null;

  $: count = $frames.length;
  $: maxIdx = Math.max(0, count - 1);
  $: year = $frames[$effectiveIdx]?.year ?? null;
  $: canScrub = count > 1;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    playing = false;
  }

  function play() {
    if (timer || !canScrub) return;
    playing = true;
    timer = setInterval(() => {
      if ($effectiveIdx >= maxIdx) {
        stop();
        return;
      }
      selectYear($effectiveIdx + 1);
    }, 1100);
  }

  function togglePlay() {
    playing ? stop() : play();
  }

  function step(delta) {
    stop();
    selectYear(Math.max(0, Math.min(maxIdx, $effectiveIdx + delta)));
  }

  function onInput(event) {
    stop();
    selectYear(Number(event.target.value));
  }

  onDestroy(stop);
</script>

<div class="timeline">
  <span class="tl-label">Timeline</span>
  <button
    type="button"
    class="tl-play"
    on:click={togglePlay}
    disabled={!canScrub}
    aria-label={playing ? 'Pause timeline' : 'Play timeline'}
    aria-pressed={playing}
  >{playing ? '❚❚' : '▶'}</button>
  <button
    type="button"
    class="tl-step"
    on:click={() => step(-1)}
    disabled={!canScrub || $effectiveIdx <= 0}
    aria-label="Previous year"
  >◂</button>
  <input
    class="tl-range"
    type="range"
    min="0"
    max={maxIdx}
    value={$effectiveIdx}
    on:input={onInput}
    disabled={!canScrub}
    aria-label="Year"
  />
  <button
    type="button"
    class="tl-step"
    on:click={() => step(1)}
    disabled={!canScrub || $effectiveIdx >= maxIdx}
    aria-label="Next year"
  >▸</button>
  <span class="tl-year">{year ?? '—'}</span>
  <span class="tl-chip" class:live={$isLiveYear}>{$isLiveYear ? 'Live' : 'Archive'}</span>
</div>

<style>
  .timeline {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 8px 0;
  }
  .tl-label {
    font-size: 9.5px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .tl-play {
    background: var(--accent);
    color: var(--alert-fg, var(--bg));
    border: none;
    width: 30px;
    height: 28px;
    cursor: pointer;
    font-size: 11px;
    display: inline-grid;
    place-items: center;
    line-height: 1;
  }
  .tl-step {
    background: transparent;
    color: var(--fg);
    border: 1px solid var(--border-soft);
    width: 28px;
    height: 28px;
    cursor: pointer;
    line-height: 1;
  }
  .tl-step:hover:not(:disabled),
  .tl-play:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .tl-step:disabled,
  .tl-play:disabled,
  .tl-range:disabled {
    cursor: default;
    color: var(--muted);
  }
  .tl-range {
    flex: 1;
    min-width: 160px;
    accent-color: var(--accent);
    cursor: pointer;
  }
  .tl-year {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.08em;
    min-width: 54px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .tl-chip {
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
    border: 1px solid var(--border-soft);
    padding: 4px 8px;
  }
  .tl-chip.live {
    color: var(--good);
    border-color: var(--good);
  }
</style>
