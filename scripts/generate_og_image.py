"""Generate the Discord/Open-Graph social card.

Produces an animated 1200x630 GIF (default) with the SCORP Mission-
Brutalist look — schematic palette: navy on cream blueprint — and a
spinning moon-globe in the top-right that mirrors `MoonLoader.svelte`'s
contour-wireframe style.

    python scripts/generate_og_image.py public/og-image.gif
    python scripts/generate_og_image.py public/og-image.png --static

Re-run whenever branding changes; output is committed to public/.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

# === Card layout ============================================================

SIZE = (1200, 630)

BG = (244, 241, 234)
GRID = (14, 58, 138, 46)
FRAME = (14, 58, 138)
ACCENT = (14, 58, 138)
DIM = (61, 90, 150)
MUTED = (118, 145, 186)

CONSOLAS = "C:/Windows/Fonts/consola.ttf"
CONSOLAS_BOLD = "C:/Windows/Fonts/consolab.ttf"

# === Moon (mirrors MoonLoader.svelte schematic mood) ========================

MOON_TEXTURE = Path(__file__).resolve().parent.parent / "src" / "lib" / "assets" / "moon-equirect.png"

MOON_TW, MOON_TH = 360, 180
MOON_LEVELS = (0.28, 0.38, 0.48, 0.58)
MOON_C_W = (1.4, 1.1, 0.9, 0.7)  # contour line widths (post-downsample px)
MOON_GRAT_LON = 15
MOON_GRAT_LAT = 12
MOON_GRAT_W = 0.85
MOON_LIMB_W = 1.6

# Schematic mood — alpha pre-baked since GIF is 1-bit alpha and we composite
# onto the cream background before flattening.
MOON_LINE = (14, 58, 138, 178)        # 0.7
MOON_LINE_SOFT = (14, 58, 138, 128)   # 0.5
MOON_LINE_FAINT = (14, 58, 138, 71)   # 0.28
MOON_DISK_FILL = (14, 58, 138, 8)     # 0.03
MOON_LIMB = (14, 58, 138, 255)

MOON_DISK_PX = 240
MOON_CENTER = (1200 - 80 - MOON_DISK_PX // 2, 70 + MOON_DISK_PX // 2)
MOON_SUPERSAMPLE = 2  # render moon overlay at 2x then downsample for AA


# === Card primitives ========================================================


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def draw_grid(img: Image.Image, spacing: int = 32) -> None:
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    w, h = img.size
    for x in range(0, w, spacing):
        odraw.line([(x, 0), (x, h)], fill=GRID, width=1)
    for y in range(0, h, spacing):
        odraw.line([(0, y), (w, y)], fill=GRID, width=1)
    img.alpha_composite(overlay)


def draw_frame(draw: ImageDraw.ImageDraw, w: int, h: int, inset: int = 18, weight: int = 4) -> None:
    draw.rectangle([(inset, inset), (w - inset - 1, h - inset - 1)], outline=FRAME, width=weight)
    for x, y in [(inset, inset), (w - inset, inset), (inset, h - inset), (w - inset, h - inset)]:
        draw.rectangle([(x - 6, y - 6), (x + 6, y + 6)], fill=FRAME)


def draw_glyph(draw: ImageDraw.ImageDraw, x: int, y: int, size: int) -> None:
    draw.rectangle([(x, y), (x + size, y + size)], outline=ACCENT, width=3)
    inner = size // 3
    cx = x + size // 2 - inner // 2
    cy = y + size // 2 - inner // 2
    draw.rectangle([(cx, cy), (cx + inner, cy + inner)], fill=ACCENT)


def render_base() -> Image.Image:
    """Render the static card (no moon)."""
    img = Image.new("RGBA", SIZE, BG + (255,))
    draw_grid(img)
    draw = ImageDraw.Draw(img)

    w, h = SIZE
    draw_frame(draw, w, h)

    pad_l, pad_t = 80, 70
    glyph_size = 44
    draw_glyph(draw, pad_l, pad_t, glyph_size)

    f_meta = font(CONSOLAS_BOLD, 32)
    draw.text((pad_l + glyph_size + 18, pad_t + 4), "SCORP 2.5", font=f_meta, fill=ACCENT)

    f_meta_dim = font(CONSOLAS, 18)
    draw.text((pad_l + glyph_size + 18, pad_t + 44), "COLONY", font=f_meta_dim, fill=MUTED)

    title_x = pad_l
    title_y = 200
    f_title = font(CONSOLAS_BOLD, 156)
    draw.text((title_x, title_y), "COLONY", font=f_title, fill=ACCENT)
    draw.text((title_x, title_y + 150), "DASHBOARD", font=f_title, fill=ACCENT)

    f_tag = font(CONSOLAS, 28)
    tagline = "PLAYER-FACING READ — REFRESHED HOURLY"
    draw.text((title_x, 522), tagline, font=f_tag, fill=DIM)

    f_pages = font(CONSOLAS, 18)
    pages = "STATUS  ·  DEMOGRAPHICS  ·  CRISIS  ·  MAP  ·  GoIs  ·  POPS  ·  POLITICS  ·  SENATE"
    bbox = draw.textbbox((0, 0), pages, font=f_pages)
    page_w = bbox[2] - bbox[0]
    draw.text((w - pad_l - page_w, h - 60), pages, font=f_pages, fill=MUTED)

    return img


# === Moon globe =============================================================


def load_moon_lum() -> np.ndarray:
    """Load + 2-pass blur the moon equirect texture (mirrors JS blur())."""
    img = Image.open(MOON_TEXTURE).convert("L").resize((MOON_TW, MOON_TH))
    arr = np.asarray(img, dtype=np.float32) / 255.0
    for _ in range(2):
        a = np.roll(arr, 1, axis=1)
        c = np.roll(arr, -1, axis=1)
        arr = (a + 2 * arr + c) / 4
        a = np.concatenate([arr[:1], arr[:-1]], axis=0)
        c = np.concatenate([arr[1:], arr[-1:]], axis=0)
        arr = (a + 2 * arr + c) / 4
    return arr


def contour_segments(lum: np.ndarray, level: float) -> list:
    """Marching squares in (lon,lat) space."""
    h, w = lum.shape
    segs = []
    for y in range(h - 1):
        for x in range(w - 1):
            a = float(lum[y, x])
            b = float(lum[y, x + 1])
            c = float(lum[y + 1, x + 1])
            d = float(lum[y + 1, x])
            idx = 0
            if a > level: idx |= 1
            if b > level: idx |= 2
            if c > level: idx |= 4
            if d > level: idx |= 8
            if idx == 0 or idx == 15:
                continue

            def lerp(v0, v1):
                return (level - v0) / (v1 - v0)

            tT = lerp(a, b) if (idx & 1) != ((idx & 2) >> 1) else None
            tR = lerp(b, c) if ((idx & 2) >> 1) != ((idx & 4) >> 2) else None
            tB = lerp(d, c) if ((idx & 8) >> 3) != ((idx & 4) >> 2) else None
            tL = lerp(a, d) if (idx & 1) != ((idx & 8) >> 3) else None

            pT = (x + tT, y) if tT is not None else None
            pR = (x + 1, y + tR) if tR is not None else None
            pB = (x + tB, y + 1) if tB is not None else None
            pL = (x, y + tL) if tL is not None else None

            cases = {
                1: [(pL, pT)], 14: [(pL, pT)],
                2: [(pT, pR)], 13: [(pT, pR)],
                3: [(pL, pR)], 12: [(pL, pR)],
                4: [(pR, pB)], 11: [(pR, pB)],
                5: [(pL, pT), (pR, pB)],
                6: [(pT, pB)], 9: [(pT, pB)],
                7: [(pL, pB)], 8: [(pL, pB)],
                10: [(pT, pR), (pL, pB)],
            }
            for p1, p2 in cases.get(idx, []):
                if p1 is None or p2 is None:
                    continue
                lon1 = (p1[0] / (w - 1)) * 360 - 180
                lat1 = 90 - (p1[1] / (h - 1)) * 180
                lon2 = (p2[0] / (w - 1)) * 360 - 180
                lat2 = 90 - (p2[1] / (h - 1)) * 180
                segs.append((lon1, lat1, lon2, lat2))
    return segs


def graticule_polylines(s_lon: int, s_lat: int) -> list:
    polylines = []
    lon = -180
    while lon < 180:
        line = []
        lat = -80
        while lat <= 80:
            line.append((lon, lat))
            lat += 4
        polylines.append(line)
        lon += s_lon
    lat = -75
    while lat <= 75:
        line = []
        lon_ = -180
        while lon_ <= 180:
            line.append((lon_, lat))
            lon_ += 4
        polylines.append(line)
        lat += s_lat
    return polylines


def project(lon_deg: float, lat_deg: float, rot_rad: float, cx: float, cy: float, R: float):
    lam = math.radians(lon_deg)
    phi = math.radians(lat_deg)
    x = math.cos(phi) * math.sin(lam)
    y = math.sin(phi)
    z = math.cos(phi) * math.cos(lam)
    cosR = math.cos(rot_rad)
    sinR = math.sin(rot_rad)
    x1 = x * cosR + z * sinR
    z1 = -x * sinR + z * cosR
    if z1 < 0:
        return None
    return (cx + x1 * R, cy - y * R)


def render_moon_overlay(rot_deg: float, contours: dict, graticule: list, radius: int) -> Image.Image:
    """Render the moon at 2x scale into its own square RGBA, then downsample."""
    s = MOON_SUPERSAMPLE
    big = (radius * 2 + 8) * s
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    od = ImageDraw.Draw(img)
    cx = cy = big // 2
    R = radius * s
    rot = math.radians(rot_deg)

    # Disk fill
    od.ellipse([(cx - R, cy - R), (cx + R, cy + R)], fill=MOON_DISK_FILL)

    # Graticule
    grat_w = max(1, int(round(MOON_GRAT_W * s)))
    for line in graticule:
        pts = []
        for lon, lat in line:
            p = project(lon, lat, rot, cx, cy, R)
            if p is None:
                if len(pts) >= 2:
                    od.line(pts, fill=MOON_LINE_FAINT, width=grat_w)
                pts = []
            else:
                pts.append(p)
        if len(pts) >= 2:
            od.line(pts, fill=MOON_LINE_FAINT, width=grat_w)

    # Contours, level by level (densest first so denser layer can be over-drawn)
    palette = (MOON_LINE, MOON_LINE_SOFT, MOON_LINE_FAINT, MOON_LINE_FAINT)
    for level, w_px, color in zip(MOON_LEVELS, MOON_C_W, palette):
        segs = contours[level]
        line_w = max(1, int(round(w_px * s)))
        for lon1, lat1, lon2, lat2 in segs:
            p1 = project(lon1, lat1, rot, cx, cy, R)
            p2 = project(lon2, lat2, rot, cx, cy, R)
            if p1 is None or p2 is None:
                continue
            od.line([p1, p2], fill=color, width=line_w)

    # Limb outline
    od.ellipse([(cx - R, cy - R), (cx + R, cy + R)], outline=MOON_LIMB,
               width=max(1, int(round(MOON_LIMB_W * s))))

    # Downsample for antialiased look
    target = (radius * 2 + 8, radius * 2 + 8)
    return img.resize(target, Image.Resampling.LANCZOS)


def composite_moon(canvas: Image.Image, overlay: Image.Image) -> None:
    cx, cy = MOON_CENTER
    w, h = overlay.size
    canvas.alpha_composite(overlay, (cx - w // 2, cy - h // 2))


# === Output ================================================================


def _moon_data():
    print("loading moon texture...", flush=True)
    lum = load_moon_lum()
    print("computing contours...", flush=True)
    contours = {lvl: contour_segments(lum, lvl) for lvl in MOON_LEVELS}
    grat = graticule_polylines(MOON_GRAT_LON, MOON_GRAT_LAT)
    return contours, grat


def render_static(out_path: Path) -> None:
    base = render_base()
    contours, grat = _moon_data()
    overlay = render_moon_overlay(0.0, contours, grat, MOON_DISK_PX // 2)
    composite_moon(base, overlay)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(out_path, "PNG", optimize=True)


def render_animated(out_path: Path, n_frames: int = 30, frame_ms: int = 100) -> None:
    base = render_base()
    contours, grat = _moon_data()
    print(f"rendering {n_frames} frames...", flush=True)
    radius = MOON_DISK_PX // 2

    frames = []
    for i in range(n_frames):
        rot = (i / n_frames) * 360.0
        overlay = render_moon_overlay(rot, contours, grat, radius)
        frame = base.copy()
        composite_moon(frame, overlay)
        frames.append(frame.convert("RGB"))
        if (i + 1) % 5 == 0:
            print(f"  {i + 1}/{n_frames}", flush=True)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    print("quantizing to shared palette...", flush=True)
    master = frames[len(frames) // 2].quantize(colors=32, method=Image.Quantize.MEDIANCUT)
    quantized = [f.quantize(palette=master, dither=Image.Dither.NONE) for f in frames]
    print("encoding GIF...", flush=True)
    # disposal=2 (restore to BG between frames). disposal=1 (overlay) is
    # tempting because most pixels don't change, but PIL's optimize+quantize
    # combo collides palette indices when computing the transparent overlay
    # mask — static text/grid pixels disappear in non-frame-0 frames. Full
    # redraw is reliable across all renderers.
    quantized[0].save(
        out_path,
        format="GIF",
        save_all=True,
        append_images=quantized[1:],
        duration=frame_ms,
        loop=0,
        optimize=False,
        disposal=2,
    )


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("out", type=Path, help="Output path (.gif or .png)")
    p.add_argument("--static", action="store_true", help="Static PNG (frame 0) instead of animated GIF")
    p.add_argument("--frames", type=int, default=30, help="Number of frames in the animation loop")
    p.add_argument("--frame-ms", type=int, default=100, help="Per-frame duration in milliseconds")
    args = p.parse_args(argv)
    if args.static:
        render_static(args.out)
    else:
        render_animated(args.out, args.frames, args.frame_ms)
    print(f"wrote {args.out} ({args.out.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
