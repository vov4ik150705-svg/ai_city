"""Build a contact sheet of source assets for visual review."""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build")

names = [
    ("assets/island/island_hero.png", 760),
    ("assets/background/sky.png", 520),
    ("assets/brand/logo_solo.png", 300),
    ("assets/buildings/workshop.png", 300),
    ("assets/buildings/power_node.png", 300),
    ("assets/buildings/bank.png", 300),
    ("assets/buildings/agent_hub.png", 300),
    ("assets/buildings/ai_research_center.png", 300),
    ("assets/buildings/energy_plant.png", 300),
    ("assets/buildings/logistics_hub.png", 300),
    ("assets/buildings/flagship_store.png", 300),
    ("assets/buildings/cloud_campus.png", 300),
    ("assets/buildings/finance_tower.png", 300),
    ("assets/roles/engineer.png", 220),
    ("assets/roles/logistician.png", 220),
    ("assets/roles/manager.png", 220),
    ("assets/roles/scientist.png", 220),
    ("assets/roles/trader.png", 220),
]

COLS = 5
cell = 340
pad = 10
rows = (len(names) + COLS - 1) // COLS
sheet_w = COLS * (cell + pad) + pad
sheet_h = rows * (cell + pad + 22) + pad

# checkerboard so alpha is visible
sheet = Image.new("RGB", (sheet_w, sheet_h), (245, 245, 245))
from PIL import ImageDraw

d = ImageDraw.Draw(sheet)
for y in range(0, sheet_h, 16):
    for x in range(0, sheet_w, 16):
        if (x // 16 + y // 16) % 2 == 0:
            d.rectangle([x, y, x + 15, y + 15], fill=(228, 228, 228))

for i, (rel, box) in enumerate(names):
    r, c = divmod(i, COLS)
    ox = pad + c * (cell + pad)
    oy = pad + r * (cell + pad + 22)
    im = Image.open(os.path.join(ROOT, rel))
    im = im.convert("RGBA")
    im.thumbnail((cell, cell), Image.LANCZOS)
    sheet.paste(im, (ox + (cell - im.width) // 2, oy + (cell - im.height) // 2), im)
    d.text((ox + 2, oy + cell + 4), os.path.basename(rel), fill=(20, 20, 20))

p = os.path.join(OUT, "assets_contact.png")
sheet.save(p)
print(p, sheet.size)
