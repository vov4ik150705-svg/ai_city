"""Chroma-key generated sprites onto #FF00FF and crop. Does not touch art/raw."""
from __future__ import annotations

from collections import deque
from pathlib import Path
import sys

import numpy as np
from PIL import Image

MAGENTA = np.array([255, 0, 255], dtype=np.uint8)


def key_and_crop(src: Path, dst: Path, pad: int = 16) -> tuple[int, int, float]:
    rgb = np.array(Image.open(src).convert("RGB"))
    h, w = rgb.shape[:2]
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    cand = (r > 180) & (b > 180) & (g < 90) & ((r.astype(int) + b.astype(int) - 2 * g.astype(int)) > 180)
    seen = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        if cand[0, x]:
            q.append((0, x))
        if cand[h - 1, x]:
            q.append((h - 1, x))
    for y in range(h):
        if cand[y, 0]:
            q.append((y, 0))
        if cand[y, w - 1]:
            q.append((y, w - 1))
    while q:
        y, x = q.popleft()
        if seen[y, x] or not cand[y, x]:
            continue
        seen[y, x] = True
        if y > 0 and not seen[y - 1, x] and cand[y - 1, x]:
            q.append((y - 1, x))
        if y + 1 < h and not seen[y + 1, x] and cand[y + 1, x]:
            q.append((y + 1, x))
        if x > 0 and not seen[y, x - 1] and cand[y, x - 1]:
            q.append((y, x - 1))
        if x + 1 < w and not seen[y, x + 1] and cand[y, x + 1]:
            q.append((y, x + 1))
    fringe = np.zeros_like(seen)
    ys, xs = np.where(seen)
    for y, x in zip(ys, xs):
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx]:
                if r[ny, nx] > 160 and b[ny, nx] > 160 and g[ny, nx] < 110:
                    fringe[ny, nx] = True
    seen |= fringe
    rgb[seen] = MAGENTA
    ys, xs = np.where(~seen)
    if len(xs) == 0:
        raise SystemExit(f"fully keyed: {src}")
    x0 = max(0, int(xs.min()) - pad)
    y0 = max(0, int(ys.min()) - pad)
    x1 = min(w, int(xs.max()) + 1 + pad)
    y1 = min(h, int(ys.max()) + 1 + pad)
    out = rgb[y0:y1, x0:x1]
    dst.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(out, "RGB").save(dst, "PNG")
    return out.shape[1], out.shape[0], float(seen.mean() * 100)


if __name__ == "__main__":
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    w, h, keyed = key_and_crop(src, dst)
    print(f"{dst} {w}x{h} keyed {keyed:.1f}%")
