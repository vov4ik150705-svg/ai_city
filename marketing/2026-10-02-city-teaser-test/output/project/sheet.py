"""Tile a set of rendered stills into a review sheet."""
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")

frames = [int(x) for x in sys.argv[1].split(",")]
out = sys.argv[2] if len(sys.argv) > 2 else "sheet.png"
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 2
tw = 940
th = int(tw * 1080 / 1920)
rows = (len(frames) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (tw + 8) + 8, rows * (th + 30) + 8), (235, 235, 235))
d = ImageDraw.Draw(sheet)
for i, n in enumerate(frames):
    p = os.path.join(BUILD, "still_%04d.png" % n)
    im = Image.open(p).resize((tw, th), Image.LANCZOS)
    r, c = divmod(i, cols)
    x = 8 + c * (tw + 8)
    y = 8 + r * (th + 30)
    sheet.paste(im, (x, y))
    d.text((x + 4, y + th + 8), "frame %d  t=%.3fs" % (n, n / 30.0), fill=(0, 0, 0))
sheet.save(os.path.join(BUILD, out))
print(os.path.join(BUILD, out), sheet.size)
