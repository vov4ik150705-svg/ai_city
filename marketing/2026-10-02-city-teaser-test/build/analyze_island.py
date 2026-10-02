"""Analyze island_hero.png composition: island vs sky, precise bounds."""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = Image.open(os.path.join(ROOT, "assets/island/island_hero.png")).convert("RGB")
a = np.asarray(im).astype(np.int16)
H, W, _ = a.shape
r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]

# Sky is strongly blue-dominant (b-r ~ 110+). Island rock/building/green is not.
br = b - r
sky = (br > 70) & (b > 200)
island = ~sky
print("size", (W, H), "frac island", round(float(island.mean()), 4))
print("b-r stats: island mean", round(float(br[island].mean()), 1),
      "sky mean", round(float(br[sky].mean()), 1))

colcov = island.mean(axis=0)
rowcov = island.mean(axis=1)


def span(cov, thresh):
    idx = np.where(cov > thresh)[0]
    return (int(idx[0]), int(idx[-1])) if len(idx) else None


for t in (0.002, 0.01, 0.05, 0.2, 0.5):
    print(f"thresh {t}: cols {span(colcov, t)}  rows {span(rowcov, t)}")

step_x, step_y = W // 32, H // 18
print("\ncoarse map (X=island >.5, +=.1-.5, .=sky):")
hdr = "      " + "".join(str((i * step_x // 100) % 10) for i in range(32))
print(hdr)
for y in range(0, H, step_y):
    line = ""
    for x in range(0, W, step_x):
        v = island[y:y + step_y, x:x + step_x].mean()
        line += "X" if v > 0.5 else ("+" if v > 0.1 else ".")
    print(f"{y:5d} {line}")

# The island "body" (buildings cluster) - exclude the rock/cliff: look at upper part
# Find the tight bbox of the dense city area
ys, xs = np.where(island)
print("\nany island bbox:", xs.min(), ys.min(), xs.max(), ys.max())
# per-row first/last island x
print("\nrow profile (y, first_x, last_x, count):")
for y in range(0, H, H // 24):
    idx = np.where(island[y])[0]
    if len(idx):
        print(f"  y={y:5d} x {idx[0]:5d}..{idx[-1]:5d}  n={len(idx):5d}")
    else:
        print(f"  y={y:5d} (empty)")
