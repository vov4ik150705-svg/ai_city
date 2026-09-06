"""Plant 18 named heroes onto the empty island. Placement is isometric UV."""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERO_DIR = Path(r"C:\Users\sk640\ai_city\docs\mockups\heroes")
ISLAND = Path(
    r"C:\Users\sk640\.cursor\projects\c-Users-sk640-ai-city\assets\island_empty_plaza_v2.png"
)
OUT = Path(r"C:\Users\sk640\ai_city\docs\mockups\island_mockup_v12.png")
OUT_DEBUG = Path(r"C:\Users\sk640\ai_city\docs\mockups\island_mockup_v12_debug.png")
OUT_ASSET = Path(
    r"C:\Users\sk640\.cursor\projects\c-Users-sk640-ai-city\assets\corporator_island_mockup_v12.png"
)
CHROMA_DIR = Path(r"C:\Users\sk640\ai_city\docs\mockups\chroma_debug")

# Screen-space feet on the tiled diamond (keep inland of rail / water).
# (id, foot_x, foot_y, height_frac)
PLANTS: list[tuple[str, float, float, float]] = [
    ("data_center", 0.50, 0.43, 0.16),
    ("ai_research_center", 0.38, 0.44, 0.24),
    ("cloud_campus", 0.62, 0.44, 0.28),
    ("robotics_lab", 0.54, 0.48, 0.17),
    ("finance_tower", 0.30, 0.51, 0.22),
    ("energy_plant", 0.68, 0.51, 0.18),
    ("agent_hub", 0.38, 0.53, 0.22),
    ("workshop", 0.62, 0.53, 0.19),
    ("city_hall", 0.50, 0.56, 0.32),
    ("drone_depot", 0.68, 0.57, 0.18),
    ("clearing_house", 0.30, 0.59, 0.15),
    ("bank", 0.39, 0.62, 0.20),
    ("power_node", 0.50, 0.63, 0.13),
    ("exchange", 0.58, 0.61, 0.18),
    ("logistics_hub", 0.64, 0.64, 0.17),
    ("flagship_store", 0.36, 0.66, 0.16),
    ("retail_complex", 0.46, 0.67, 0.16),
    ("fleet_yard", 0.56, 0.66, 0.15),
]


def find_hero(name: str) -> Path:
    for ext in (".png", ".jpg", ".jpeg"):
        path = HERO_DIR / f"{name}{ext}"
        if path.exists():
            return path
    raise FileNotFoundError(name)


def studio_pixels(rgb: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0]
    g = rgb[:, :, 1]
    b = rgb[:, :, 2]
    h, w = r.shape
    keys = np.stack(
        [
            rgb[2, 2],
            rgb[2, w - 3],
            rgb[h - 3, 2],
            rgb[h - 3, w - 3],
        ],
        axis=0,
    ).astype(np.float32)
    dist = np.min(
        np.sqrt(((rgb[:, :, None, :] - keys[None, None, :, :]) ** 2).sum(axis=3)),
        axis=2,
    )
    hot_pink = (r > 145) & (g < 175) & (b > 65) & (r > g + 12)
    dark_red = (r > 30) & (g < 85) & (b < 95) & (r > g + 18) & (r >= b - 12)
    return (dist < 78) & (hot_pink | dark_red)


