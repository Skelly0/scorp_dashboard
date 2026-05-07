"""Generate the Discord/Open-Graph social card.

Renders a 1200x630 PNG with the SCORP Mission-Brutalist look (amber on
near-black, blueprint grid, outer frame). Run with:

    python scripts/generate_og_image.py public/og-image.png

Re-run whenever branding changes; output is committed to public/.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE = (1200, 630)

BG = (10, 8, 5)
GRID = (243, 160, 0, 38)
FRAME = (243, 160, 0)
ACCENT = (255, 176, 0)
DIM = (201, 184, 138)
MUTED = (138, 111, 63)

CONSOLAS = "C:/Windows/Fonts/consola.ttf"
CONSOLAS_BOLD = "C:/Windows/Fonts/consolab.ttf"


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
    corner = 24
    for x, y in [(inset, inset), (w - inset, inset), (inset, h - inset), (w - inset, h - inset)]:
        draw.rectangle([(x - 6, y - 6), (x + 6, y + 6)], fill=FRAME)


def draw_glyph(draw: ImageDraw.ImageDraw, x: int, y: int, size: int) -> None:
    draw.rectangle([(x, y), (x + size, y + size)], outline=ACCENT, width=3)
    inner = size // 3
    cx = x + size // 2 - inner // 2
    cy = y + size // 2 - inner // 2
    draw.rectangle([(cx, cy), (cx + inner, cy + inner)], fill=ACCENT)


def render(out_path: Path) -> None:
    img = Image.new("RGBA", SIZE, BG + (255,))
    draw_grid(img)
    draw = ImageDraw.Draw(img)

    w, h = SIZE
    draw_frame(draw, w, h)

    pad_l = 80
    pad_t = 70

    glyph_size = 44
    draw_glyph(draw, pad_l, pad_t, glyph_size)

    f_meta = font(CONSOLAS_BOLD, 32)
    draw.text((pad_l + glyph_size + 18, pad_t + 4), "SCORP", font=f_meta, fill=ACCENT)

    f_meta_dim = font(CONSOLAS, 18)
    draw.text((pad_l + glyph_size + 18, pad_t + 44), "COLONY 2.5", font=f_meta_dim, fill=MUTED)

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

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out_path, "PNG", optimize=True)


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("out", type=Path, help="Output PNG path (e.g. public/og-image.png)")
    args = p.parse_args(argv)
    render(args.out)
    print(f"wrote {args.out} ({args.out.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
