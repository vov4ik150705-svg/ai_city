"""Re-split merged crops via erode-then-grow. Does not touch art/raw."""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
MAGENTA = np.array([255, 0, 255], dtype=np.uint8)


def fg_mask(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    return ~((r > 240) & (g < 30) & (b > 240))


def erode(mask: np.ndarray, n: int) -> np.ndarray:
    out = mask.copy()
    for _ in range(n):
        p = np.pad(out, 1, constant_values=False)
        out = p[1:-1, 1:-1] & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    return out


def crop_magenta(rgb: np.ndarray, mask: np.ndarray) -> Image.Image:
    ys, xs = np.where(mask)
    if len(ys) == 0:
        return Image.fromarray(np.full((1, 1, 3), MAGENTA, dtype=np.uint8), "RGB")
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    tile = np.full((y1 - y0, x1 - x0, 3), MAGENTA, dtype=np.uint8)
    m = mask[y0:y1, x0:x1]
    tile[m] = rgb[y0:y1, x0:x1][m]
    return Image.fromarray(tile, "RGB")


def split_erode(src: Path, erode_n: int = 2, min_area: int = 50) -> list[Image.Image]:
    rgb = np.array(Image.open(src).convert("RGB"))
    fg = fg_mask(rgb)
    seeds = erode(fg, erode_n)
    h, w = fg.shape
    labels = np.zeros((h, w), dtype=np.int32)
    q: deque[tuple[int, int]] = deque()
    lid = 0
    ys, xs = np.where(seeds)
    # label seed CCs first, then grow all labels at once so they compete
    for y0, x0 in zip(ys.tolist(), xs.tolist()):
        if labels[y0, x0]:
            continue
        lid += 1
        seed_q: deque[tuple[int, int]] = deque([(y0, x0)])
        labels[y0, x0] = lid
        while seed_q:
            y, x = seed_q.popleft()
            q.append((y, x))
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and seeds[ny, nx] and labels[ny, nx] == 0:
                    labels[ny, nx] = lid
                    seed_q.append((ny, nx))
    while q:
        y, x = q.popleft()
        lab = int(labels[y, x])
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and fg[ny, nx] and labels[ny, nx] == 0:
                labels[ny, nx] = lab
                q.append((ny, nx))
    parts: list[Image.Image] = []
    for i in range(1, lid + 1):
        m = labels == i
        if int(m.sum()) < min_area:
            continue
        parts.append(crop_magenta(rgb, m))
    parts.sort(key=lambda im: (-im.size[1] * im.size[0], -im.size[1]))
    return parts


def save_parts(parts: list[Image.Image], dests: list[Path], extra_prefix: str) -> None:
    inbox = ROOT / "inbox"
    inbox.mkdir(exist_ok=True)
    for i, im in enumerate(parts):
        if i < len(dests):
            dest = dests[i]
            dest.parent.mkdir(parents=True, exist_ok=True)
            im.save(dest)
            print(f"  {dest.relative_to(ROOT)} {im.size}")
        else:
            p = inbox / f"{extra_prefix}_{i:02d}_{im.size[0]}x{im.size[1]}.png"
            im.save(p)
            print(f"  extra {p.name} {im.size}")


def y_split(src: Path, cut: int) -> tuple[Image.Image, Image.Image]:
    rgb = np.array(Image.open(src).convert("RGB"))
    fg = fg_mask(rgb)
    top = fg.copy()
    top[cut:, :] = False
    bot = fg.copy()
    bot[:cut, :] = False
    return crop_magenta(rgb, top), crop_magenta(rgb, bot)


def main() -> None:
    src164 = ROOT / "_sliced" / "clear" / "clear_164_58x83_y534.png"
    print("lighthouse/boat y-split")
    top, bot = y_split(src164, 47)
    (ROOT / "port").mkdir(exist_ok=True)
    top.save(ROOT / "port" / "lighthouse.png")
    bot.save(ROOT / "port" / "boat_cabin.png")
    print("  port/lighthouse.png", top.size)
    print("  port/boat_cabin.png", bot.size)

    print("fx pad cluster")
    parts = split_erode(ROOT / "_sliced" / "clear" / "clear_089_79x104_y379.png", erode_n=1, min_area=80)
    save_parts(
        parts,
        [
            ROOT / "fx" / "glow_pad.png",
            ROOT / "fx" / "glow_beam.png",
            ROOT / "fx" / "glow_flame.png",
        ],
        "fx_cluster",
    )

    print("bus-stop cluster")
    parts = split_erode(ROOT / "_sliced" / "blocks" / "blocks_202_92x80_y540.png", erode_n=2, min_area=40)
    save_parts(
        parts,
        [
            ROOT / "decor" / "bus_stop.png",
            ROOT / "decor" / "district_billboard_02.png",
            ROOT / "decor" / "banner.png",
            ROOT / "decor" / "kiosk_02.png",
            ROOT / "decor" / "sign_post.png",
            ROOT / "decor" / "sign_post_02.png",
        ],
        "street_cluster",
    )

    print("small-decor cluster")
    parts = split_erode(ROOT / "_sliced" / "blocks" / "blocks_199_73x50_y528.png", erode_n=1, min_area=60)
    save_parts(
        parts,
        [ROOT / "decor" / "bench_03.png", ROOT / "decor" / "utility_box.png"],
        "small_decor",
    )

    print("island cluster")
    src165 = ROOT / "_sliced" / "clear" / "clear_165_90x111_y537.png"
    parts = split_erode(src165, erode_n=2, min_area=80)
    if len(parts) >= 2:
        save_parts(
            parts,
            [
                ROOT / "terrain" / "island_block.png",
                ROOT / "terrain" / "island_block_04.png",
                ROOT / "terrain" / "island_block_05.png",
                ROOT / "terrain" / "island_block_06.png",
                ROOT / "terrain" / "island_water.png",
            ],
            "island_cluster",
        )
    else:
        # keep as named cluster reference
        Image.open(src165).save(ROOT / "terrain" / "island_cluster.png")
        print("  kept as terrain/island_cluster.png")

    # boat_row is actually a glow orb — move if still the 18x18 icon
    row = ROOT / "port" / "boat_row.png"
    if row.exists():
        im = Image.open(row)
        if im.size[0] <= 22 and im.size[1] <= 22:
            dest = ROOT / "fx" / "glow_orb.png"
            dest.parent.mkdir(exist_ok=True)
            im.save(dest)
            row.unlink()
            print("renamed boat_row -> fx/glow_orb.png")

    stealth = ROOT / "vehicles" / "drone_stealth.png"
    if stealth.exists():
        stealth.unlink()
        print("deleted vehicles/drone_stealth.png (fragment)")


if __name__ == "__main__":
    main()
