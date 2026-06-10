<script>
  import { meta } from '../stores/meta.js';
  import { isStale, formatSyncedAt } from '../sync-chip-utils.js';

  $: synced = $meta?.synced_at ?? null;
  $: stale = isStale(synced);
  $: failedPages = $meta?.partial_failures ?? [];
  $: partial = !stale && failedPages.length > 0;
  $: label = formatSyncedAt(synced);
  $: title = stale
    ? 'Sync is stale (> 3h old)'
    : partial
      ? `Partial sync — failed: ${failedPages.join(', ')}`
      : 'Last sync time';
</script>

<span
  class="px-3 py-1 border-2 font-mono text-xs uppercase tracking-widest"
  class:border-border={!stale && !partial}
  class:text-fg={!stale && !partial}
  class:border-crit={stale}
  class:text-crit={stale}
  class:border-warn={partial}
  class:text-warn={partial}
  {title}
>
  {#if partial}<span aria-hidden="true">⚠ </span><span class="sr-only">Partial sync failure — </span>{/if}Synced {label}
</span>
