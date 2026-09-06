"""Cut five low-poly trees from a grey plate onto #FF00FF. One-shot."""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(
    r"C:\Users\sk640\.cursor\projects\c-Users-sk640-ai-city"
    r"\assets\c__Users_sk640_AppData_Roaming_Cursor_User_workspaceStorage"
    r"_f3c7c3f70c850e874ee6f5dadc8716f0_images_image-c571e0be-06aa-464a-b3c6-2b084119d977.jpg"
)
OUT = Path(__file__).resolve().parent / "foliage"
MAGENTA = np.array([255, 0, 255], dtype=np.uint8)
PAD = 10
NAMES = (
    "tree_cluster_dark.png",
    "tree_cyan.png",
    "tree_small_lime.png",
    "tree_tall_lime.png",
    "tree_cluster_purple.png",
)

# spatial priors (x0, x1, y0, y1) — hard clip after grow
PRIORS = (
    (140, 330, 70, 520),
    (260, 480, 80, 520),
    (415, 528, 285, 545),
    (450, 680, 10, 535),
    (590, 860, 140, 520),
)


def erode(mask: np.ndarray, n: int) -> np.ndarray:
    out = mask.copy()
    for _ in range(n):
        p = np.pad(out, 1, constant_values=False)
        out = p[1:-1, 1:-1] & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    return out


def largest_cc(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    seen = np.zeros((h, w), dtype=bool)
    best = np.zeros((h, w), dtype=bool)
    best_n = 0
    ys, xs = np.where(mask)
    for y0, x0 in zip(ys.tolist(), xs.tolist()):
        if seen[y0, x0]:
            continue
        q: deque[tuple[int, int]] = deque([(y0, x0)])
        seen[y0, x0] = True
        pts: list[tuple[int, int]] = []
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if len(pts) > best_n:
            best_n = len(pts)
            best = np.zeros((h, w), dtype=bool)
            for y, x in pts:
                best[y, x] = True
    return best


def crop_magenta(rgb: np.ndarray, mask: np.ndarray) -> Image.Image:
    ys, xs = np.where(mask)
    if len(ys) == 0:
        raise SystemExit("empty mask")
    h, w = mask.shape
    y0 = max(0, int(ys.min()) - PAD)
    x0 = max(0, int(xs.min()) - PAD)
    y1 = min(h, int(ys.max()) + 1 + PAD)
    x1 = min(w, int(xs.max()) + 1 + PAD)
    tile = np.full((y1 - y0, x1 - x0, 3), MAGENTA, dtype=np.uint8)
    m = mask[y0:y1, x0:x1]
    tile[m] = rgb[y0:y1, x0:x1][m]
    return Image.fromarray(tile, "RGB")


def main() -> None:
    rgb = np.array(Image.open(SRC).convert("RGB"))
    hsv = np.array(Image.fromarray(rgb).convert("HSV"))
    h, w = rgb.shape[:2]
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    hue = hsv[:, :, 0]
    yy = np.arange(h)[:, None]
    xx = np.arange(w)[None, :]

    canopy = chroma >= 22
    trunk = (hue < 40) & (chroma >= 12) & (chroma < 80) & (r > g) & (r > b - 4)
    # purple/cyan trunks are chromatic, already in canopy
    fg = canopy | trunk
    fg &= ~((chroma < 20) & (np.maximum(np.maximum(r, g), b) > 130))

    purple = canopy & (hue >= 165) & (hue < 230)
    cyan = canopy & (hue >= 118) & (hue < 165)
    yellow = canopy & (hue >= 38) & (hue < 58)
    green = canopy & (hue >= 58) & (hue < 115)

    seeds = [
        erode((green | (yellow & (xx < 310))) & (xx < 320) & (yy > 90), 1),
        erode(cyan & (xx > 260) & (xx < 480), 1),
        erode(yellow & (xx > 410) & (xx < 555) & (yy > 290), 1),
        erode((green | yellow) & (xx > 450) & (yy < 270), 1),
        erode(purple & (xx > 590), 1),
    ]

    labels = np.zeros((h, w), dtype=np.int32)
    q: deque[tuple[int, int]] = deque()
    for i, seed in enumerate(seeds, start=1):
        ys, xs = np.where(seed)
        if len(ys) == 0:
            raise SystemExit(f"empty seed {i}")
        for y0, x0 in zip(ys.tolist(), xs.tolist()):
            if labels[y0, x0]:
                continue
            labels[y0, x0] = i
            q.append((y0, x0))
            stack = deque([(y0, x0)])
            while stack:
                y, x = stack.popleft()
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= ny < h and 0 <= nx < w and seed[ny, nx] and labels[ny, nx] == 0:
                        labels[ny, nx] = i
                        stack.append((ny, nx))
                        q.append((ny, nx))

    def grow_into(allowed: np.ndarray) -> None:
        while q:
            y, x = q.popleft()
            lab = int(labels[y, x])
            x0, x1, y0, y1 = PRIORS[lab - 1]
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if not (0 <= ny < h and 0 <= nx < w):
                    continue
                if not allowed[ny, nx] or labels[ny, nx] != 0:
                    continue
                if not (x0 <= nx < x1 and y0 <= ny < y1):
                    continue
                labels[ny, nx] = lab
                q.append((ny, nx))

    grow_into(canopy)
    q.extend(zip(*np.where(labels > 0)))
    grow_into(fg)
    # tall trunk sits behind the small tree; keep brown there on the tall label
    steal = (labels == 3) & trunk & (xx >= 500)
    labels[steal] = 4
    # small canopy sits in front of that trunk; do not keep it on the tall label
    give = (labels == 4) & (yellow | green) & (yy > 285) & (xx < 530)
    labels[give] = 3

    OUT.mkdir(parents=True, exist_ok=True)
    for i, name in enumerate(NAMES, start=1):
        x0, x1, y0, y1 = PRIORS[i - 1]
        box = np.zeros((h, w), dtype=bool)
        box[y0:y1, x0:x1] = True
        mask = largest_cc((labels == i) & box)
        if i == 4:
            mask &= ~((yellow | green) & (yy > 300))
            mask = largest_cc(mask)
        im = crop_magenta(rgb, mask)
        dest = OUT / name
        im.save(dest, "PNG")
        print(f"{name} {im.size[0]}x{im.size[1]} px={int(mask.sum())}")


if __name__ == "__main__":
    main()
