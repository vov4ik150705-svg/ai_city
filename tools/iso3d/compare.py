"""Side-by-side: mockup reference | factory render | 50% overlay."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
REF = ROOT / "assets" / "buildings"
OUT = ROOT / "assets" / "_iso3d" / "out"
MAGENTA = (255, 0, 255, 255)


def _crop_content(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    pix = im.load()
    w, h = im.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a < 8:
                continue
            if r > 240 and b > 240 and g < 25:
                continue
            xs.append(x)
            ys.append(y)
    if not xs:
        return im
    return im.crop((min(xs), min(ys), max(xs) + 1, max(ys) + 1))


def _fit(im: Image.Image, size: int) -> Image.Image:
    im = _crop_content(im)
    im.thumbnail((size, size), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (size, size), MAGENTA)
    x = (size - im.width) // 2
    y = (size - im.height) // 2
    canvas.alpha_composite(im, (x, y))
    return canvas


def compare(asset_id: str, size: int = 512) -> Path:
    ref = Image.open(REF / f"{asset_id}.png")
    rend = Image.open(OUT / f"{asset_id}.png")
    a = _fit(ref, size)
    b = _fit(rend, size)
    overlay = Image.blend(a, b, 0.5)
    strip = Image.new("RGBA", (size * 3, size), MAGENTA)
    strip.paste(a, (0, 0))
    strip.paste(b, (size, 0))
    strip.paste(overlay, (size * 2, 0))
    dest = OUT / f"{asset_id}_compare.png"
    strip.save(dest)
    print(f"wrote {dest}")
    return dest


if __name__ == "__main__":
    compare(sys.argv[1] if len(sys.argv) > 1 else "energy_plant")