def flood_from_border(mask: np.ndarray) -> np.ndarray:
    """Keep studio only if it touches the frame — do not eat interior sign plates."""
    h, w = mask.shape
    step = 4
    sh, sw = h // step, w // step
    small = np.array(
        Image.fromarray(mask.astype(np.uint8) * 255, mode="L").resize(
            (sw, sh), Image.Resampling.NEAREST
        )
    ) > 127
    vis = np.zeros((sh, sw), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def seed(y: int, x: int) -> None:
        if y < 0 or x < 0 or y >= sh or x >= sw or vis[y, x] or not small[y, x]:
            return
        vis[y, x] = True
        q.append((y, x))

    for x in range(sw):
        seed(0, x)
        seed(sh - 1, x)
    for y in range(sh):
        seed(y, 0)
        seed(y, sw - 1)
    while q:
        y, x = q.popleft()
        seed(y - 1, x)
        seed(y + 1, x)
        seed(y, x - 1)
        seed(y, x + 1)
    full = np.array(
        Image.fromarray(vis.astype(np.uint8) * 255, mode="L").resize(
            (w, h), Image.Resampling.NEAREST
        )
    ) > 127
    grown = Image.fromarray(full.astype(np.uint8) * 255, mode="L")
    grown = grown.filter(ImageFilter.MaxFilter(5))
    return np.asarray(grown) > 127


def chroma_rgba(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    arr = np.asarray(im)
    bg = flood_from_border(studio_pixels(arr[:, :, :3].astype(np.float32)))
    alpha = np.where(bg, 0, arr[:, :, 3]).astype(np.uint8)
    alpha_img = Image.fromarray(alpha, mode="L")
    alpha_img = alpha_img.filter(ImageFilter.MinFilter(3))
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(0.4))
    out = im.copy()
    out.putalpha(alpha_img)
    bbox = out.getbbox()
    if bbox is None:
        raise RuntimeError(f"empty after chroma: {path.name}")
    return out.crop(bbox)


def scale_sprite(im: Image.Image, target_h: int, max_w: int) -> Image.Image:
    w, h = im.size
    nh = max(8, target_h)
    nw = max(8, int(round(w * nh / h)))
    if nw > max_w:
        nw = max_w
        nh = max(8, int(round(h * nw / w)))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def screen_foot(xf: float, yf: float, width: int, height: int) -> tuple[int, int]:
    return int(round(xf * width)), int(round(yf * height))


def contact_shadow(sw: int, sh: int) -> Image.Image:
    hw = max(8, sh // 8)
    yy = np.linspace(-1.0, 1.0, hw)[:, None]
    xx = np.linspace(-1.0, 1.0, sw)[None, :]
    fall = np.clip(1.0 - np.sqrt((xx * 0.5) ** 2 + (yy * 1.15) ** 2), 0, 1)
    sh_arr = np.zeros((hw, sw, 4), dtype=np.uint8)
    sh_arr[:, :, 3] = (fall * 55).astype(np.uint8)
    return Image.fromarray(sh_arr, "RGBA")


def main() -> None:
    names = [p[0] for p in PLANTS]
    if len(set(names)) != 18:
        raise SystemExit(f"need 18 unique ids, got {sorted(set(names))}")
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    base = Image.open(ISLAND).convert("RGBA")
    base = base.resize((1920, 1080), Image.Resampling.LANCZOS)
    width, height = base.size
    max_w = int(width * 0.16)
    sprites: list[tuple[float, Image.Image, int, int, str, int, int]] = []
    for name, xf, yf, hfrac in PLANTS:
        cut = chroma_rgba(find_hero(name))
        cut.save(CHROMA_DIR / f"{name}.png")
        sprite = scale_sprite(cut, int(height * hfrac), max_w)
        sw, sh = sprite.size
        fx, fy = screen_foot(xf, yf, width, height)
        x = fx - sw // 2
        y = fy - sh
        sprites.append((fy + xf, sprite, x, y, name, fx, fy))
        print(f"plant {name:22} {sw:4}x{sh:<4} foot=({fx},{fy}) frac=({fx/width:.3f},{fy/height:.3f})")
    sprites.sort(key=lambda t: t[0])
    canvas = base.copy()
    for _k, sprite, x, y, name, fx, fy in sprites:
        sw, sh = sprite.size
        shadow = contact_shadow(sw, sh)
        sx = x
        sy = y + sh - shadow.size[1] // 2
        canvas.alpha_composite(shadow, (sx, sy))
        canvas.alpha_composite(sprite, (x, y))
    rgb = canvas.convert("RGB")
    rgb.save(OUT, "PNG")
    rgb.save(OUT_ASSET, "PNG")
    debug = rgb.copy()
    draw = ImageDraw.Draw(debug)
    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except OSError:
        font = ImageFont.load_default()
    hx, hy = screen_foot(0.50, 0.54, width, height)
    draw.ellipse((hx - 6, hy - 6, hx + 6, hy + 6), outline=(255, 255, 0), width=2)
    for _k, sprite, x, y, name, fx, fy in sprites:
        draw.ellipse((fx - 3, fy - 3, fx + 3, fy + 3), fill=(255, 80, 0))
        draw.text((fx + 5, fy - 12), name, fill=(255, 255, 255), font=font)
    debug.save(OUT_DEBUG, "PNG")
    print(f"wrote {OUT} {rgb.size} n={len(PLANTS)}")


if __name__ == "__main__":
    main()
