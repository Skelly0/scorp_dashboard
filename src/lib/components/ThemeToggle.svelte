<script>
  import { theme, toggleTheme } from '../theme.js';
</script>

<button
  class="px-3 py-1 border-2 border-border bg-bg text-fg font-mono text-xs uppercase tracking-widest hover:bg-border hover:text-bg transition-colors"
  on:click={toggleTheme}
  aria-label="Toggle theme"
  title="Toggle theme"
>
  {$theme === 'light' ? '☾ Dark' : '☀ Light'}
</button>
