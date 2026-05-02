<script>
  import { createEventDispatcher, onMount, tick } from 'svelte';

  /** @type {{tiles: any[], width: number, height: number, palettes: any}} */
  export let mapData;
  /** active heatmap layer name, e.g. "terrain" | "food" | "energy" | ... */
  export let layer = 'terrain';

  const TILE_SIZE = 16;
  const dispatch = createEventDispatcher();

  let canvas;
  let focused = { x: 0, y: 0 };

  $: width = mapData.width * TILE_SIZE;
  $: height = mapData.height * TILE_SIZE;
  $: viewBox = `0 0 ${width} ${height}`;
  $: drawTerrain(mapData, layer);

  function tileColor(tile, layer, palettes) {
    if (layer === 'terrain') {
      return palettes.terrain[tile.terrain] || '#1a1a1a';
    }
    const v = tile.yields?.[layer] ?? 0;
    // Green for positive, red for negative, neutral for zero.
    if (v > 0) {
      const t = Math.min(1, v / 5);
      return `color-mix(in srgb, #38d39f ${t * 100}%, var(--bg))`;
    } else if (v < 0) {
      const t = Math.min(1, -v / 5);
      return `color-mix(in srgb, var(--crit) ${t * 100}%, var(--bg))`;
    }
    return 'var(--bg)';
  }

  async function drawTerrain(mapData, layer) {
    if (!mapData) return;
    await tick();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    for (const t of mapData.tiles) {
      ctx.fillStyle = tileColor(t, layer, mapData.palettes);
      ctx.fillRect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  function handleMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * mapData.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * mapData.height);
    focused = { x, y };
    dispatch('hover', tileAt(x, y));
  }

  function handleKey(e) {
    let { x, y } = focused;
    if (e.key === 'ArrowLeft') x = Math.max(0, x - 1);
    else if (e.key === 'ArrowRight') x = Math.min(mapData.width - 1, x + 1);
    else if (e.key === 'ArrowUp') y = Math.max(0, y - 1);
    else if (e.key === 'ArrowDown') y = Math.min(mapData.height - 1, y + 1);
    else if (e.key === 'Enter' || e.key === ' ') { dispatch('pin', tileAt(x, y)); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    focused = { x, y };
    dispatch('hover', tileAt(x, y));
  }

  function tileAt(x, y) {
    return mapData.tiles[y * mapData.width + x] ?? null;
  }

  function handleClick(e) {
    handleMove(e);
    dispatch('pin', tileAt(focused.x, focused.y));
  }
</script>

<div class="relative inline-block border-4 border-border" style="width: {width}px; height: {height}px;">
  <canvas
    bind:this={canvas}
    {width}
    {height}
    role="application"
    aria-label="Colony map: {mapData.width} by {mapData.height} grid"
    tabindex="0"
    on:mousemove={handleMove}
    on:click={handleClick}
    on:keydown={handleKey}
    class="block w-full h-full cursor-crosshair focus:outline focus:outline-2 focus:outline-accent"
  ></canvas>
  <svg {viewBox} class="absolute inset-0 pointer-events-none w-full h-full">
    <!-- Improvement icons (rendered as small inline glyphs by category). -->
    {#each mapData.tiles as t}
      {#if t.improvement}
        <text
          x={t.x * TILE_SIZE + TILE_SIZE / 2}
          y={t.y * TILE_SIZE + TILE_SIZE / 2}
          font-size={TILE_SIZE * 0.7}
          text-anchor="middle"
          dominant-baseline="central"
          fill="var(--fg)"
          opacity="0.85"
        >▣</text>
      {:else if t.feature}
        <text
          x={t.x * TILE_SIZE + TILE_SIZE / 2}
          y={t.y * TILE_SIZE + TILE_SIZE / 2}
          font-size={TILE_SIZE * 0.6}
          text-anchor="middle"
          dominant-baseline="central"
          fill="var(--accent)"
          opacity="0.85"
        >◆</text>
      {/if}
    {/each}
    <!-- Focus highlight -->
    <rect
      x={focused.x * TILE_SIZE}
      y={focused.y * TILE_SIZE}
      width={TILE_SIZE}
      height={TILE_SIZE}
      fill="none"
      stroke="var(--accent)"
      stroke-width="2"
    />
  </svg>
</div>
