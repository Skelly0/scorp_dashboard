<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { RESOURCE_CODES, FEATURE_CODES } from '../map-codes.js';
  import { categoryFor, getCategorySlug } from '../improvement-categories.js';
  import { catalog } from '../stores/catalog.js';
  import { goiColor, classColor, CLASS_COLORS } from '../faction-colors.js';
  import { ZOOM_DEFAULT, clampZoom } from '../map-zoom.js';

  /** @type {{tiles: any[], width: number, height: number, palettes: any}} */
  export let mapData;
  /** active heatmap layer name, e.g. "terrain" | "food" | "energy" | ... */
  export let layer = 'terrain';
  /** active overlay tab name; controls overlay visibility/promotion (today equals `layer`). */
  export let tab = 'terrain';
  export let filters = { resource: null, feature: null, improvement: null };
  export let zoom = ZOOM_DEFAULT;
  /** Bumping this triggers a redraw — Map.svelte sets it to the current theme name. */
  export let redrawKey = '';

  function parseLayer(layer) {
    if (!layer) return { category: null, key: null };
    if (layer.includes(':')) {
      const [category, ...rest] = layer.split(':');
      return { category, key: rest.join(':') };
    }
    // 'terrain', 'staffing', 'resources', 'features', 'improvements'
    return { category: layer, key: null };
  }

  const BASE_TILE = 16;          // drawing-coordinate size; never changes.
  const dispatch = createEventDispatcher();

  let canvas;
  let focused = { x: 0, y: 0 };
  let viewportClientWidth = 0;

  $: nativeMapW = mapData.width * BASE_TILE;
  $: nativeMapH = mapData.height * BASE_TILE;
  $: fitScale = viewportClientWidth > 0
    ? viewportClientWidth / nativeMapW
    : 1;
  $: displayScale = (() => {
    const z = clampZoom(zoom);
    const raw = fitScale * z;
    // Hard floor protects against pathological narrow viewports.
    return Math.max(0.25, raw);
  })();
  $: contentCssW = nativeMapW * displayScale;
  $: contentCssH = nativeMapH * displayScale;
  $: viewBox = `0 0 ${nativeMapW} ${nativeMapH}`; // unchanged shape, BASE_TILE coords
  $: resourcePal = mapData.palettes.resource ?? {};
  $: featurePal  = mapData.palettes.feature  ?? {};
  $: improvementCatPal = mapData.palettes.improvement_category ?? {};
  // Recompute per-layer max for heatmap normalisation whenever map or layer changes.
  $: layerMax = computeLayerMax(mapData, layer);
  $: anyFilterActive = !!(filters.resource || filters.feature || filters.improvement);
  $: ringColor = (() => {
    if (!anyFilterActive) return null;
    if (filters.resource) return resourcePal[filters.resource] ?? '#ffb000';
    if (filters.feature)  return featurePal[filters.feature]  ?? '#ffb000';
    if (filters.improvement) return improvementCatPal[filters.improvement] ?? '#ffb000';
    return '#ffb000';
  })();
  $: drawTerrain(mapData, layer, layerMax, filters, displayScale, redrawKey);
  // Redraw when the catalog arrives so tile colours reflect catalog-derived slugs,
  // not stale regex-derived slugs (gotcha 14 in CLAUDE.md).
  $: if ($catalog) { drawTerrain(mapData, layer, layerMax, filters, displayScale, redrawKey); }

  function tileMatches(t, f) {
    if (f.resource && t.resource !== f.resource) return false;
    if (f.feature && t.feature !== f.feature) return false;
    if (f.improvement) {
      if (!t.improvement) return false;
      return getCategorySlug(t.improvement.name, $catalog) === f.improvement;
    }
    return true;
  }

  function bgWithAlpha(bg) {
    // Resolve to #rrggbb form for the canvas alpha-tint trick. Falls back
    // to a neutral rgba black if the theme bg isn't a pure 6-digit hex.
    if (/^#[0-9a-f]{6}$/i.test(bg)) return bg + 'b3';
    return 'rgba(0,0,0,0.7)';
  }

  function computeLayerMax(mapData, layer) {
    if (!mapData) return { pos: 0, neg: 0, max: 0 };
    const { category, key } = parseLayer(layer);

    if (category === 'yield' && key) {
      let pos = 0, neg = 0;
      for (const t of mapData.tiles) {
        const v = t.yields?.[key] ?? 0;
        if (v > pos) pos = v;
        if (v < neg) neg = v;
      }
      return { pos, neg: Math.abs(neg), max: 0 };
    }
    if (category === 'upkeep' && key) {
      let max = 0;
      for (const t of mapData.tiles) {
        const v = t.upkeep?.[key] ?? 0;
        if (v > max) max = v;
      }
      return { pos: 0, neg: 0, max };
    }
    if (category === 'workforce' && key) {
      let max = 0;
      for (const t of mapData.tiles) {
        const v = t.workforce?.[key] ?? 0;
        if (v > max) max = v;
      }
      return { pos: 0, neg: 0, max };
    }
    if (category === 'staffing') {
      return { pos: 0, neg: 0, max: 1 };  // 0..1 scalar; max is fixed
    }
    return { pos: 0, neg: 0, max: 0 };
  }

  function tileColor(tile, layer, palettes, layerMax, theme) {
    const { category, key } = parseLayer(layer);

    if (category === 'terrain' || category === null) {
      return palettes.terrain[tile.terrain] || theme.bg;
    }

    // YIELD: existing diverging green/red.
    if (category === 'yield' && key) {
      const v = tile.yields?.[key] ?? 0;
      if (v > 0 && layerMax.pos > 0) {
        const t = Math.max(0.15, v / layerMax.pos);
        return `color-mix(in srgb, ${theme.good} ${(t * 100).toFixed(1)}%, ${theme.bg})`;
      }
      if (v < 0 && layerMax.neg > 0) {
        const t = Math.max(0.15, -v / layerMax.neg);
        return `color-mix(in srgb, ${theme.crit} ${(t * 100).toFixed(1)}%, ${theme.bg})`;
      }
      return theme.bg;
    }

    // UPKEEP: single red gradient 0 → max.
    if (category === 'upkeep' && key) {
      const v = tile.upkeep?.[key] ?? 0;
      if (v > 0 && layerMax.max > 0) {
        const t = Math.max(0.15, v / layerMax.max);
        return `color-mix(in srgb, ${theme.crit} ${(t * 100).toFixed(1)}%, ${theme.bg})`;
      }
      return theme.bg;
    }

    // WORKFORCE: single class-accent gradient.
    if (category === 'workforce' && key) {
      const v = tile.workforce?.[key] ?? 0;
      if (v > 0 && layerMax.max > 0) {
        const swatch = resolveClassColor(key, theme);
        const t = Math.max(0.15, v / layerMax.max);
        return `color-mix(in srgb, ${swatch} ${(t * 100).toFixed(1)}%, ${theme.bg})`;
      }
      return theme.bg;
    }

    // STAFFING: red → amber → green diverging at 0.5.
    if (category === 'staffing') {
      const v = tile.staffing;
      if (v == null) return theme.bg;
      if (v < 0.5) {
        const t = v * 2;  // 0 → 1 across the lower half
        return `color-mix(in srgb, ${theme.amber} ${(t * 100).toFixed(1)}%, ${theme.crit})`;
      } else {
        const t = (v - 0.5) * 2;  // 0 → 1 across the upper half
        return `color-mix(in srgb, ${theme.good} ${(t * 100).toFixed(1)}%, ${theme.amber})`;
      }
    }

    return theme.bg;
  }

  function resolveClassColor(name, theme) {
    const c = CLASS_COLORS[name];
    // CLASS_COLORS values are concrete hex. For unknown classes the helper
    // returns 'var(--accent)', which canvas fillStyle cannot resolve — substitute
    // the pre-resolved amber token instead.
    return c ?? theme.amber;
  }

  // displayScale and _redrawKey are reactive deps; the body reads displayScale from
  // closure scope (it's a $: reactive at module level), and _redrawKey just keeps
  // the canvas in sync with theme flips even when none of the data inputs changed.
  async function drawTerrain(mapData, layer, layerMax, filters, displayScale, _redrawKey) {
    if (!mapData) return;
    await tick();
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = mapData.width * BASE_TILE * displayScale;
    const cssH = mapData.height * BASE_TILE * displayScale;

    // Backing store sized to logical-pixel × DPR for crisp rendering.
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    // Pre-resolve theme tokens (CLAUDE.md gotcha #14 — canvas fillStyle does
    // not resolve var(--…)).
    const styles = getComputedStyle(canvas);
    const theme = {
      bg:    styles.getPropertyValue('--bg').trim()    || '#0a0a0a',
      crit:  styles.getPropertyValue('--crit').trim()  || '#ff4d4d',
      good:  styles.getPropertyValue('--good').trim()  || '#38d39f',
      amber: styles.getPropertyValue('--accent').trim()|| '#ffb000',
    };

    const ctx = canvas.getContext('2d');
    // One transform handles both display-scale and DPR; drawing code stays in
    // BASE_TILE coordinates regardless of zoom.
    ctx.setTransform(displayScale * dpr, 0, 0, displayScale * dpr, 0, 0);
    ctx.clearRect(0, 0, mapData.width * BASE_TILE, mapData.height * BASE_TILE);

    for (const t of mapData.tiles) {
      ctx.fillStyle = tileColor(t, layer, mapData.palettes, layerMax, theme);
      ctx.fillRect(t.x * BASE_TILE, t.y * BASE_TILE, BASE_TILE, BASE_TILE);
    }

    if (filters && (filters.resource || filters.feature || filters.improvement)) {
      ctx.fillStyle = bgWithAlpha(theme.bg);
      for (const t of mapData.tiles) {
        if (!tileMatches(t, filters)) {
          ctx.fillRect(t.x * BASE_TILE, t.y * BASE_TILE, BASE_TILE, BASE_TILE);
        }
      }
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
    // Don't intercept browser zoom or any modifier-prefixed shortcuts.
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Zoom shortcuts.
    if (e.key === '+' || e.key === '=') {
      dispatch('zoomstep', { delta: +1 });
      e.preventDefault();
      return;
    }
    if (e.key === '-' || e.key === '_') {
      dispatch('zoomstep', { delta: -1 });
      e.preventDefault();
      return;
    }
    if (e.key === '0') {
      dispatch('zoomstep', { reset: true });
      e.preventDefault();
      return;
    }

    // Existing arrow + Enter/Space behaviour follows.
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

  function ownerColor(owner) {
    if (!owner) return null;
    // Try GoI palette first; fall back to class palette. Both helpers
    // return 'var(--accent)' on miss — that string doesn't resolve in SVG
    // presentation attributes (gotcha #14), so we filter it out and let
    // the caller's ?? chain fall through to the category-palette colour.
    const g = goiColor(owner);
    if (g !== 'var(--accent)') return g;
    const c = classColor(owner);
    if (c !== 'var(--accent)') return c;
    return null;
  }

  function handleClick(e) {
    handleMove(e);
    dispatch('pin', tileAt(focused.x, focused.y));
  }
</script>

<div class="map-canvas-wrap">
  <div
    class="map-viewport relative border-4 border-border focus:outline focus:outline-2 focus:outline-accent"
    bind:clientWidth={viewportClientWidth}
    tabindex="0"
    on:keydown={handleKey}
  >
    <div
      class="map-content relative"
      style="width: {contentCssW}px; height: {contentCssH}px;"
    >
      <canvas
        bind:this={canvas}
        style="width: 100%; height: 100%;"
        role="application"
        aria-label="Colony map: {mapData.width} by {mapData.height} grid"
        on:mousemove={handleMove}
        on:click={handleClick}
        class="block w-full h-full cursor-crosshair"
      ></canvas>
      <svg {viewBox} class="absolute inset-0 pointer-events-none w-full h-full">
        <!-- Improvement / feature icons. Stroke renders behind fill via paint-order
             so icons stay legible against any terrain colour or theme. -->
        {#each mapData.tiles as t}
          {#if t.improvement}
            {#if tab === 'improvements'}
              {@const cat = categoryFor(t.improvement, $catalog)}
              {@const fill = ownerColor(t.improvement.owner) ?? improvementCatPal[cat.slug] ?? '#ffffff'}
              <text
                x={t.x * BASE_TILE + BASE_TILE / 2}
                y={t.y * BASE_TILE + BASE_TILE / 2}
                font-size={BASE_TILE * 0.85}
                font-weight="900"
                text-anchor="middle"
                dominant-baseline="central"
                class="map-glyph map-glyph--improvement"
                fill={fill}
              >{cat.icon}</text>
            {:else}
              <text
                x={t.x * BASE_TILE + BASE_TILE / 2}
                y={t.y * BASE_TILE + BASE_TILE / 2}
                font-size={BASE_TILE * 0.85}
                font-weight="900"
                text-anchor="middle"
                dominant-baseline="central"
                class="map-glyph map-glyph--improvement"
              >▣</text>
            {/if}
          {/if}
        {/each}
        <!-- Resource overlay (top-right). Chip-style on Resources tab; dot-style elsewhere. -->
        {#each mapData.tiles as t}
          {#if t.resource}
            {#if tab === 'resources'}
              <g>
                <rect
                  x={t.x * BASE_TILE + BASE_TILE - 11}
                  y={t.y * BASE_TILE + 1}
                  width="10"
                  height="8"
                  fill={resourcePal[t.resource] ?? '#ffffff'}
                  stroke="rgba(0,0,0,0.6)"
                  stroke-width="0.5"
                />
                <text
                  x={t.x * BASE_TILE + BASE_TILE - 6}
                  y={t.y * BASE_TILE + 5.2}
                  font-size="6"
                  font-weight="900"
                  text-anchor="middle"
                  dominant-baseline="central"
                  fill="#1a1a1a"
                >{RESOURCE_CODES[t.resource] ?? '?'}</text>
              </g>
            {:else}
              <circle
                cx={t.x * BASE_TILE + BASE_TILE - 4}
                cy={t.y * BASE_TILE + 4}
                r="2.5"
                fill={resourcePal[t.resource] ?? '#ffffff'}
                stroke="rgba(0,0,0,0.6)"
                stroke-width="0.5"
              />
            {/if}
          {/if}
        {/each}
        <!-- Feature overlay (top-left). Chip-style on Features tab; dot-style elsewhere. -->
        {#each mapData.tiles as t}
          {#if t.feature}
            {#if tab === 'features'}
              <g>
                <rect
                  x={t.x * BASE_TILE + 1}
                  y={t.y * BASE_TILE + 1}
                  width="10"
                  height="8"
                  fill={featurePal[t.feature] ?? '#ffffff'}
                  stroke="rgba(0,0,0,0.6)"
                  stroke-width="0.5"
                />
                <text
                  x={t.x * BASE_TILE + 6}
                  y={t.y * BASE_TILE + 5.2}
                  font-size="6"
                  font-weight="900"
                  text-anchor="middle"
                  dominant-baseline="central"
                  fill="#1a1a1a"
                >{FEATURE_CODES[t.feature] ?? '?'}</text>
              </g>
            {:else}
              <rect
                x={t.x * BASE_TILE + 1.5}
                y={t.y * BASE_TILE + 1.5}
                width="5"
                height="5"
                fill={featurePal[t.feature] ?? '#ffffff'}
                stroke="rgba(0,0,0,0.6)"
                stroke-width="0.5"
              />
            {/if}
          {/if}
        {/each}
        <!-- Focus highlight -->
        <rect
          x={focused.x * BASE_TILE}
          y={focused.y * BASE_TILE}
          width={BASE_TILE}
          height={BASE_TILE}
          fill="none"
          stroke="var(--accent)"
          stroke-width="2"
        />
        {#if anyFilterActive}
          {#each mapData.tiles as t}
            {#if tileMatches(t, filters)}
              <rect
                x={t.x * BASE_TILE + 0.5}
                y={t.y * BASE_TILE + 0.5}
                width={BASE_TILE - 1}
                height={BASE_TILE - 1}
                fill="none"
                stroke={ringColor}
                stroke-width="2"
              />
            {/if}
          {/each}
        {/if}
      </svg>
    </div>
  </div>

  {#if layer !== 'terrain' && layer !== 'resources' && layer !== 'features' && layer !== 'improvements'}
    {@const parsed = parseLayer(layer)}
    <div class="font-mono text-xs uppercase tracking-widest text-muted mt-2 flex items-center gap-3">
      {#if parsed.category === 'yield'}
        <span class="capitalize">{parsed.key} yield —</span>
        {#if layerMax.pos > 0}
          <span>0 to <strong class="text-fg">+{layerMax.pos.toFixed(1)}</strong></span>
          <span class="inline-block w-4 h-3 border border-border" style="background: var(--good)"></span>
        {/if}
        {#if layerMax.neg > 0}
          <span>0 to <strong class="text-fg">-{layerMax.neg.toFixed(1)}</strong></span>
          <span class="inline-block w-4 h-3 border border-border" style="background: var(--crit)"></span>
        {/if}
        {#if layerMax.pos === 0 && layerMax.neg === 0}
          <span>(no tiles produce or consume {parsed.key})</span>
        {/if}
      {:else if parsed.category === 'upkeep'}
        <span class="capitalize">{parsed.key} upkeep —</span>
        {#if layerMax.max > 0}
          <span>0 to <strong class="text-fg">{layerMax.max.toFixed(1)}</strong></span>
          <span class="inline-block w-4 h-3 border border-border" style="background: var(--crit)"></span>
        {:else}
          <span>(no tiles consume {parsed.key})</span>
        {/if}
      {:else if parsed.category === 'workforce'}
        <span>{parsed.key} —</span>
        {#if layerMax.max > 0}
          <span>0 to <strong class="text-fg">{layerMax.max}</strong></span>
          <span class="inline-block w-4 h-3 border border-border" style="background: {CLASS_COLORS[parsed.key] ?? 'var(--accent)'}"></span>
        {:else}
          <span>(no tiles employ {parsed.key})</span>
        {/if}
      {:else if parsed.category === 'staffing'}
        <span>Staffing —</span>
        <span>0% to 100%</span>
        <span class="inline-block w-12 h-3 border border-border" style="background: linear-gradient(90deg, var(--crit) 0%, var(--accent) 50%, var(--good) 100%)"></span>
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
</style>
