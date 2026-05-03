<script>
  import { theme } from '../theme.js';
  import MoonLoader from './MoonLoader.svelte';

  // Per-theme opacity — dark needs a touch more presence to read against the
  // near-black bg; light/schematic float quietly behind cream paper.
  const OPACITY = { light: 0.22, dark: 0.32, schematic: 0.20 };

  let innerWidth = 1024;
  let innerHeight = 768;

  // Backdrop scales with the smaller viewport dimension so the moon stays
  // round and unscrolled regardless of aspect ratio.
  $: backdropSize = Math.round(Math.min(innerWidth, innerHeight) * 0.85);
  $: opacity = OPACITY[$theme] ?? 0.22;
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<div class="moon-backdrop" style="opacity: {opacity};" aria-hidden="true">
  <MoonLoader decorative size={backdropSize} />
</div>

<style>
  .moon-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
    transition: opacity 400ms ease;
  }
</style>
