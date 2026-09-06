"""Slice mockup sprite sheets into individual magenta-backed PNGs."""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
SHEETS = ROOT / "_sheets"
OUT = ROOT / "_sliced"
MAGENTA = np.array([255, 0, 255], dtype=np.uint8)


def mask_fg(rgb: np.ndarray, thresh: int = 18) -> np.ndarray:
    lum = rgb.astype(np.int16).max(axis=2)
    bright = lum > thresh
    # gray paper background (sheet_blocks): drop near-neutral midtones
    ch = rgb.astype(np.int16)
    sat = np.max(ch, axis=2) - np.min(ch, axis=2)
    mean = ch.mean(axis=2)
    gray_paper = (sat < 18) & (mean > 40) & (mean < 140)
    return bright & ~gray_paper


def components(mask: np.ndarray, min_area: int = 40) -> list[tuple[int, int, int, int]]:
    h, w = mask.shape
    seen = np.zeros((h, w), dtype=bool)
    boxes: list[tuple[int, int, int, int]] = []
    ys, xs = np.where(mask)
    for y0, x0 in zip(ys.tolist(), xs.tolist()):
        if seen[y0, x0]:
            continue
        q: deque[tuple[int, int]] = deque([(y0, x0)])
        seen[y0, x0] = True
        minx = maxx = x0
        miny = maxy = y0
        area = 0
        while q:
            y, x = q.popleft()
            area += 1
            if x < minx:
                minx = x
            if x > maxx:
                maxx = x
            if y < miny:
                miny = y
            if y > maxy:
                maxy = y
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        bw = maxx - minx + 1
        bh = maxy - miny + 1
        if area < min_area or bw < 6 or bh < 6:
            continue
        # skip full-sheet / huge banner blobs
        if bw > w * 0.92 or bh > h * 0.92:
            continue
        boxes.append((minx, miny, maxx + 1, maxy + 1))
    boxes.sort(key=lambda b: (b[1], b[0]))
    return boxes


def crop_magenta(rgb: np.ndarray, box: tuple[int, int, int, int], mask: np.ndarray) -> Image.Image:
    x0, y0, x1, y1 = box
    tile = rgb[y0:y1, x0:x1].copy()
    m = mask[y0:y1, x0:x1]
    out = np.full(tile.shape, MAGENTA, dtype=np.uint8)
    out[m] = tile[m]
    return Image.fromarray(out, "RGB")


def slice_sheet(path: Path, prefix: str) -> list[dict]:
    im = Image.open(path).convert("RGB")
    rgb = np.array(im)
    mask = mask_fg(rgb)
    boxes = components(mask)
    dest = OUT / prefix
    dest.mkdir(parents=True, exist_ok=True)
    debug = im.copy()
    draw = ImageDraw.Draw(debug)
    rows: list[dict] = []
    for i, box in enumerate(boxes, 1):
        x0, y0, x1, y1 = box
        w, h = x1 - x0, y1 - y0
        crop = crop_magenta(rgb, box, mask)
        name = f"{prefix}_{i:03d}_{w}x{h}_y{y0}.png"
        crop.save(dest / name)
        draw.rectangle([x0, y0, x1 - 1, y1 - 1], outline=(0, 255, 0))
        draw.text((x0, max(0, y0 - 10)), str(i), fill=(255, 255, 0))
        rows.append({"i": i, "file": name, "box": box, "w": w, "h": h, "cx": (x0 + x1) // 2, "cy": (y0 + y1) // 2})
    debug.save(OUT / f"{prefix}_debug.png")
    return rows


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for src, prefix in (
        (SHEETS / "sheet_blocks.jpg", "blocks"),
        (SHEETS / "sheet_clear.jpg", "clear"),
    ):
        rows = slice_sheet(src, prefix)
        print(f"=== {prefix}: {len(rows)} sprites ===")
        for r in rows:
            print(f"{r['i']:3d}  {r['w']:3d}x{r['h']:3d}  cx={r['cx']:4d} cy={r['cy']:4d}  {r['file']}")


if __name__ == "__main__":
    main()
