"""Rasterize the scene bitmap font. TZ_ART.md §5.

Reads the glyph list from glyphs.txt (not a literal here). Returns RGBA plus
metrics; content/atlas.py encodes font.png next to the V1 atlas (not art/out).
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

PIPE = Path(__file__).resolve().parent
REPO = PIPE.parent.parent
GLYPHS_PATH = PIPE / "glyphs.txt"
FONT_PATH = REPO / "art" / "fonts" / "press_start_2p.ttf"
HYPHEN = "-"


def load_charset() -> str:
    raw = GLYPHS_PATH.read_text(encoding="utf-8")
    out: list[str] = []
    seen: set[str] = set()
    for line in raw.splitlines():
        if line.startswith("#"):
            continue
        for ch in line:
            if ch in seen:
                continue
            seen.add(ch)
            out.append(ch)
    return "".join(out)


def _ramp_color(palette: np.ndarray, ramps: dict[str, list[int]], name: str, index: int) -> tuple[int, int, int]:
    idxs = ramps.get(name) or []
    if not idxs:
        return (0, 0, 0)
    if index < 0:
        index = 0
    if index >= len(idxs):
        index = len(idxs) - 1
    rgb = palette[idxs[index]]
    return int(rgb[0]), int(rgb[1]), int(rgb[2])


def _advance_of(font: ImageFont.FreeTypeFont, ch: str, pad: int) -> int:
    bbox = font.getbbox(ch)
    if bbox is None:
        return pad
    span = int(bbox[2] - bbox[0])
    out = span + pad
    return out if out > 0 else pad


def raster_glyphs(
    tile_w: int,
    palette: np.ndarray,
    ramps: dict[str, list[int]],
) -> tuple[np.ndarray, dict[str, dict[str, int]]]:
    """One size: tile_w // 8. Fill concrete[6], outline outline[0]."""
    size = tile_w // 8 if tile_w >= 8 else tile_w
    if size < 1:
        size = 1
    fill = _ramp_color(palette, ramps, "concrete", 6)
    outline = _ramp_color(palette, ramps, "outline", 0)
    font = ImageFont.truetype(str(FONT_PATH), size=size)
    pad = 1
    gap = 1
    page_w = 512
    glyphs: list[tuple[str, np.ndarray, int]] = []
    for ch in load_charset():
        draw_ch = ch
        if ch == "\u2212":
            draw_ch = HYPHEN
        if ch == " ":
            glyphs.append((ch, np.zeros((1, 1, 4), dtype=np.uint8), size))
            continue
        canvas = Image.new("L", (size * 4, size * 4), 0)
        d = ImageDraw.Draw(canvas)
        origin = (size, size)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                d.text((origin[0] + dx, origin[1] + dy), draw_ch, font=font, fill=255)
        mask = np.array(canvas, dtype=np.uint8)
        ink = Image.new("L", canvas.size, 0)
        ImageDraw.Draw(ink).text(origin, draw_ch, font=font, fill=255)
        core = np.array(ink, dtype=np.uint8)
        ys, xs = np.where(mask > 127)
        if len(xs) == 0:
            continue
        x0 = max(0, int(xs.min()) - pad)
        y0 = max(0, int(ys.min()) - pad)
        x1 = min(mask.shape[1], int(xs.max()) + 1 + pad)
        y1 = min(mask.shape[0], int(ys.max()) + 1 + pad)
        m = mask[y0:y1, x0:x1]
        c = core[y0:y1, x0:x1]
        h, w = m.shape
        rgba = np.zeros((h, w, 4), dtype=np.uint8)
        ring = (m > 127) & (c <= 127)
        body = c > 127
        rgba[ring, 0] = outline[0]
        rgba[ring, 1] = outline[1]
        rgba[ring, 2] = outline[2]
        rgba[ring, 3] = 255
        rgba[body, 0] = fill[0]
        rgba[body, 1] = fill[1]
        rgba[body, 2] = fill[2]
        rgba[body, 3] = 255
        glyphs.append((ch, rgba, _advance_of(font, draw_ch, pad)))
    x = gap
    y = gap
    row_h = 0
    placed: list[tuple[str, np.ndarray, int, int, int]] = []
    for ch, rgba, advance in glyphs:
        h, w = int(rgba.shape[0]), int(rgba.shape[1])
        if x > gap and x + w + gap > page_w:
            y += row_h + gap
            x = gap
            row_h = 0
        placed.append((ch, rgba, advance, x, y))
        x += w + gap
        if h > row_h:
            row_h = h
    total_h = y + row_h + gap
    if total_h < 1:
        total_h = 1
    atlas = np.zeros((total_h, page_w, 4), dtype=np.uint8)
    metrics: dict[str, dict[str, int]] = {}
    for ch, rgba, advance, gx, gy in placed:
        h, w = int(rgba.shape[0]), int(rgba.shape[1])
        atlas[gy : gy + h, gx : gx + w] = rgba
        metrics[ch] = {"x": gx, "y": gy, "w": w, "h": h, "advance": advance}
    return atlas, metrics
