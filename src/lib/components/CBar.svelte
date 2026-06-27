<script>
  // Census progress bar — a thin tone/colour-filled track. Mirrors the Census
  // mockup's `bar()` helper (7px track, soft border, absolute-positioned fill).
  import { toneVar } from '../census.js';

  export let value = 0; // fraction 0..1
  export let tone = null; // 'crit' | 'warn' | 'good' | 'muted' | null
  export let color = null; // explicit colour wins over tone
  export let height = 7;
  export let track = 'var(--bg-2)';

  $: frac =
    value == null || !Number.isFinite(value) ? 0 : Math.max(0, Math.min(1, value));
  $: fill = color ?? toneVar(tone);
</script>

<div class="cbar" style="height:{height}px; background:{track};" aria-hidden="true">
  <span style="width:{(frac * 100).toFixed(1)}%; background:{fill};"></span>
</div>

<style>
  .cbar {
    position: relative;
    border: 1px solid var(--border-soft);
  }
  .cbar > span {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    display: block;
  }
</style>
