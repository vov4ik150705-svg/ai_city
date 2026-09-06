"""Append-only 15-way road/sidewalk cubes and water frames. TZ_ART §3, R-V-24, D-V-12.

Does not rewrite existing *_v2.png. Road paint is the asphalt band only, clipped to the
painterly cap. Sidewalk keeps the pavers and adds a curb. Water frames shift caustics
inside the original top, never onto the key. Diffusion is not used.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

PIPE = Path(__file__).resolve().parent
REPO = PIPE.parent.parent
if str(PIPE) not in sys.path:
    sys.path.insert(0, str(PIPE))
import tiles  # noqa: E402

TERRAIN = REPO / "assets" / "terrain"
ROAD_BASE = TERRAIN / "road_plaza_v2.png"
SIDEWALK_BASE = TERRAIN / "sidewalk_v2.png"
WATER_SHALLOW = TERRAIN / "water_tile_v2.png"
TEX_HI = 512
# Top-face diamond height / bbox width. bw//2 paints over dirt sides (R-V-24).
TOP_H_NUM = 38
TOP_H_DEN = 100
CURB_RGB = np.array([0x3A, 0x3F, 0x4D], dtype=np.uint8)
NAVY = np.array([0x24, 0x31, 0x4A], dtype=np.int16)
KERB_C = np.array([0x70, 0x7B, 0x92], dtype=np.int16)
DASH_C = np.array([0xC4, 0x7A, 0x1A], dtype=np.int16)
PROTECTED = {
    "road_plaza",
    "road_cross",
    "road_straight",
    "road_turn",
    "road_end",
    "sidewalk",
    "water_tile",
    "water_tile_02",
}
WATER_PHASES = (
    ("water_tile_03", 0.04, 0.02),
    ("water_tile_04", 0.08, 0.04),
    ("water_tile_05", 0.12, 0.06),
)


def _keyish(rgb: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.int32)
    g = rgb[:, :, 1].astype(np.int32)
    b = rgb[:, :, 2].astype(np.int32)
    exact = (rgb[:, :, 0] == 255) & (rgb[:, :, 1] == 0) & (rgb[:, :, 2] == 255)
    bleed = (r > 180) & (b > 180) & (g < 90) & ((r + b - 2 * g) > 180)
    return exact | bleed


def _object_bbox(rgb: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.where(~_keyish(rgb))
    if len(xs) == 0:
        raise SystemExit("autotile: base cube is fully keyed")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def _diamond_grid(bw: int, dh: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    ys, xs = np.mgrid[0:dh, 0:bw]
    cx, cy = (bw - 1) / 2.0, (dh - 1) / 2.0
    inside = np.abs(xs - cx) / max(bw / 2.0, 1.0) + np.abs(ys - cy) / max(dh / 2.0, 1.0) <= 1.0
    su = (xs - bw / 2.0) / max(bw / 2.0, 1.0)
    sv = ys / max(dh / 2.0, 1.0)
    u = np.clip((su + sv) / 2.0, 0.0, 1.0)
    v = np.clip((sv - su) / 2.0, 0.0, 1.0)
    return inside, u, v


def _slice(rgb: np.ndarray, x0: int, y0: int, bw: int, dh: int) -> tuple[slice, slice, int, int]:
    y_slice = slice(y0, min(y0 + dh, rgb.shape[0]))
    x_slice = slice(x0, min(x0 + bw, rgb.shape[1]))
    return y_slice, x_slice, y_slice.stop - y_slice.start, x_slice.stop - x_slice.start


def _top_uv(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, slice, slice]:
    x0, y0, x1, _y1 = _object_bbox(rgb)
    bw = x1 - x0
    dh = max(1, (bw * TOP_H_NUM) // TOP_H_DEN)
    inside, u, v = _diamond_grid(bw, dh)
    y_slice, x_slice, hh, ww = _slice(rgb, x0, y0, bw, dh)
    dest = rgb[y_slice, x_slice]
    hit = inside[:hh, :ww] & ~_keyish(dest)
    return hit, u[:hh, :ww], v[:hh, :ww], y_slice, x_slice


def _erode_n(mask: np.ndarray, radius: int) -> np.ndarray:
    out = mask
    for _ in range(max(1, radius)):
        out = tiles.erode(out)
    return out


def _band_uv(u: np.ndarray, v: np.ndarray, dirs: tuple[str, ...]) -> np.ndarray:
    half = tiles.ROAD_HALF
    band = (np.abs(u - 0.5) <= half) & (np.abs(v - 0.5) <= half)
    if "SE" in dirs:
        band |= (u >= 0.5) & (np.abs(v - 0.5) <= half)
    if "NW" in dirs:
        band |= (u <= 0.5) & (np.abs(v - 0.5) <= half)
    if "SW" in dirs:
        band |= (v >= 0.5) & (np.abs(u - 0.5) <= half)
    if "NE" in dirs:
        band |= (v <= 0.5) & (np.abs(u - 0.5) <= half)
    return band


def _mix(src: np.ndarray, tint: np.ndarray, keep: int) -> np.ndarray:
    rest = 100 - keep
    return np.clip((src.astype(np.int16) * keep + tint * rest) // 100, 0, 255).astype(np.uint8)


def _paint_road(rgb: np.ndarray, dirs: tuple[str, ...]) -> np.ndarray:
    hit, u, v, y_slice, x_slice = _top_uv(rgb)
    inner = _erode_n(hit, max(1, hit.shape[1] // 70))
    band = _band_uv(u, v, dirs) & inner
    out = rgb.copy()
    dest = out[y_slice, x_slice]
    orig = dest.copy()
    dest[band] = _mix(orig, NAVY, 8)[band]
    kerb = band & ~_erode_n(band, max(2, hit.shape[1] // 90))
    dest[kerb] = _mix(orig, KERB_C, 12)[kerb]
    if len(dirs) < 4:
        dash = np.zeros(band.shape, bool)
        hh, ww = band.shape
        step_x = (np.arange(ww) // max(1, ww // 12)) % 2 == 0
        step_y = (np.arange(hh) // max(1, hh // 12)) % 2 == 0
        if "SE" in dirs and "NW" in dirs:
            dash |= (np.abs(v - 0.5) < 0.018) & step_x[None, :]
        if "SW" in dirs and "NE" in dirs:
            dash |= (np.abs(u - 0.5) < 0.018) & step_y[:, None]
        dest[dash & band] = _mix(orig, DASH_C, 10)[dash & band]
    out[y_slice, x_slice] = dest
    return out


def _tex_sidewalk_hi(dirs: tuple[str, ...]) -> np.ndarray:
    size = TEX_HI
    uu = np.linspace(0.0, 1.0, size, endpoint=False)
    vv = uu[:, None]
    uu = uu[None, :]
    tex = np.zeros((size, size, 3), dtype=np.uint8)
    curb = np.zeros((size, size), bool)
    edge = 0.10
    if "SE" in dirs:
        curb |= uu >= 1.0 - edge
    if "NW" in dirs:
        curb |= uu <= edge
    if "SW" in dirs:
        curb |= vv >= 1.0 - edge
    if "NE" in dirs:
        curb |= vv <= edge
    tex[curb] = CURB_RGB
    return tex


def _paint_curb(rgb: np.ndarray, tex: np.ndarray) -> np.ndarray:
    hit, u, v, y_slice, x_slice = _top_uv(rgb)
    th, tw = tex.shape[0], tex.shape[1]
    ui = np.clip((u * (tw - 1)).astype(int), 0, tw - 1)
    vi = np.clip((v * (th - 1)).astype(int), 0, th - 1)
    sampled = tex[vi, ui]
    out = rgb.copy()
    dest = out[y_slice, x_slice]
    curb = np.all(sampled == CURB_RGB, axis=-1) & hit
    dest[curb] = sampled[curb]
    out[y_slice, x_slice] = dest
    return out


def _shift_caustic(rgb: np.ndarray, du: float, dv: float) -> np.ndarray:
    hit, _u, _v, y_slice, x_slice = _top_uv(rgb)
    src = rgb[y_slice, x_slice]
    hh, ww = src.shape[0], src.shape[1]
    dx = int(round(du * ww))
    dy = int(round(dv * hh))
    rolled = np.roll(np.roll(src, dy, axis=0), dx, axis=1)
    rolled_ok = np.roll(np.roll(hit, dy, axis=0), dx, axis=1)
    out = rgb.copy()
    dest = out[y_slice, x_slice]
    write = hit & rolled_ok
    dest[write] = (
        (src[write].astype(np.int16) * 55 + rolled[write].astype(np.int16) * 45) // 100
    ).astype(np.uint8)
    out[y_slice, x_slice] = dest
    return out


def _write_rgb(path: Path, rgb: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb, "RGB").save(path, "PNG")


def emit_roads(*, replace: bool) -> list[str]:
    base = np.array(Image.open(ROAD_BASE).convert("RGB"))
    written: list[str] = []
    for mask, sid in enumerate(tiles.ROAD_AUTOTILE):
        dest = TERRAIN / f"{sid}_v2.png"
        if sid in PROTECTED:
            continue
        if dest.exists() and not replace:
            continue
        dirs = tiles.mask_uv_dirs(mask)
        _write_rgb(dest, _paint_road(base, dirs))
        written.append(sid)
    return written


def emit_sidewalks(*, replace: bool) -> list[str]:
    base = np.array(Image.open(SIDEWALK_BASE).convert("RGB"))
    written: list[str] = []
    for mask, sid in enumerate(tiles.SIDEWALK_AUTOTILE):
        dest = TERRAIN / f"{sid}_v2.png"
        if sid in PROTECTED:
            continue
        if dest.exists() and not replace:
            continue
        dirs = tiles.mask_uv_dirs(mask)
        tex = _tex_sidewalk_hi(dirs)
        _write_rgb(dest, _paint_curb(base, tex))
        written.append(sid)
    return written


def emit_water(*, replace: bool) -> list[str]:
    shallow = np.array(Image.open(WATER_SHALLOW).convert("RGB"))
    written: list[str] = []
    for sid, du, dv in WATER_PHASES:
        dest = TERRAIN / f"{sid}_v2.png"
        if dest.exists() and not replace:
            continue
        _write_rgb(dest, _shift_caustic(shallow, du, dv))
        written.append(sid)
    return written


def main() -> int:
    replace = "--replace-new" in sys.argv
    roads = emit_roads(replace=replace)
    walks = emit_sidewalks(replace=replace)
    water = emit_water(replace=replace)
    print(f"roads      : {len(roads)} new")
    print(f"sidewalks  : {len(walks)} new")
    print(f"water      : {len(water)} new")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
