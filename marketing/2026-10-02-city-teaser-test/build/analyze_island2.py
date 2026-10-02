"""Exact island silhouette bbox in island_hero.png, excluding sky gradient and white clouds."""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = Image.open(os.path.join(ROOT, "assets/island/island_hero.png")).convert("RGB")
a = np.asarray(im).astype(np.int16)
H, W, _ = a.shape
r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
mx = a.max(axis=2)
mn = a.min(axis=2)

sky = (b - r > 70) & (b > 200)
cloud = (mn > 190) & ((mx - mn) < 45)
island = ~(sky | cloud)

ys, xs = np.where(island)
print("ISLAND bbox (x0,y0,x1,y1):", int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
print("ISLAND size:", int(xs.max() - xs.min()), int(ys.max() - ys.min()))

# dense body (>=2% island in a 32x32 tile) to exclude thin waterfalls
t = 32
th, tw = H // t, W // t
dense = np.zeros((th, tw), np.float32)
for j in range(th):
    for i in range(tw):
        dense[j, i] = island[j * t:(j + 1) * t, i * t:(i + 1) * t].mean()
ys2, xs2 = np.where(dense > 0.02)
print("DENSE bbox:", int(xs2.min()) * t, int(ys2.min()) * t, int(xs2.max()) * t, int(ys2.min()) + (int(ys2.max()) + 1) * t)
print("as fraction of 3840x2160: x %.3f..%.3f  y %.3f..%.3f" % (
    xs.min() / W, (xs.max() + 1) / W, ys.min() / H, (ys.max() + 1) / H))

# Where is the city-building cluster (the focus point)? Denser than 0.5
ys3, xs3 = np.where(dense > 0.5)
if len(xs3):
    print("CORE(>0.5) bbox:", int(xs3.min()) * t, int(ys3.min()) * t,
          (int(xs3.max()) + 1) * t, (int(ys3.max()) + 1) * t)
    print("CORE center:", (int(xs3.min()) + int(xs3.max()) + 1) * t / 2,
          (int(ys3.min()) + int(ys3.max()) + 1) * t / 2)
    print("CORE frac center: x %.3f y %.3f" % (
        ((int(xs3.min()) + int(xs3.max()) + 1) * t / 2) / W,
        ((int(ys3.min()) + int(ys3.max()) + 1) * t / 2) / H))

print("\ntopmost island row / leftmost col overall:", int(ys.min()), int(xs.min()))
# widest row
rowc = island.sum(axis=1)
i = int(rowc.argmax())
print("widest row y=%d count=%d" % (i, rowc[i]))
colc = island.sum(axis=0)
j = int(colc.argmax())
print("tallest col x=%d count=%d" % (j, colc[j]))
