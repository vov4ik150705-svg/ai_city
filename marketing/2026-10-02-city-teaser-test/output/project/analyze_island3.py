"""Find the rock silhouette bottom edge: waterfalls/clouds are pale, rock is dark."""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = Image.open(os.path.join(ROOT, "assets/island/island_hero.png")).convert("RGB")
a = np.asarray(im).astype(np.int16)
H, W, _ = a.shape
r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
mx = a.max(axis=2); mn = a.min(axis=2)
bright = (mx + mn) / 2.0
sky = (b - r > 70) & (b > 200)
# rock / buildings: bright < 185  (pale waterfall & cloud excluded)
solid = (~sky) & (bright < 185)
cloudish = (~sky) & (bright >= 185)

print("solid frac", round(float(solid.mean()), 4))
ys, xs = np.where(solid)
print("SOLID bbox:", int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
print("  frac x %.4f..%.4f  y %.4f..%.4f" % (xs.min()/W, (xs.max()+1)/W, ys.min()/H, (ys.max()+1)/H))

# vertical profile of solid within x 1000..2800
sub = solid[:, 1000:2800]
cnt = sub.sum(axis=1)
print("\nrow solid-count around the bottom edge (y: count):")
for y in range(1600, 2160, 20):
    print(f"  y={y:5d} solid={cnt[y]:5d}  cloudish={cloudish[y,1000:2800].sum():5d}")

# core = city buildings (upper dense part only), y < rock bottom
core = solid[400:1500, :]
ys2, xs2 = np.where(core)
print("\ncore(upper) bbox:", int(xs2.min()), int(ys2.min())+400, int(xs2.max()), int(ys2.max())+400)
cx = (int(xs2.min()) + int(xs2.max())) / 2
cy = (int(ys2.min()) + int(ys2.max())) / 2 + 400
print("core center:", cx, cy, " frac: x %.4f y %.4f" % (cx/W, cy/H))
