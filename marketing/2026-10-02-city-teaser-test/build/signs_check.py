"""Close crops of every sign used in the teaser, straight from the source PNGs."""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build")

# (file, crop box in source px or None for whole silhouette, caption)
ITEMS = [
    ("assets/buildings/energy_plant.png", (980, 260, 1140, 520), "Energy Plant: TESLA"),
    ("assets/buildings/agent_hub.png", (240, 480, 1140, 700), "Agent Hub: AGENT HUB x2"),
    ("assets/buildings/flagship_store.png", (520, 300, 900, 620), "Flagship Store: Apple"),
    ("assets/buildings/finance_tower.png", (300, 130, 700, 420), "Finance Tower: COINBASE"),
    ("assets/buildings/ai_research_center.png", (380, 780, 700, 960), "AI Research Center: NVIDIA"),
    ("assets/buildings/cloud_campus.png", (300, 700, 780, 960), "Cloud Campus: MICROSOFT"),
    ("assets/buildings/logistics_hub.png", (120, 330, 1240, 700), "Logistics Hub: amazon / a / LOGISTICS HUB"),
    ("assets/buildings/power_node.png", (219, 700, 900, 1000), "Power Node: POWER NODE"),
]

cell = 900
pad = 12
rows = len(ITEMS)
sheet = Image.new("RGB", (cell + 2 * pad, rows * (cell // 2 + 46) + pad), (240, 240, 240))
d = ImageDraw.Draw(sheet)
y = pad
for rel, box, cap in ITEMS:
    im = Image.open(os.path.join(ROOT, rel)).convert("RGBA")
    if box:
        im = im.crop(box)
    bg = Image.new("RGBA", im.size, (250, 250, 250, 255))
    bg.alpha_composite(im)
    bg = bg.convert("RGB")
    sc = min((cell) / bg.width, (cell // 2) / bg.height)
    bg = bg.resize((max(1, int(bg.width * sc)), max(1, int(bg.height * sc))),
                   Image.LANCZOS)
    sheet.paste(bg, (pad + (cell - bg.width) // 2, y))
    d.text((pad + 4, y + cell // 2 + 8), cap, fill=(0, 0, 0))
    y += cell // 2 + 46
sheet.save(os.path.join(OUT, "signs_check.png"))
print(os.path.join(OUT, "signs_check.png"), sheet.size)
