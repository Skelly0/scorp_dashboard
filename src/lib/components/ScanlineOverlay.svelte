<script>
  // Cosmetic CRT scanline layer for the mission-console mood. Fixed, full-bleed,
  // non-interactive, aria-hidden. Static stripes (no animation), so it is safe
  // under prefers-reduced-motion. Toggleable from the Command sub-header.
  export let enabled = true;
</script>

{#if enabled}
  <div class="scanlines" aria-hidden="true"></div>
{/if}

<style>
  .scanlines {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 6;
    background: repeating-linear-gradient(to bottom, var(--scanline) 0 1px, transparent 1px 3px);
  }
</style>
