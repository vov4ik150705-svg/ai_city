"""Render island_hero at 1920x1080 with a safe-area + grid overlay for planning."""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build")

im = Image.open(os.path.join(ROOT, "assets/island/island_hero.png")).convert("RGB")
im = im.resize((1920, 1080), Image.LANCZOS)
im.save(os.path.join(OUT, "island_1080_clean.png"))

d = ImageDraw.Draw(im, "RGBA")
# grid every 120 px (100 in source)
for x in range(0, 1921, 120):
    d.line([(x, 0), (x, 1080)], fill=(255, 0, 0, 70), width=1)
for y in range(0, 1081, 120):
    d.line([(0, y), (1920, y)], fill=(255, 0, 0, 70), width=1)
# safe areas
d.rectangle([96, 72, 1824, 984], outline=(0, 200, 0, 200), width=3)
# title band
d.rectangle([120, 105, 1800, 240], outline=(255, 140, 0, 220), width=3)
# axis labels
for x in range(0, 1921, 240):
    d.text((x + 4, 4), str(x), fill=(200, 0, 0, 255))
for y in range(120, 1081, 120):
    d.text((4, y + 2), str(y), fill=(200, 0, 0, 255))
im.save(os.path.join(OUT, "island_grid.png"))
print("ok")
