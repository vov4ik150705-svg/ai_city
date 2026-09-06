"""Corporator sprite normalisation pipeline.

Raw AI generations are high-resolution "pseudo pixel art": anti-aliased, off-grid
and carrying thousands of colours. This turns them into real game sprites that are
grid-aligned, palette-locked and sized to their isometric footprint.

    python art/pipeline/pixelize.py --report   analyse the raw files, write nothing
    python art/pipeline/pixelize.py            full run, writes out/ preview/ sheet
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "art"
CONFIG = ART / "pipeline" / "assets.json"
PALETTE_FILE = ART / "palette" / "corporator.hex"

CHROMA_KEY = np.array([255, 0, 255], dtype=np.float32)
SHEET_ZOOM = 3


def load_palette(path: Path) -> tuple[np.ndarray, dict[str, list[int]]]:
    colors: list[tuple[int, int, int]] = []
    ramps: dict[str, list[int]] = {}
    current = "outline"
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith(";="):
            current = line[2:].strip()
            ramps.setdefault(current, [])
            continue
        if not line or line.startswith(";"):
            continue
        line = line.lstrip("#")
        ramps.setdefault(current, []).append(len(colors))
        colors.append(tuple(int(line[i : i + 2], 16) for i in (0, 2, 4)))
    return np.array(colors, dtype=np.int16), ramps


def subpalette(palette: np.ndarray, ramps: dict[str, list[int]], allowed: list[str] | None) -> np.ndarray:
    if not allowed:
        return palette
    idx = list(ramps["outline"])
    for name in allowed:
        idx.extend(ramps[name])
    return palette[sorted(set(idx))]


def estimate_block_size(rgb: np.ndarray) -> int:
    """Mode of horizontal run lengths, which equals the pixel block size on clean pixel art."""
    runs: Counter[int] = Counter()
    step = max(1, rgb.shape[0] // 80)
    for y in range(0, rgb.shape[0], step):
        row = rgb[y]
        same = np.all(row[1:] == row[:-1], axis=-1)
        length = 1
        for s in same:
            if s:
                length += 1
            else:
                if 1 < length <= 32:
                    runs[length] += 1
                length = 1
    return runs.most_common(1)[0][0] if runs else 1


def key_out(rgb: np.ndarray, tol: float = 70.0, fringe: int = 35) -> np.ndarray:
    """Drop the magenta backdrop plus the anti-aliased halo it bleeds into the silhouette."""
    dist = np.linalg.norm(rgb.astype(np.float32) - CHROMA_KEY, axis=-1)
    magentaness = np.minimum(rgb[..., 0], rgb[..., 2]).astype(np.int16) - rgb[..., 1].astype(np.int16)
    return np.where((dist < tol) | (magentaness > fringe), 0, 255).astype(np.uint8)


def trim(rgb: np.ndarray, alpha: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    ys, xs = np.nonzero(alpha)
    if ys.size == 0:
        return rgb, alpha
    box = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
    return rgb[box], alpha[box]


def downsample(rgb: np.ndarray, alpha: np.ndarray, target_w: int) -> tuple[np.ndarray, np.ndarray]:
    """Per-block median. Nearest-neighbour would sample anti-aliasing artefacts as if
    they were art; the median of a block lands on the colour that actually dominates it."""
    h, w = alpha.shape
    target_h = max(1, int(round(h * target_w / w)))
    xs = np.linspace(0, w, target_w + 1).round().astype(int)
    ys = np.linspace(0, h, target_h + 1).round().astype(int)

    out_rgb = np.zeros((target_h, target_w, 3), dtype=np.uint8)
    out_a = np.zeros((target_h, target_w), dtype=np.uint8)
    for j in range(target_h):
        y0, y1 = ys[j], max(ys[j] + 1, ys[j + 1])
        for i in range(target_w):
            x0, x1 = xs[i], max(xs[i] + 1, xs[i + 1])
            blk_a = alpha[y0:y1, x0:x1].reshape(-1)
            if blk_a.mean() < 110:
                continue
            blk = rgb[y0:y1, x0:x1].reshape(-1, 3)
            opaque = blk[blk_a > 0]
            out_rgb[j, i] = np.median(opaque if opaque.size else blk, axis=0)
            out_a[j, i] = 255
    return out_rgb, out_a


def quantize(rgb: np.ndarray, palette: np.ndarray) -> np.ndarray:
    """Snap to the master palette using the redmean metric, which tracks perceived
    difference far better than plain RGB distance and needs no colour library."""
    flat = rgb.reshape(-1, 3).astype(np.float32)
    pal = palette.astype(np.float32)
    rbar = (flat[:, None, 0] + pal[None, :, 0]) / 2.0
    dr = flat[:, None, 0] - pal[None, :, 0]
    dg = flat[:, None, 1] - pal[None, :, 1]
    db = flat[:, None, 2] - pal[None, :, 2]
    dist = (2 + rbar / 256) * dr**2 + 4 * dg**2 + (2 + (255 - rbar) / 256) * db**2
    return pal[dist.argmin(axis=1)].astype(np.uint8).reshape(rgb.shape)


def add_outline(rgb: np.ndarray, alpha: np.ndarray, color: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Grow a 1px ring outside the silhouette so the sprite reads against any tile."""
    a = np.pad(alpha, 1)
    c = np.pad(rgb, ((1, 1), (1, 1), (0, 0)))
    solid = a > 0
    ring = np.zeros_like(solid)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        ring |= np.roll(np.roll(solid, dy, 0), dx, 1)
    ring &= ~solid
    c[ring] = color
    a[ring] = 255
    return c, a


