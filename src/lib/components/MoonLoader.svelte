<script>
  import { onMount, onDestroy } from 'svelte';
  import { theme } from '../theme.js';
  import moonTextureUrl from '../assets/moon-equirect.png';

  export let size = 320;
  export let label = 'Loading';
  export let decorative = false;

  // Per-mood visual identity, ported from Wireframe Moon Loader.html.
  // ink/bg are read from the global theme, so the moon adapts automatically.
  const MOODS = {
    light: {
      LINE:       'rgba(42,42,42,0.62)',
      LINE_SOFT:  'rgba(42,42,42,0.42)',
      LINE_FAINT: 'rgba(42,42,42,0.20)',
      DISK_FILL:  'rgba(42,42,42,0.025)',
      RING_INK:   '#2a2a2a',
      OUTLINE_W:  1.2,
      GRAT_W:     0.7,
      C_W:        [1.0, 0.8, 0.6],
      GRAT_STEP:  [20, 15],
      SPEED:      12,
      LEVELS:     [0.30, 0.42, 0.55],
      DETAIL:     1.0,
    },
    dark: {
      LINE:       'rgba(232,230,223,1.0)',
      LINE_SOFT:  'rgba(232,230,223,0.55)',
      LINE_FAINT: 'rgba(232,230,223,0.18)',
      DISK_FILL:  'rgba(232,230,223,0.05)',
      RING_INK:   '#e8e6df',
      OUTLINE_W:  1.1,
      GRAT_W:     0.6,
      C_W:        [0.4, 0.7, 1.0, 1.4],
      GRAT_STEP:  [30, 20],
      SPEED:      8,
      LEVELS:     [0.58, 0.50, 0.42, 0.32],
      DETAIL:     0.30,
    },
    schematic: {
      LINE:       'rgba(14,58,138,0.7)',
      LINE_SOFT:  'rgba(14,58,138,0.5)',
      LINE_FAINT: 'rgba(14,58,138,0.28)',
      DISK_FILL:  'rgba(14,58,138,0.03)',
      RING_INK:   '#0e3a8a',
      OUTLINE_W:  1.4,
      GRAT_W:     0.85,
      C_W:        [1.1, 0.9, 0.7, 0.55],
      GRAT_STEP:  [15, 12],
      SPEED:      14,
      LEVELS:     [0.28, 0.38, 0.48, 0.58],
      DETAIL:     1.0,
    },
  };

  const SIZE = 440; // canvas pixel size — drawn into smaller CSS box for crispness
  const PAD = 10;
  const RADIUS = SIZE / 2 - PAD;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const TW = 360;
  const TH = 180;

  let canvas;
  let lum = null;
  let textureFailed = false;
  let rafId = null;
  let rotation = 0;
  let last = 0;
  let currentTheme = 'light';
  $: currentTheme = $theme in MOODS ? $theme : 'light';

  // Cache for marching-squares contour segments and graticule polylines.
  // Computed once per (level / step), reused across frames.
  const contourCache = new Map();
  const gratCache = new Map();

  function blur(buf, w, h, passes = 2) {
    const tmp = new Float32Array(buf.length);
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const a = buf[y * w + ((x - 1 + w) % w)];
        const b = buf[i];
        const c = buf[y * w + ((x + 1) % w)];
        tmp[i] = (a + 2 * b + c) / 4;
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const a = tmp[Math.max(0, y - 1) * w + x];
        const b = tmp[i];
        const c = tmp[Math.min(h - 1, y + 1) * w + x];
        buf[i] = (a + 2 * b + c) / 4;
      }
    }
  }

  function getContour(level) {
    const k = level.toFixed(3);
    if (contourCache.has(k)) return contourCache.get(k);
    const segs = [];
    if (!lum) {
      contourCache.set(k, segs);
      return segs;
    }
    for (let y = 0; y < TH - 1; y++) for (let x = 0; x < TW - 1; x++) {
      const a = lum[y * TW + x];
      const b = lum[y * TW + x + 1];
      const c = lum[(y + 1) * TW + x + 1];
      const d = lum[(y + 1) * TW + x];
      let idx = 0;
      if (a > level) idx |= 1;
      if (b > level) idx |= 2;
      if (c > level) idx |= 4;
      if (d > level) idx |= 8;
      if (idx === 0 || idx === 15) continue;
      const lerp = (v0, v1) => (level - v0) / (v1 - v0);
      const tT = (idx & 1) !== ((idx & 2) >> 1) ? lerp(a, b) : null;
      const tR = ((idx & 2) >> 1) !== ((idx & 4) >> 2) ? lerp(b, c) : null;
      const tB = ((idx & 8) >> 3) !== ((idx & 4) >> 2) ? lerp(d, c) : null;
      const tL = (idx & 1) !== ((idx & 8) >> 3) ? lerp(a, d) : null;
      const pT = tT !== null ? [x + tT, y]     : null;
      const pR = tR !== null ? [x + 1, y + tR] : null;
      const pB = tB !== null ? [x + tB, y + 1] : null;
      const pL = tL !== null ? [x,     y + tL] : null;
      const pairs = [];
      switch (idx) {
        case 1:  case 14: pairs.push([pL, pT]); break;
        case 2:  case 13: pairs.push([pT, pR]); break;
        case 3:  case 12: pairs.push([pL, pR]); break;
        case 4:  case 11: pairs.push([pR, pB]); break;
        case 5:           pairs.push([pL, pT], [pR, pB]); break;
        case 6:  case 9:  pairs.push([pT, pB]); break;
        case 7:  case 8:  pairs.push([pL, pB]); break;
        case 10:          pairs.push([pT, pR], [pL, pB]); break;
      }
      for (const [p1, p2] of pairs) {
        if (!p1 || !p2) continue;
        const lon1 = (p1[0] / (TW - 1)) * 360 - 180;
        const lat1 = 90 - (p1[1] / (TH - 1)) * 180;
        const lon2 = (p2[0] / (TW - 1)) * 360 - 180;
        const lat2 = 90 - (p2[1] / (TH - 1)) * 180;
        segs.push([lon1, lat1, lon2, lat2]);
      }
    }
    contourCache.set(k, segs);
    return segs;
  }

  function getGraticule([sLon, sLat]) {
    const k = `${sLon},${sLat}`;
    if (gratCache.has(k)) return gratCache.get(k);
    const polylines = [];
    for (let lon = -180; lon < 180; lon += sLon) {
      const line = [];
      for (let lat = -80; lat <= 80; lat += 4) line.push([lon, lat]);
      polylines.push(line);
    }
    for (let lat = -75; lat <= 75; lat += sLat) {
      const line = [];
      for (let lon = -180; lon <= 180; lon += 4) line.push([lon, lat]);
      polylines.push(line);
    }
    gratCache.set(k, polylines);
    return polylines;
  }

  function project(lon, lat, rotRad) {
    const lam = lon * Math.PI / 180;
    const phi = lat * Math.PI / 180;
    const x = Math.cos(phi) * Math.sin(lam);
    const y = Math.sin(phi);
    const z = Math.cos(phi) * Math.cos(lam);
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);
    const x1 =  x * cosR + z * sinR;
    const z1 = -x * sinR + z * cosR;
    if (z1 < 0) return null;
    return [CX + x1 * RADIUS, CY - y * RADIUS, z1];
  }

  function strokePolyline(ctx, points, rotRad, color, width) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    let started = false;
    for (let i = 0; i < points.length; i++) {
      const p = project(points[i][0], points[i][1], rotRad);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
      else          { ctx.lineTo(p[0], p[1]); }
    }
    ctx.stroke();
  }

  function strokeSegments(ctx, segs, rotRad, color, width) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const p1 = project(s[0], s[1], rotRad);
      const p2 = project(s[2], s[3], rotRad);
      if (!p1 || !p2) continue;
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
    }
    ctx.stroke();
  }

  function fadeColor(rgba, t) {
    const m = rgba.match(/rgba?\(([^)]+)\)/);
    if (!m) return rgba;
    const parts = m[1].split(',').map((s) => s.trim());
    const r = parts[0], g = parts[1], b = parts[2];
    const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
    return `rgba(${r},${g},${b},${(a * t).toFixed(3)})`;
  }

  function getInk() {
    const root = document.documentElement;
    const themed = getComputedStyle(root).getPropertyValue('--fg').trim();
    return themed || MOODS[currentTheme].RING_INK;
  }

  function draw(rotDeg) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const m = MOODS[currentTheme];
    const rot = (rotDeg * Math.PI) / 180;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Soft disk wash
    ctx.beginPath();
    ctx.arc(CX, CY, RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = m.DISK_FILL;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, RADIUS, 0, Math.PI * 2);
    ctx.clip();

    const grat = getGraticule(m.GRAT_STEP);
    for (const line of grat) strokePolyline(ctx, line, rot, m.LINE_FAINT, m.GRAT_W);

    if (lum && !textureFailed) {
      const d = m.DETAIL;
      const levels = m.LEVELS;
      const widths = m.C_W;
      const colors = [m.LINE, m.LINE_SOFT, m.LINE_FAINT, m.LINE_FAINT];
      const maxLevels = levels.length;
      for (let i = 0; i < maxLevels; i++) {
        const start = i / maxLevels;
        const end = (i + 0.6) / maxLevels;
        const t = Math.max(0, Math.min(1, (d - start) / (end - start)));
        if (t <= 0) continue;
        const segs = getContour(levels[i]);
        const baseColor = colors[Math.min(i, colors.length - 1)];
        strokeSegments(ctx, segs, rot, fadeColor(baseColor, t), widths[Math.min(i, widths.length - 1)]);
      }
    }

    ctx.restore();

    // Limb outline
    ctx.beginPath();
    ctx.arc(CX, CY, RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = getInk();
    ctx.lineWidth = m.OUTLINE_W;
    ctx.stroke();
  }

  function prefersReducedMotion() {
    return typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function tick(now) {
    if (last === 0) last = now;
    const dt = (now - last) / 1000;
    last = now;
    rotation = (rotation + MOODS[currentTheme].SPEED * dt) % 360;
    draw(rotation);
    rafId = requestAnimationFrame(tick);
  }

  async function loadTexture() {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const off = document.createElement('canvas');
        off.width = TW;
        off.height = TH;
        const offCtx = off.getContext('2d');
        offCtx.drawImage(img, 0, 0, TW, TH);
        const src = offCtx.getImageData(0, 0, TW, TH).data;
        const buf = new Float32Array(TW * TH);
        for (let i = 0; i < TW * TH; i++) buf[i] = src[i * 4] / 255;
        blur(buf, TW, TH, 2);
        lum = buf;
        contourCache.clear();
        resolve();
      };
      img.onerror = () => {
        textureFailed = true;
        resolve();
      };
      img.src = moonTextureUrl;
    });
  }

  // Theme change → redraw immediately so the limb outline picks up new --fg.
  $: if (canvas && currentTheme) draw(rotation);

  onMount(async () => {
    await loadTexture();
    draw(0);
    last = 0;
    if (!prefersReducedMotion()) {
      rafId = requestAnimationFrame(tick);
    }
  });

  onDestroy(() => {
    if (rafId !== null) cancelAnimationFrame(rafId);
  });

  $: ringInk = MOODS[currentTheme].RING_INK;
