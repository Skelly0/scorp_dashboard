<script>
  import { createEventDispatcher, tick } from 'svelte';

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
  // Recompute per-layer max for heatmap normalisation whenever map or layer changes.
  $: layerMax = computeLayerMax(mapData, layer);
  $: drawTerrain(mapData, layer, layerMax);

  function computeLayerMax(mapData, layer) {
    if (!mapData || layer === 'terrain') return { pos: 0, neg: 0 };
    let pos = 0;
    let neg = 0;
    for (const t of mapData.tiles) {
      const v = t.yields?.[layer] ?? 0;
      if (v > pos) pos = v;
      if (v < neg) neg = v;
    }
    return { pos, neg: Math.abs(neg) };
  }

  function tileColor(tile, layer, palettes, layerMax) {
    if (layer === 'terrain') {
      return palettes.terrain[tile.terrain] || '#1a1a1a';
    }
    const v = tile.yields?.[layer] ?? 0;
    if (v > 0 && layerMax.pos > 0) {
      const t = Math.max(0.15, v / layerMax.pos);  // floor at 15% so non-zero is always visible
      return `color-mix(in srgb, #38d39f ${(t * 100).toFixed(1)}%, var(--bg))`;
    } else if (v < 0 && layerMax.neg > 0) {
      const t = Math.max(0.15, -v / layerMax.neg);
      return `color-mix(in srgb, var(--crit) ${(t * 100).toFixed(1)}%, var(--bg))`;
    }
    return 'var(--bg)';
  }

  async function drawTerrain(mapData, layer, layerMax) {
    if (!mapData) return;
    await tick();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    for (const t of mapData.tiles) {
      ctx.fillStyle = tileColor(t, layer, mapData.palettes, layerMax);
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

<div class="map-canvas-wrap">
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
      <!-- Improvement / feature icons. Stroke renders behind fill via paint-order
           so icons stay legible against any terrain colour or theme. -->
      {#each mapData.tiles as t}
        {#if t.improvement}
          <text
            x={t.x * TILE_SIZE + TILE_SIZE / 2}
            y={t.y * TILE_SIZE + TILE_SIZE / 2}
            font-size={TILE_SIZE * 0.85}
            font-weight="900"
            text-anchor="middle"
            dominant-baseline="central"
            class="map-glyph map-glyph--improvement"
          >▣</text>
        {:else if t.feature}
          <text
            x={t.x * TILE_SIZE + TILE_SIZE / 2}
            y={t.y * TILE_SIZE + TILE_SIZE / 2}
            font-size={TILE_SIZE * 0.7}
            font-weight="900"
            text-anchor="middle"
            dominant-baseline="central"
            class="map-glyph map-glyph--feature"
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

  {#if layer !== 'terrain'}
    <div class="font-mono text-xs uppercase tracking-widest text-muted mt-2 flex items-center gap-3">
      <span class="capitalize">{layer} yield —</span>
      {#if layerMax.pos > 0}
        <span>0 to <strong class="text-fg">+{layerMax.pos.toFixed(1)}</strong></span>
        <span class="inline-block w-4 h-3 border border-border" style="background: #38d39f"></span>
      {/if}
      {#if layerMax.neg > 0}
        <span>0 to <strong class="text-fg">-{layerMax.neg.toFixed(1)}</strong></span>
        <span class="inline-block w-4 h-3 border border-border" style="background: var(--crit)"></span>
      {/if}
      {#if layerMax.pos === 0 && layerMax.neg === 0}
        <span>(no tiles produce or consume {layer})</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Stroke-behind-fill outline keeps glyphs legible on any tile colour. */
  .map-glyph {
    paint-order: stroke fill;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .map-glyph--improvement {
    fill: var(--bg);
    stroke: var(--fg);
    stroke-width: 2.5;
  }
  .map-glyph--feature {
    fill: var(--accent);
    stroke: var(--bg);
    stroke-width: 2.5;
  }
</style>
