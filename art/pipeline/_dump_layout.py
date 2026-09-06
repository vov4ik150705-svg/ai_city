import json
from pathlib import Path
from PIL import Image

pack = json.loads(Path("content/out/pack.json").read_text(encoding="utf-8"))
g = pack["generated"]["placement"]
print("keys", list(g.keys()))
lots = g.get("lots") or []
print("lots", type(lots), len(lots) if isinstance(lots, list) else lots)
if isinstance(lots, list) and lots:
    print("lot0", lots[0])
    print("zones", sorted({str(x.get("zone")) for x in lots if isinstance(x, dict)}))
scene = g.get("scene") or {}
grid = scene.get("map") or []
print("grid", len(grid), "x", len(grid[0]) if grid else 0)
xs: list[int] = []
ys: list[int] = []
for y, row in enumerate(grid):
    for x, ch in enumerate(row):
        if ch != "~":
            xs.append(x)
            ys.append(y)
print("land bbox", min(xs), min(ys), max(xs), max(ys), "n", len(xs))
assets = json.loads(Path("art/pipeline/assets.json").read_text(encoding="utf-8"))["assets"]
for a in assets:
    if a.get("kind") != "building":
        continue
    p = Path(a["file"])
    if p.exists():
        im = Image.open(p)
        print(f"{a['id']:24} fp={a.get('footprint')} png={im.size[0]}x{im.size[1]}")
