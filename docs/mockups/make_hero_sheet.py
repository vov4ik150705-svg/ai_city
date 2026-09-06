from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERO_DIR = Path(r"C:\Users\sk640\ai_city\docs\mockups\heroes")
OUT = Path(r"C:\Users\sk640\ai_city\docs\mockups\hero_contact_sheet.png")

# Catalog order: core, then beacons, then synergies.
ORDER = [
    "city_hall",
    "agent_hub",
    "workshop",
    "power_node",
    "bank",
    "exchange",
    "finance_tower",
    "ai_research_center",
    "energy_plant",
    "logistics_hub",
    "flagship_store",
    "cloud_campus",
    "clearing_house",
    "robotics_lab",
    "drone_depot",
    "data_center",
    "fleet_yard",
    "retail_complex",
]


def load(name: str) -> Image.Image:
    for ext in (".png", ".jpg", ".jpeg"):
        path = HERO_DIR / f"{name}{ext}"
        if path.exists():
            return Image.open(path).convert("RGB")
    raise FileNotFoundError(name)


def fit(im: Image.Image, size: int) -> Image.Image:
    w, h = im.size
    scale = size / max(w, h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    cell = Image.new("RGB", (size, size), (18, 18, 22))
    cell.paste(im, ((size - nw) // 2, (size - nh) // 2))
    return cell


def main() -> None:
    cell, label_h, cols = 512, 52, 6
    rows = 3
    sheet = Image.new("RGB", (cols * cell, rows * (cell + label_h)), (10, 10, 14))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 30)
    except OSError:
        font = ImageFont.load_default()
    for i, name in enumerate(ORDER):
        c = fit(load(name), cell)
        x, y = (i % cols) * cell, (i // cols) * (cell + label_h)
        sheet.paste(c, (x, y))
        draw.rectangle((x, y + cell, x + cell, y + cell + label_h), fill=(10, 10, 14))
        draw.text((x + 12, y + cell + 12), name, fill=(255, 255, 255), font=font)
    sheet.save(OUT, "PNG")
    print(f"wrote {OUT} {sheet.size}")


if __name__ == "__main__":
    main()