</script>

<div
  class="moon-loader"
  role={decorative ? undefined : 'status'}
  aria-label={decorative ? undefined : label}
  aria-hidden={decorative ? 'true' : undefined}
  style="--moon-size: {size}px; --ring-ink: {ringInk};"
>
  <div class="whirl" aria-hidden="true">
    <svg viewBox="0 0 320 320" preserveAspectRatio="xMidYMid meet">
      <g class="ring ring-cw-14" style="transform-origin: 50% 50%;">
        <circle
          cx="160" cy="160" r="150"
          fill="none" stroke="var(--ring-ink)"
          stroke-width="0.9" stroke-dasharray="1 9"
          stroke-linecap="round" opacity="0.55"
        />
      </g>
      <g class="ring ring-ccw-22" style="transform-origin: 50% 50%;">
        <circle
          cx="160" cy="160" r="132"
          fill="none" stroke="var(--ring-ink)"
          stroke-width="1" stroke-dasharray="16 12"
          opacity="0.35"
        />
      </g>
      <g class="ring ring-cw-32" style="transform-origin: 50% 50%;">
        <circle
          cx="160" cy="160" r="118"
          fill="none" stroke="var(--ring-ink)"
          stroke-width="0.7" stroke-dasharray="0.5 5"
          stroke-linecap="round" opacity="0.7"
        />
      </g>
    </svg>
  </div>
  <canvas
    bind:this={canvas}
    width={SIZE}
    height={SIZE}
    class="globe"
  ></canvas>
  {#if !decorative}
    <span class="sr-only">{label}</span>
  {/if}
</div>

<style>
  .moon-loader {
    position: relative;
    width: var(--moon-size);
    height: var(--moon-size);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .whirl {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .whirl svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .globe {
    position: relative;
    width: calc(var(--moon-size) * 0.6875);
    height: calc(var(--moon-size) * 0.6875);
    display: block;
  }
  @keyframes spin-cw {
    to { transform: rotate(360deg); }
  }
  @keyframes spin-ccw {
    to { transform: rotate(-360deg); }
  }
  .ring-cw-14  { animation: spin-cw  14s linear infinite; }
  .ring-ccw-22 { animation: spin-ccw 22s linear infinite; }
  .ring-cw-32  { animation: spin-cw  32s linear infinite; }

  @media (prefers-reduced-motion: reduce) {
    .ring-cw-14, .ring-ccw-22, .ring-cw-32 {
      animation: none;
    }
  }

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
