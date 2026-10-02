"""Inspect source PNGs: size, mode, alpha silhouette at several thresholds."""
import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")

files = []
for base, _dirs, names in os.walk(ASSETS):
    for n in sorted(names):
        if n.lower().endswith(".png"):
            files.append(os.path.join(base, n))

rows = []
for f in sorted(files):
    im = Image.open(f)
    rel = os.path.relpath(f, ROOT).replace("\\", "/")
    info = {
        "file": rel,
        "size": list(im.size),
        "mode": im.mode,
    }
    if im.mode in ("RGBA", "LA"):
        a = im.getchannel("A")
        info["alpha_minmax"] = list(a.getextrema())
        info["bbox_a0"] = list(a.getbbox())  # any non-zero alpha
        for th in (8, 32, 128, 240):
            m = a.point(lambda v, t=th: 255 if v >= t else 0)
            bb = m.getbbox()
            info[f"bbox_a{th}"] = list(bb) if bb else None
        if info["bbox_a128"]:
            x0, y0, x1, y1 = info["bbox_a128"]
            info["sil_w"] = x1 - x0
            info["sil_h"] = y1 - y0
            info["sil_aspect"] = round(info["sil_w"] / info["sil_h"], 4)
    else:
        # sample edge colors
        w, h = im.size
        rgb = im.convert("RGB")
        pts = {
            "tl": (0, 0), "tr": (w - 1, 0), "bl": (0, h - 1), "br": (w - 1, h - 1),
            "top_mid": (w // 2, 0), "bot_mid": (w // 2, h - 1),
            "left_mid": (0, h // 2), "right_mid": (w - 1, h // 2),
            "c": (w // 2, h // 2),
        }
        info["edge_colors"] = {k: rgb.getpixel(v) for k, v in pts.items()}
    rows.append(info)

print(json.dumps(rows, indent=1))
