export default {
  content: ['./index.html', './src/**/*.{svelte,js}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'Consolas', 'monospace'],
      },
      colors: {
        bg: 'var(--bg)',
        fg: 'var(--fg)',
        accent: 'var(--accent)',
        border: 'var(--border)',
        muted: 'var(--muted)',
        crit: 'var(--crit)',
        warn: 'var(--warn)',
        good: 'var(--good)',
      },
    },
  },
  plugins: [],
};