def to_image(rgb: np.ndarray, alpha: np.ndarray) -> Image.Image:
    return Image.fromarray(np.dstack([rgb, alpha]), mode="RGBA")


def process(
    asset: dict,
    palette: np.ndarray,
    ramps: dict[str, list[int]],
    half_tile: int,
    outline: bool,
    report_only: bool,
) -> dict:
    raw_name = str(asset.get("raw") or f"raw_{asset['id']}.png")
    src = Image.open(ART / "raw" / raw_name).convert("RGB")
    rgb = np.asarray(src)
    pal = subpalette(palette, ramps, asset.get("ramps"))

    cols, rows = asset["footprint"]
    base_w = (cols + rows) * half_tile

    stats = {
        "id": asset["id"],
        "raw_size": f"{src.width}x{src.height}",
        "raw_colors": len(np.unique(rgb.reshape(-1, 3), axis=0)),
        "block": estimate_block_size(rgb),
        "footprint": f"{cols}x{rows}",
        "base_w": base_w,
        "pal": len(pal),
    }

    alpha = key_out(rgb)
    rgb, alpha = trim(rgb, alpha)
    stats["keyed_size"] = f"{alpha.shape[1]}x{alpha.shape[0]}"

    if "sprite_w" in asset:
        target_w = asset["sprite_w"]
    elif "sprite_h" in asset:
        # Tall thin deco reads by height, not by footprint width.
        target_w = max(1, round(alpha.shape[1] * asset["sprite_h"] / alpha.shape[0]))
    else:
        target_w = base_w

    rgb, alpha = downsample(rgb, alpha, target_w)
    rgb = quantize(rgb, pal)
    if outline:
        rgb, alpha = add_outline(rgb, alpha, palette[0].astype(np.uint8))
    rgb, alpha = trim(rgb, alpha)

    stats["sprite_size"] = f"{alpha.shape[1]}x{alpha.shape[0]}"
    used = np.unique(rgb[alpha > 0].reshape(-1, 3), axis=0)
    stats["sprite_colors"] = len(used)

    img = to_image(rgb, alpha)
    # The anchor is the pixel that lands on the front (bottom) corner of the footprint
    # diamond. Everything downstream positions sprites by this point, never by a corner.
    anchor = asset.get("anchor", [img.width // 2, img.height])
    if not report_only:
        img.save(ART / "out" / f"{asset['id']}.png")
        img.resize((img.width * 4, img.height * 4), Image.NEAREST).save(
            ART / "preview" / f"{asset['id']}@4x.png"
        )
    return stats | {"image": img, "anchor": anchor, "cols": cols, "rows": rows}


def contact_sheet(results: list[dict], half_tile: int, path: Path) -> None:
    """Every sprite dropped onto its own footprint diamond. If the style holds, the
    three read as one set here; if it does not, this is where it shows."""
    gap = 24
    cell_w = [max(r["image"].width, r["base_w"]) + gap for r in results]
    sheet_h = max(r["image"].height for r in results) + half_tile + gap * 2
    sheet = Image.new("RGBA", (sum(cell_w) + gap, sheet_h), (18, 22, 34, 255))
    draw = ImageDraw.Draw(sheet)

    x = gap
    baseline = sheet_h - gap
    for r, w in zip(results, cell_w):
        img, base_w = r["image"], r["base_w"]
        cx = x + w // 2
        half_h = base_w // 4
        draw.polygon(
            [(cx - base_w // 2, baseline - half_h), (cx, baseline - half_h * 2),
             (cx + base_w // 2, baseline - half_h), (cx, baseline)],
            outline=(70, 90, 120, 255),
        )
        ax, ay = r["anchor"]
        sheet.alpha_composite(img, (cx - ax, baseline - ay))
        x += w

    sheet.resize((sheet.width * SHEET_ZOOM, sheet.height * SHEET_ZOOM), Image.NEAREST).save(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", action="store_true", help="analyse only, write no files")
    args = parser.parse_args()

    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    palette, ramps = load_palette(PALETTE_FILE)
    half_tile = cfg["tile_w"] // 2

    for d in ("out", "preview"):
        (ART / d).mkdir(parents=True, exist_ok=True)

    print(f"palette: {len(palette)} colours in {len(ramps)} ramps "
          f"({', '.join(ramps)})\n")

    header = (f"{'asset':<20}{'raw':>10}{'colors':>9}{'blk':>5}{'keyed':>11}"
              f"{'foot':>6}{'sprite':>10}{'pal':>5}{'used':>6}")
    print(header)
    print("-" * len(header))

    results = []
    for asset in cfg["assets"]:
        s = process(asset, palette, ramps, half_tile, cfg.get("outline", True), args.report)
        results.append(s)
        print(f"{s['id']:<20}{s['raw_size']:>10}{s['raw_colors']:>9}{s['block']:>5}"
              f"{s['keyed_size']:>11}{s['footprint']:>6}{s['sprite_size']:>10}"
              f"{s['pal']:>5}{s['sprite_colors']:>6}")

    if not args.report:
        contact_sheet(results, half_tile, ART / "preview" / "contact_sheet.png")
        manifest = {
            "tile_w": cfg["tile_w"],
            "sprites": {
                r["id"]: {
                    "file": f"{r['id']}.png",
                    "footprint": [r["cols"], r["rows"]],
                    "size": [r["image"].width, r["image"].height],
                    "anchor": list(r["anchor"]),
                }
                for r in results
            },
        }
        (ART / "out" / "sprites.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        print(f"\nwrote {len(results)} sprites to art/out, previews to art/preview, "
              f"manifest to art/out/sprites.json")


if __name__ == "__main__":
    main()
