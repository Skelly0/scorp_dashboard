<script>
  import { theme, setTheme } from '../theme.js';

  const OPTIONS = [
    { value: 'light',     mood: 'Calm',      glyph: '☀' },
    { value: 'dark',      mood: 'Cosmic',    glyph: '☾' },
    { value: 'schematic', mood: 'Schematic', glyph: '⊞' },
  ];
</script>

<div
  class="inline-flex border-2 border-border font-mono text-[10px] uppercase tracking-widest"
  role="group"
  aria-label="Theme"
>
  {#each OPTIONS as opt}
    <button
      type="button"
      class="px-2 py-1 transition-colors leading-none"
      class:bg-border={$theme === opt.value}
      class:text-bg={$theme === opt.value}
      class:text-fg={$theme !== opt.value}
      class:hover:bg-border={$theme !== opt.value}
      class:hover:text-bg={$theme !== opt.value}
      aria-pressed={$theme === opt.value}
      aria-label="{opt.mood} theme"
      title="{opt.mood}"
      on:click={() => setTheme(opt.value)}
    >
      <span aria-hidden="true">{opt.glyph}</span>
      <span class="sr-only">{opt.mood}</span>
    </button>
  {/each}
</div>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
