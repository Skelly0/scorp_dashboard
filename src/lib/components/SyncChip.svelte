<script>
  import { meta } from '../stores/meta.js';
  import { isStale, formatSyncedAt } from '../sync-chip-utils.js';

  $: synced = $meta?.synced_at ?? null;
  $: stale = isStale(synced);
  $: label = formatSyncedAt(synced);
</script>

<span
  class="px-3 py-1 border-2 font-mono text-xs uppercase tracking-widest"
  class:border-border={!stale}
  class:text-fg={!stale}
  class:border-crit={stale}
  class:text-crit={stale}
  title={stale ? 'Sync is stale (> 3h old)' : 'Last sync time'}
>
  Synced {label}
</span>
