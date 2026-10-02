"""Frames around every scene boundary, to judge the splices."""
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")

BOUNDS = [120, 240, 390, 540, 690, 840]
OFFS = [-9, -4, 0, 4, 9]
frames = [b + o for b in BOUNDS for o in OFFS]

tw = 470
th = int(tw * 1080 / 1920)
cols = 5
rows = len(BOUNDS)
sheet = Image.new("RGB", (cols * (tw + 6) + 6, rows * (th + 22) + 6), (232, 232, 232))
d = ImageDraw.Draw(sheet)
for i, (b, o) in enumerate([(b, o) for b in BOUNDS for o in OFFS]):
    r, c = divmod(i, cols)
    x = 6 + c * (tw + 6)
    y = 6 + r * (th + 22)
    p = os.path.join(BUILD, "still_%04d.png" % (b + o))
    if not os.path.exists(p):
        continue
    sheet.paste(Image.open(p).resize((tw, th), Image.LANCZOS), (x, y))
    tag = "boundary %d" % b if o == 0 else ("%+d" % o)
    d.text((x + 3, y + th + 5), "f%d  t=%.3fs  %s" % (b + o, (b + o) / 30.0, tag),
           fill=(0, 0, 0))
out = os.path.join(BUILD, "transitions.png")
sheet.save(out)
print(out, sheet.size)
