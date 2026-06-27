<script>
  import { onMount } from 'svelte';
  import { meta } from '../lib/stores/meta.js';
  import { status, statusError } from '../lib/stores/status.js';
  import {
    loadTimeline,
    readCommandPersist,
    persistCommand,
  } from '../lib/stores/timeline.js';
  import { pageTitle } from '../lib/page-title.js';
  import PageState from '../lib/components/PageState.svelte';
  import TimelineBar from '../lib/components/TimelineBar.svelte';
  import ScanlineOverlay from '../lib/components/ScanlineOverlay.svelte';
  import CommandView from '../lib/components/command/CommandView.svelte';
  import TelemetryView from '../lib/components/telemetry/TelemetryView.svelte';

  const persisted = readCommandPersist();
  let view = persisted.view === 'telemetry' ? 'telemetry' : 'command';
  let scanlines = persisted.scanlines !== false; // default on

  function setView(next) {
    view = next;
    persistCommand({ view: next });
  }
  function toggleScanlines() {
    scanlines = !scanlines;
    persistCommand({ scanlines });
  }

  onMount(() => {
    pageTitle.set('Command');
    if ($meta?.synced_at) loadTimeline($meta.synced_at);
  });
</script>

<ScanlineOverlay enabled={scanlines} />

<section class="px-3 py-4 md:px-6 md:py-5 max-w-[1660px]">
  <PageState
    label="Command"
    page={['status', 'situations', 'parties']}
    error={$statusError}
    loading={!$status}
    loadingText="Reading colony command…"
    retry={() => loadTimeline($meta?.synced_at)}
  >
    <div class="cmd-subhead">
      <div class="cmd-tabs" role="tablist" aria-label="View">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'command'}
          class:active={view === 'command'}
          on:click={() => setView('command')}>Command</button
        >
        <button
          type="button"
          role="tab"
          aria-selected={view === 'telemetry'}
          class:active={view === 'telemetry'}
          on:click={() => setView('telemetry')}>Telemetry</button
        >
      </div>
      <div class="cmd-spacer"></div>
      <button
        type="button"
        class="cmd-scan"
        aria-pressed={scanlines}
        on:click={toggleScanlines}
        title="Toggle scanline overlay"
      >⊟ Scanlines · {scanlines ? 'On' : 'Off'}</button>
    </div>

    <TimelineBar />

    <div class="cmd-views">
      {#if view === 'command'}
        <CommandView />
      {:else}
        <TelemetryView />
      {/if}
    </div>
  </PageState>
</section>

<style>
  .cmd-subhead {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }
  .cmd-spacer {
    flex: 1 1 20px;
  }
  .cmd-tabs {
    display: flex;
    border: 1px solid var(--border-soft);
  }
  .cmd-tabs button {
    background: transparent;
    color: var(--fg-dim);
    border: none;
    border-right: 1px solid var(--border-soft);
    padding: 8px 16px;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    cursor: pointer;
    font-family: inherit;
  }
  .cmd-tabs button:last-child {
    border-right: none;
  }
  .cmd-tabs button:hover {
    color: var(--accent);
  }
  .cmd-tabs button.active {
    background: var(--accent);
    color: var(--alert-fg, var(--bg));
  }
  .cmd-scan {
    background: transparent;
    color: var(--fg-dim);
    border: 1px solid var(--border-soft);
    padding: 7px 11px;
    font-size: 9.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    cursor: pointer;
    font-family: inherit;
  }
  .cmd-scan:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
  .cmd-views {
    margin-top: 8px;
  }
</style>
