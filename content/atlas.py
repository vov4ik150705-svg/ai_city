"""Deterministic painterly atlas packer. V1, TZ_RENDER §3, D-V-5 / D-V-12.

Source PNGs are not rewritten. Frames are keyed to alpha, cropped, and scaled to
the footprint-derived game size so the page and the byte cap both fit.
"""

from __future__ import annotations

import hashlib
import io
import json
import math
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

from pack import OUT_DIR, PARAM_DIR, REPO, canonical, load_json

ASSETS_PATH = REPO / "art" / "pipeline" / "assets.json"
PALETTE_PATH = REPO / "art" / "palette" / "corporator.hex"
ATLAS_DIR = OUT_DIR / "atlas"
FONT_TTF = REPO / "art" / "fonts" / "press_start_2p.ttf"
GLYPHS_PATH = REPO / "art" / "pipeline" / "glyphs.txt"
PIPE = REPO / "art" / "pipeline"
ASSET_CATS = (
    "buildings",
    "terrain",
    "decor",
    "foliage",
    "vehicles",
    "agents",
    "port",
    "fx",
)
WALL_RAMPS = frozenset({"concrete", "steel", "navy"})
KIND_BY_CAT = {
    "buildings": "building",
    "decor": "decor",
    "foliage": "decor",
    "vehicles": "unit",
    "agents": "unit",
    "fx": "glyph",
}
ALIASES = {
    "vehicle": "assets/vehicles/vehicle_car_v2.png",
    "mini_island": "assets/terrain/island_block_v2.png",
}
ART_OUT = REPO / "art" / "out"
TILE_STEMS = frozenset(
    {
        "island_block",
        "plaza_tile",
        "masonry",
        "parking",
        "beach",
        "crosswalk",
        "waterfall",
        "water_tile",
        "water_tile_02",
    }
)


def atlas_source(row: dict) -> tuple[Path, bool]:
    """Prefer pixelize / diamond tiles. ready=True means already game-sized."""
    sid = str(row.get("id") or "")
    tilep = ART_OUT / "tiles" / f"{sid}.png"
    outp = ART_OUT / f"{sid}.png"
    if tilep.is_file() and (
        sid in TILE_STEMS or sid.startswith(("road_", "sidewalk"))
    ):
        return tilep, True
    if outp.is_file():
        return outp, True
    return REPO / str(row.get("file") or ""), False

_CACHE: dict | None = None


def _param(data: dict, name: str, default: int = 0) -> int:
    row = (((data.get("render") or {}).get("params") or {}).get(name) or {})
    try:
        return int(row.get("v") if row.get("v") is not None else default)
    except (TypeError, ValueError):
        return default


def load_registry(overlay: dict | None = None) -> dict:
    if isinstance(overlay, dict) and overlay.get("assets"):
        blob = overlay
    else:
        blob = load_json(ASSETS_PATH) if ASSETS_PATH.exists() else {"tile_w": 64, "assets": []}
    rows = list(blob.get("assets") or [])
    by_id = {str(row["id"]): row for row in rows if row.get("id")}
    return {"tile_w": int(blob.get("tile_w") or 64), "assets": rows, "by_id": by_id}


def load_palette() -> tuple[np.ndarray, dict[str, list[int]]]:
    colors: list[tuple[int, int, int]] = []
    ramps: dict[str, list[int]] = {}
    current = "outline"
    for raw in PALETTE_PATH.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith(";="):
            current = line[2:].strip()
            ramps.setdefault(current, [])
            continue
        if not line or line.startswith(";"):
            continue
        line = line.lstrip("#")
        ramps.setdefault(current, []).append(len(colors))
        colors.append((int(line[0:2], 16), int(line[2:4], 16), int(line[4:6], 16)))
    return np.array(colors, dtype=np.int16), ramps


def palette_sha256() -> str:
    return hashlib.sha256(PALETTE_PATH.read_bytes()).hexdigest()


def key_to_rgba(rgb: np.ndarray) -> np.ndarray:
    """Edge flood-fill of the magenta key into alpha. Same cand as assets/_regen_key.py."""
    h, w = rgb.shape[:2]
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    cand = (r > 180) & (b > 180) & (g < 90) & ((r.astype(np.int32) + b.astype(np.int32) - 2 * g.astype(np.int32)) > 180)
    cand = cand | ((rgb[:, :, 0] == 255) & (rgb[:, :, 1] == 0) & (rgb[:, :, 2] == 255))
    seen = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        if cand[0, x]:
            q.append((0, x))
        if cand[h - 1, x]:
            q.append((h - 1, x))
    for y in range(h):
        if cand[y, 0]:
            q.append((y, 0))
        if cand[y, w - 1]:
            q.append((y, w - 1))
    while q:
        y, x = q.popleft()
        if seen[y, x] or not cand[y, x]:
            continue
        seen[y, x] = True
        if y > 0 and not seen[y - 1, x]:
            q.append((y - 1, x))
        if y + 1 < h and not seen[y + 1, x]:
            q.append((y + 1, x))
        if x > 0 and not seen[y, x - 1]:
            q.append((y, x - 1))
        if x + 1 < w and not seen[y, x + 1]:
            q.append((y, x + 1))
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = rgb
    rgba[:, :, 3] = np.where(seen, 0, 255)
    rgba[seen, :3] = 0
    return rgba


def crop_rgba(rgba: np.ndarray) -> np.ndarray:
    a = rgba[:, :, 3]
    ys, xs = np.where(a > 0)
    if xs.size == 0:
        return rgba[:1, :1].copy()
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    return rgba[y0 : y1 + 1, x0 : x1 + 1].copy()


def _skirt_ys(alpha: np.ndarray) -> np.ndarray:
    """Lowest opaque row per column. Image y grows down."""
    h, w = alpha.shape
    skirt = np.full(w, -1, dtype=np.int32)
    ys, xs = np.where(alpha)
    if xs.size == 0:
        return skirt
    np.maximum.at(skirt, xs, ys.astype(np.int32, copy=False))
    return skirt


def _edge_abs_deg(front: np.ndarray, p: np.ndarray) -> float:
    dx = abs(float(p[0] - front[0]))
    dy = abs(float(p[1] - front[1]))
    if dx == 0.0 and dy == 0.0:
        return 0.0
    return math.degrees(math.atan2(dy, dx))


def triangle_iso_err(tri: tuple[np.ndarray, np.ndarray, np.ndarray]) -> float:
    """Sum of |edge angle − atan2(1, 2)|. 2:1 iso is the lot diamond, not a cube side."""
    front, left, right = tri
    target = math.degrees(math.atan2(1.0, 2.0))
    return abs(_edge_abs_deg(front, left) - target) + abs(_edge_abs_deg(front, right) - target)


def foundation_triangle(
    rgba: np.ndarray, footprint: list | tuple | None = None
) -> tuple[np.ndarray, np.ndarray, np.ndarray] | None:
    """Front / left / right of the painted base skirt. Image y grows down."""
    a = rgba[:, :, 3] > 32
    h, w = a.shape
    skirt = _skirt_ys(a)
    xs = np.flatnonzero(skirt >= 0)
    if xs.size < 8:
        return None
    front_y = int(skirt.max())
    plateau = xs[skirt[xs] >= front_y - 1]
    front_x = float(int(plateau.min()) + int(plateau.max())) / 2.0
    cols, rows = 1, 1
    if footprint is not None and len(footprint) >= 2:
        cols = max(1, int(footprint[0] or 1))
        rows = max(1, int(footprint[1] or 1))
    span = max(1, cols + rows)
    half = float(w) / float(span)
    qh = half / 2.0
    band = int(max(8.0, float(max(cols, rows)) * qh + 8.0))
    in_band = xs[skirt[xs] >= front_y - band]
    if in_band.size < 4:
        return None
    left_x = int(in_band.min())
    right_x = int(in_band.max())
    left = np.array([float(left_x), float(skirt[left_x])])
    right = np.array([float(right_x), float(skirt[right_x])])
    front = np.array([front_x, float(front_y)])
    if left[1] >= front[1] - 1.0 or right[1] >= front[1] - 1.0:
        return None
    area = abs(
        float((left[0] - front[0]) * (right[1] - front[1]) - (left[1] - front[1]) * (right[0] - front[0]))
    )
    if area < 64.0:
        return None
    return front, left, right


def sprite_foot_xy(width: int, height: int, row: dict) -> tuple[int, int]:
    """Lot-front pixel. Square lots use mid-bottom; 3×2 uses cols/(cols+rows) of width (R-V-50)."""
    w, h = int(width), int(height)
    if w <= 0 or h <= 0:
        return 0, 0
    kind = str(row.get("kind") or "")
    sid = str(row.get("id") or "")
    if kind != "building" or sid in PLOT_BUILDINGS:
        return w // 2, h
    fp = row.get("footprint") or [1, 1]
    cols = max(1, int(fp[0] or 1))
    rows = max(1, int(fp[1] or 1))
    span = cols + rows
    ax = (w * cols + span // 2) // span
    return min(max(0, ax), w), h


def sprite_foot_anchor(rgba: np.ndarray, row: dict) -> tuple[int, int]:
    return sprite_foot_xy(int(rgba.shape[1]), int(rgba.shape[0]), row)


def prepare_sprite_rgba(row: dict, rgba: np.ndarray) -> np.ndarray:
    """Crop keyed RGBA. Buildings are not sheared: a shear leans walls (R-V-50)."""
    return crop_rgba(rgba)


def scale_rgba(rgba: np.ndarray, target_w: int, target_h: int | None = None) -> np.ndarray:
    h, w = rgba.shape[:2]
    tw = max(1, int(target_w))
    if target_h is None:
        th = max(1, int(round(tw * h / w))) if w else 1
    else:
        th = max(1, int(target_h))
    im = Image.fromarray(rgba, "RGBA").resize((tw, th), Image.Resampling.LANCZOS)
    out = np.array(im, dtype=np.uint8)
    mag = (out[:, :, 0] == 255) & (out[:, :, 1] == 0) & (out[:, :, 2] == 255)
    out[mag, 3] = 0
    out[out[:, :, 3] == 0, :3] = 0
    return out


def _ramp_index(palette: np.ndarray, ramps: dict[str, list[int]]) -> np.ndarray:
    idx_to_ramp = np.empty(len(palette), dtype=object)
    for name, ids in ramps.items():
        for i in ids:
            idx_to_ramp[i] = name
    return idx_to_ramp


def nearest_ramp_map(rgb: np.ndarray, palette: np.ndarray, ramp_of: np.ndarray) -> np.ndarray:
    """Classify each pixel by redmean-nearest palette colour. Transparent stays ''."""
    h, w, _ = rgb.shape
    pix = rgb.reshape(-1, 3).astype(np.int32)
    pal = palette.astype(np.int32)
    pr = pal[:, 0]
    mean = (pix[:, 0:1] + pr.reshape(1, -1)) // 2
    dr = pix[:, 0:1] - pr.reshape(1, -1)
    dg = pix[:, 1:2] - pal[:, 1].reshape(1, -1)
    db = pix[:, 2:3] - pal[:, 2].reshape(1, -1)
    dist = ((512 + mean) * dr * dr) // 256 + 4 * dg * dg + ((767 - mean) * db * db) // 256
    nearest = np.argmin(dist, axis=1)
    names = ramp_of[nearest].reshape(h, w)
    return names


def glow_mask(
    rgba: np.ndarray,
    *,
    kind: str,
    emissive: int,
    window_g: int,
    sign_g: int,
    palette: np.ndarray,
    ramp_of: np.ndarray,
    sign_box: list[int] | None,
) -> np.ndarray:
    h, w = rgba.shape[:2]
    glow = np.zeros((h, w), dtype=np.uint8)
    opaque = rgba[:, :, 3] > 0
    if emissive:
        glow[opaque] = np.uint8(sign_g)
        return glow
    names = nearest_ramp_map(rgba[:, :, :3], palette, ramp_of)
    amber = opaque & (names == "amber")
    wall = np.zeros((h, w), dtype=bool)
    for ramp in WALL_RAMPS:
        wall |= names == ramp
    wall &= opaque
    if amber.any():
        up = np.zeros((h, w), dtype=bool)
        down = np.zeros((h, w), dtype=bool)
        left = np.zeros((h, w), dtype=bool)
        right = np.zeros((h, w), dtype=bool)
        up[1:, :] = wall[:-1, :]
        down[:-1, :] = wall[1:, :]
        left[:, 1:] = wall[:, :-1]
        right[:, :-1] = wall[:, 1:]
        windows = amber & up & down & left & right
        glow[windows] = np.uint8(window_g)
        if kind == "building" and not windows.any():
            glow[amber] = np.uint8(window_g)
    if kind == "building" and glow.max() == 0 and opaque.any():
        lum = rgba[:, :, 0].astype(np.int32) + rgba[:, :, 1].astype(np.int32) + rgba[:, :, 2].astype(np.int32)
        vals = lum[opaque]
        cut = int(np.percentile(vals, 75)) if vals.size else 0
        edge = np.zeros((h, w), dtype=bool)
        edge[0, :] = True
        edge[-1, :] = True
        edge[:, 0] = True
        edge[:, -1] = True
        glow[opaque & (lum >= cut) & ~edge] = np.uint8(window_g)
    if sign_box and len(sign_box) == 4:
        x0, y0, bw, bh = (int(v) for v in sign_box)
        x1, y1 = max(0, x0), max(0, y0)
        x2, y2 = min(w, x0 + bw), min(h, y0 + bh)
        if x2 > x1 and y2 > y1:
            region = glow[y1:y2, x1:x2]
            mask = opaque[y1:y2, x1:x2]
            region[mask] = np.uint8(sign_g)
            glow[y1:y2, x1:x2] = region
    return glow


def target_width(row: dict, tile_w: int) -> int:
    fp = row.get("footprint") or [1, 1]
    cols, rows = int(fp[0]), int(fp[1])
    half = max(1, int(tile_w) // 2)
    return max(half, (cols + rows) * half)


BPS = 10000
PLOT_BUILDINGS = frozenset({"park", "plaza", "substation"})
TOWER_IDS = frozenset({"finance_tower", "ai_research_center"})
CIVIC_IDS = frozenset({"city_hall", "bank", "exchange"})
HUB_IDS = frozenset({"logistics_hub"})
FACTORY_IDS = frozenset(
    {
        "silo_warehouse",
        "energy_plant",
        "server_annex",
        "fleet_yard",
        "power_node",
        "drone_depot",
    }
)
OFFICE_IDS = frozenset(
    {
        "office_block",
        "cloud_campus",
        "flagship_store",
        "retail_complex",
        "agent_hub",
        "robotics_lab",
        "workshop",
        "clearing_house",
        "data_center",
    }
)


def _class_sprite_h(sid: str, kind: str, data: dict | None) -> int | None:
    """Packed height from render.json ladder (R-V-46). None keeps footprint aspect."""
    if not data:
        return None
    if kind == "building":
        if sid in PLOT_BUILDINGS:
            return None
        if sid in TOWER_IDS:
            return _param(data, "sprite_h_tower", 0) or None
        if sid in CIVIC_IDS:
            return _param(data, "sprite_h_civic", 0) or None
        if sid in HUB_IDS:
            return _param(data, "sprite_h_hub", 0) or None
        if sid in FACTORY_IDS:
            return _param(data, "sprite_h_factory", 0) or None
        if sid in OFFICE_IDS or sid.startswith("office_"):
            return _param(data, "sprite_h_office", 0) or None
        if sid.startswith("residential_"):
            return _param(data, "sprite_h_residential", 0) or None
        return _param(data, "sprite_h_office", 0) or None
    if sid.startswith("tree_"):
        return _param(data, "sprite_h_tree", 0) or None
    if sid.startswith("hedge"):
        return _param(data, "sprite_h_hedge", 0) or None
    if sid.startswith("vehicle"):
        return _param(data, "sprite_h_vehicle", 0) or None
    if sid.startswith("walker_") or sid.startswith("robot_"):
        return _param(data, "sprite_h_unit", 0) or None
    if sid.startswith("lantern"):
        return _param(data, "sprite_h_lantern", 0) or None
    if sid.startswith("phone_booth"):
        return _param(data, "sprite_h_booth", 0) or None
    if sid.startswith("bench"):
        return _param(data, "sprite_h_bench", 0) or None
    if sid.startswith("kiosk"):
        return _param(data, "sprite_h_kiosk", 0) or None
    if sid in {"trash_can", "planter", "utility_box", "barrier", "traffic_cone"}:
        return _param(data, "sprite_h_furniture", 0) or None
    return None


def sprite_h_for(sid: str, kind: str, data: dict | None = None) -> int | None:
    """Packed height from the render ladder, then TZ_ART §4 leftovers. Buildings use the pack."""
    classified = _class_sprite_h(sid, kind, data)
    if classified is not None:
        return classified
    exact = {
        "fountain": 72,
        "planter": 32,
        "bus_stop": 60,
        "hedge": 36,
        "traffic_light": 56,
        "sign_post": 52,
        "sign_caution": 52,
        "bush": 24,
        "bush_02": 24,
        "boat_small": 40,
        "buoy": 32,
        "buoy_02": 32,
        "cargo_container": 36,
        "crane_build": 168,
        "water_tower": 128,
        "cloud_small": 40,
        "cloud_large": 72,
        "bird": 12,
        "wind_turbine": 140,
        "lighthouse": 120,
        "satellite_dish": 48,
        "solar_array": 40,
        "solar_panel": 28,
        "solar_panel_02": 28,
        "banner": 40,
        "parking_sign": 52,
        "flower": 16,
        "flower_02": 16,
        "tesla_mark": 36,
        "mini_island": 40,
    }
    if sid in exact:
        return exact[sid]
    if kind in {"building", "tile", "road", "water"}:
        return None
    if sid.startswith(("island_", "water_tile", "road_", "sidewalk")) or sid in {
        "parking",
        "plaza_tile",
        "masonry",
        "beach",
        "crosswalk",
    }:
        return None
    if sid in {"waterfall", "dock", "dock_02", "pier", "scaffold", "mini_island"}:
        return None
    if sid.startswith("walker_"):
        return 36 if ("robot" in sid or "exosuit" in sid) else 40
    if sid.startswith("robot_"):
        return 36
    if sid.startswith("vehicle"):
        return 36 if any(tok in sid for tok in ("bus", "truck", "school")) else 28
    if sid.startswith("drone"):
        return 48
    if sid.startswith(("boat_", "ship_")):
        return 40
    if sid.startswith("glow_"):
        return 32
    if sid.startswith(("overlay_", "badge_", "select_")):
        return 20
    if sid.startswith(("turbine_blade_", "flag_", "smoke_", "billboard_", "shore_wave_", "drone_bob_", "waterfall_")):
        return None
    if kind == "unit":
        return 40
    if kind == "decor":
        return 40
    return None


def building_min_sprite_h(row: dict, data: dict | None) -> int:
    """R-V-46: uniform floor is gone. R-V-48: do not stretch height independently of width."""
    if str(row.get("kind") or "") != "building" or not data:
        return 0
    fp = row.get("footprint") or [1, 1]
    if int(fp[0] or 1) * int(fp[1] or 1) < 4:
        return 0
    return _param(data, "building_min_sprite_h", 0)


def _overhang_bps(row: dict, data: dict | None) -> int:
    sid = str(row.get("id") or "")
    if sid.startswith("tree_") or sid in {"bush", "bush_02"}:
        return _param(data or {}, "sprite_overhang_tree_bps", 0)
    return _param(data or {}, "sprite_overhang_bps", 0)


def packed_wh(
    row: dict,
    tile_w: int,
    src_w: int,
    src_h: int,
    min_h: int = 0,
    data: dict | None = None,
) -> tuple[int, int]:
    """Buildings: uniform scale into the lot. sprite_h is a height ceiling, never a stretch (R-V-48)."""
    tw_fp = target_width(row, tile_w)
    kind = str(row.get("kind") or "")
    sh = row.get("sprite_h")
    if kind == "building":
        if src_w <= 0:
            return max(1, tw_fp), 1
        tw = tw_fp
        th = max(1, int(round(tw * src_h / src_w)))
        cap_h = int(sh) if sh is not None else 0
        if cap_h > 0 and th > cap_h:
            th = cap_h
            tw = max(1, int(round(th * src_w / src_h)))
            if tw > tw_fp:
                tw = tw_fp
                th = max(1, int(round(tw * src_h / src_w)))
        return tw, th
    if sh is not None and src_h:
        th = max(1, int(sh))
        tw = max(1, int(round(int(src_w) * th / int(src_h))))
    else:
        tw = tw_fp
        th = max(1, int(round(tw * src_h / src_w))) if src_w else 1
    floor = max(0, int(min_h))
    if floor > th and src_h:
        th = floor
        tw = max(1, int(round(int(src_w) * th / int(src_h))))
    # 1x1 decor sits in one diamond; tree overhang is a second lot of canopy (R-V-58).
    cap = tw_fp
    if tw > cap:
        tw = max(1, cap)
        if src_w:
            th = max(1, int(round(tw * src_h / src_w)))
    return tw, th


def shelf_layout(
    items: list[dict],
    *,
    page_px: int,
    pad: int,
    order: list[str] | None,
    sort_ids: bool,
) -> dict[str, dict]:
    """items: {id, w, h}. Sort: descending height, then ascending id (UTF-8 bytes)."""
    by_id = {str(it["id"]): it for it in items}
    if order is None:
        ids = list(by_id)
    else:
        ids = [i for i in order if i in by_id]
        ids.extend(i for i in by_id if i not in ids)
    if sort_ids:
        ids = sorted(ids, key=lambda i: (-int(by_id[i]["h"]), i.encode("utf-8")))
    x = pad
    y = pad
    row_h = 0
    page = 0
    out: dict[str, dict] = {}
    for sid in ids:
        it = by_id[sid]
        fw, fh = int(it["w"]), int(it["h"])
        if x + fw + pad > page_px and x > pad:
            x = pad
            y += row_h + pad
            row_h = 0
        if y + fh + pad > page_px and y > pad:
            page += 1
            x = pad
            y = pad
            row_h = 0
        out[sid] = {"page": page, "x": x, "y": y, "w": fw, "h": fh}
        x += fw + pad
        if fh > row_h:
            row_h = fh
    return out


def _png_bytes(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=False, compress_level=9)
    return buf.getvalue()


def _kind_for(cat: str, sid: str) -> str:
    if cat == "terrain":
        if sid.startswith("water_tile"):
            return "water"
        if sid.startswith("road_"):
            return "road"
        return "tile"
    if cat == "port":
        if sid.startswith(("boat_", "ship_")):
            return "unit"
        if sid in {"dock", "dock_02", "pier"}:
            return "tile"
        return "decor"
    return KIND_BY_CAT.get(cat, "decor")


def rebuild_registry() -> dict:
    """Author the v2 registry. Old footprints win; extras default to 1×1."""
    old = load_json(ASSETS_PATH) if ASSETS_PATH.exists() else {"tile_w": 64, "assets": []}
    old_by = {str(a["id"]): a for a in (old.get("assets") or [])}
    default_fp = {
        "tree": [1, 1],
        "lantern": [1, 1],
        "vehicle": [1, 1],
        "drone": [1, 1],
        "island": [1, 1],
        "water": [1, 1],
        "road": [1, 1],
        "walker": [1, 1],
        "robot": [1, 1],
        "glow": [1, 1],
        "boat": [1, 1],
        "bush": [1, 1],
        "bench": [1, 1],
    }
    districts = load_json(PARAM_DIR / "districts.json") if (PARAM_DIR / "districts.json").is_file() else {}
    beacon_ids = {
        str(row.get("beacon") or "")
        for row in ((districts.get("districts") or {}).values() if isinstance(districts.get("districts"), dict) else [])
        if row.get("beacon")
    }
    rows: list[dict] = []
    seen: set[str] = set()
    for cat in ASSET_CATS:
        folder = REPO / "assets" / cat
        if not folder.is_dir():
            continue
        for path in sorted(folder.glob("*_v2.png")):
            sid = path.stem[: -3] if path.stem.endswith("_v2") else path.stem
            rel = path.relative_to(REPO).as_posix()
            prev = old_by.get(sid) or {}
            fp = list(prev.get("footprint") or [1, 1])
            if sid not in old_by:
                stem = sid.rsplit("_", 1)[0]
                parent = old_by.get(stem)
                if parent:
                    fp = list(parent.get("footprint") or [1, 1])
                else:
                    for prefix, size in default_fp.items():
                        if sid.startswith(prefix):
                            fp = list(size)
                            break
            kind = str(prev.get("kind") or _kind_for(cat, sid))
            emissive = 1 if sid.startswith("lantern") or sid.startswith("glow_") else 0
            row = {
                "id": sid,
                "file": rel,
                "footprint": [int(fp[0]), int(fp[1])],
                "kind": kind,
                "emissive": emissive,
            }
            sh = sprite_h_for(sid, kind)
            if sh is not None:
                row["sprite_h"] = int(sh)
            if prev.get("ramps"):
                row["ramps"] = list(prev["ramps"])
            if prev.get("sign_box"):
                row["sign_box"] = list(prev["sign_box"])
            elif sid in beacon_ids:
                im = Image.open(path)
                bw, bh = im.size
                row["sign_box"] = [bw // 3, bh // 5, max(1, bw // 3), max(1, bh // 4)]
            rows.append(row)
            seen.add(sid)
    for sid, rel in ALIASES.items():
        if sid in seen:
            continue
        prev = old_by.get(sid) or {}
        fp = list(prev.get("footprint") or [1, 1])
        cat = rel.split("/")[1] if "/" in rel else "decor"
        kind = str(prev.get("kind") or _kind_for(cat, sid))
        row = {
            "id": sid,
            "file": rel,
            "footprint": [int(fp[0]), int(fp[1])],
            "kind": kind,
            "emissive": 1 if sid.startswith("lantern") else 0,
        }
        sh = sprite_h_for(sid, kind)
        if sh is not None:
            row["sprite_h"] = int(sh)
        if prev.get("ramps"):
            row["ramps"] = list(prev["ramps"])
        rows.append(row)
    rows.sort(key=lambda r: str(r["id"]).encode("utf-8"))
    blob = {
        "tile_w": int(old.get("tile_w") or 64),
        "note": "V2 painterly registry. file is assets/<cat>/<id>_v2.png; foot_anchor is lot-front on kind=building, else [w//2, h].",
        "src": "TZ_ART.md §2, TZ_RENDER.md §3, D-V-12",
        "assets": rows,
    }
    return blob


def _page_name(index: int, glow: bool) -> str:
    if index == 0:
        return "city_glow.png" if glow else "city.png"
    return f"city_{index}_glow.png" if glow else f"city_{index}.png"


def _index_page_name(index: int) -> str:
    return "city_index.png" if index == 0 else f"city_{index}_index.png"


def index_page(rgba: np.ndarray, glow: np.ndarray, palette: np.ndarray) -> np.ndarray:
    """R = palette index, G = glow, B = 0, A = alpha (TZ_RENDER §3)."""
    h, w = rgba.shape[:2]
    out = np.zeros((h, w, 4), dtype=np.uint8)
    pal = palette.astype(np.int16)
    step = 64
    for y0 in range(0, h, step):
        sl = rgba[y0 : y0 + step]
        a = sl[:, :, 3]
        rgb = sl[:, :, :3].astype(np.int16)
        d = ((rgb[:, :, None, :] - pal[None, None, :, :]) ** 2).sum(-1)
        idx = d.argmin(-1).astype(np.uint8)
        g = glow[y0 : y0 + step]
        row = out[y0 : y0 + step]
        row[:, :, 0] = idx
        row[:, :, 1] = g
        row[:, :, 3] = a
        row[a == 0] = 0
    return out


def lut_snap_rgb(palette: np.ndarray, side: int = 32) -> np.ndarray:
    """Packed 32³ snap LUT, 16 slices per row → 512×64 (TZ_RENDER §3)."""
    cols = 16
    rows = 2
    img = np.zeros((side * rows, side * cols, 3), dtype=np.uint8)
    pal = palette.astype(np.int16)
    scale = 255.0 / float(side - 1)
    for b in range(side):
        br = int(round(float(b) * scale))
        col = b % cols
        row = b // cols
        x0 = col * side
        y0 = row * side
        for g in range(side):
            gg = int(round(float(g) * scale))
            rgb = np.stack(
                [
                    np.round(np.arange(side, dtype=np.float64) * scale).astype(np.int16),
                    np.full(side, gg, dtype=np.int16),
                    np.full(side, br, dtype=np.int16),
                ],
                axis=1,
            )
            d = ((rgb[:, None, :] - pal[None, :, :]) ** 2).sum(-1)
            img[y0 + g, x0 : x0 + side] = palette[d.argmin(1)]
    return img


def lut_phases_rgb(palette: np.ndarray, ramps: dict[str, list[int]], phases: dict) -> np.ndarray:
    """Width 64, one row per phase. Identity on day (alpha 0)."""
    order = ("dawn", "day", "dusk", "night")
    img = np.zeros((len(order), 64, 3), dtype=np.uint8)
    pal_i = palette.astype(np.int32)
    for i, name in enumerate(order):
        spec = phases.get(name) or {}
        ramp_name = str(spec.get("tint_ramp") or "navy")
        alpha = 0
        raw_a = spec.get("tint_alpha_bps")
        if isinstance(raw_a, dict):
            alpha = int(raw_a.get("v") or 0)
        elif isinstance(raw_a, int):
            alpha = raw_a
        steps = ramps.get(ramp_name) or [0]
        tint = pal_i[int(steps[len(steps) // 2])]
        mixed = (pal_i * (10000 - alpha) + tint * alpha) // 10000
        mixed = np.clip(mixed, 0, 255)
        d = ((mixed[:, None, :] - pal_i[None, :, :]) ** 2).sum(-1)
        snapped = palette[d.argmin(1)]
        if alpha == 0:
            snapped = palette
        img[i, : len(palette)] = snapped
    return img


def pack_atlas(data: dict, *, write: bool = True, sort_ids: bool = True, order: list[str] | None = None) -> dict:
    """Pack registry sprites. Ids are sorted; filesystem walk order is never used."""
    global _CACHE
    if write and not data.get("_assets_json"):
        pipe = REPO / "art" / "pipeline"
        if str(pipe) not in sys.path:
            sys.path.insert(0, str(pipe))
        import tiles as tiles_mod

        tiles_mod.set_pack(data)
        tiles_mod.main()
    registry = load_registry(data.get("_assets_json") if isinstance(data.get("_assets_json"), dict) else None)
    tile_w = int(registry["tile_w"])
    page_px = _param(data, "atlas_page_px", 2048)
    pad = _param(data, "atlas_padding_px", 2)
    window_g = _param(data, "glow_window", 200)
    sign_g = _param(data, "glow_sign", 255)
    sort_ids = False if data.get("_atlas_disable_sort") else sort_ids
    if isinstance(data.get("_atlas_walk"), list) and order is None:
        order = [str(x) for x in data["_atlas_walk"]]
    palette, ramps = load_palette()
    ramp_of = _ramp_index(palette, ramps)
    prepared: list[dict] = []
    unique_px: dict[tuple, tuple[np.ndarray, np.ndarray]] = {}
    for row in registry["assets"]:
        sid = str(row["id"])
        rel = str(row.get("file") or "")
        path, ready = atlas_source(row)
        if not path.is_file():
            raise FileNotFoundError(f"atlas source missing for {sid}: {path}")
        kind = str(row.get("kind") or "decor")
        sh = sprite_h_for(sid, kind, data)
        if sh is not None:
            row = {**row, "sprite_h": sh}
        src_img = np.array(Image.open(path).convert("RGBA"), dtype=np.uint8)
        if ready:
            keyed = crop_rgba(src_img)
        else:
            keyed = prepare_sprite_rgba(row, key_to_rgba(src_img[:, :, :3]))
        tw, th = packed_wh(
            row,
            tile_w,
            keyed.shape[1],
            keyed.shape[0],
            building_min_sprite_h(row, data),
            data,
        )
        key = (str(path), tw, th, ready)
        if key not in unique_px:
            same = int(keyed.shape[1]) == tw and int(keyed.shape[0]) == th
            rgba = keyed if same else scale_rgba(keyed, tw, th)
            glow = glow_mask(
                rgba,
                kind=str(row.get("kind") or "decor"),
                emissive=int(row.get("emissive") or 0),
                window_g=window_g,
                sign_g=sign_g,
                palette=palette,
                ramp_of=ramp_of,
                sign_box=list(row["sign_box"]) if row.get("sign_box") else None,
            )
            unique_px[key] = (rgba, glow)
        rgba, glow = unique_px[key]
        prepared.append(
            {
                "id": sid,
                "file": rel,
                "px_key": key,
                "w": int(rgba.shape[1]),
                "h": int(rgba.shape[0]),
                "kind": str(row.get("kind") or "decor"),
                "footprint": [int((row.get("footprint") or [1, 1])[0]), int((row.get("footprint") or [1, 1])[1])],
                "sign_box": list(row["sign_box"]) if row.get("sign_box") else None,
            }
        )
    layout = shelf_layout(prepared, page_px=page_px, pad=pad, order=order, sort_ids=sort_ids)
    page_count = max((int(p["page"]) for p in layout.values()), default=0) + 1
    pages_rgba = [np.zeros((page_px, page_px, 4), dtype=np.uint8) for _ in range(page_count)]
    pages_glow = [np.zeros((page_px, page_px), dtype=np.uint8) for _ in range(page_count)]
    frames: dict[str, dict] = {}
    by_prep = {str(it["id"]): it for it in prepared}
    for sid, pos in layout.items():
        it = by_prep[sid]
        rgba, glow = unique_px[it["px_key"]]
        pg, x, y, fw, fh = int(pos["page"]), int(pos["x"]), int(pos["y"]), int(pos["w"]), int(pos["h"])
        pages_rgba[pg][y : y + fh, x : x + fw] = rgba
        pages_glow[pg][y : y + fh, x : x + fw] = glow
        frame = {
            "page": pg,
            "x": x,
            "y": y,
            "w": fw,
            "h": fh,
            "foot_anchor": list(
                sprite_foot_anchor(
                    rgba,
                    {"id": sid, "kind": it["kind"], "footprint": it["footprint"]},
                )
            ),
            "footprint": it["footprint"],
            "kind": it["kind"],
        }
        if it["sign_box"]:
            frame["sign_box"] = it["sign_box"]
        frames[sid] = frame
    blobs: dict[str, bytes] = {}
    page_rows = []
    for i in range(page_count):
        vis_name = _page_name(i, False)
        glow_name = _page_name(i, True)
        blobs[vis_name] = _png_bytes(Image.fromarray(pages_rgba[i], "RGBA"))
        blobs[glow_name] = _png_bytes(Image.fromarray(pages_glow[i], "L"))
        idx_name = _index_page_name(i)
        idx_rgba = index_page(pages_rgba[i], pages_glow[i], palette)
        blobs[idx_name] = _png_bytes(Image.fromarray(idx_rgba, "RGBA"))
        if blobs[vis_name] != _png_bytes(Image.fromarray(pages_rgba[i], "RGBA")):
            raise RuntimeError("visible PNG encode is not deterministic")
        if blobs[glow_name] != _png_bytes(Image.fromarray(pages_glow[i], "L")):
            raise RuntimeError("glow PNG encode is not deterministic")
        if blobs[idx_name] != _png_bytes(Image.fromarray(idx_rgba, "RGBA")):
            raise RuntimeError("index PNG encode is not deterministic")
        page_rows.append(
            {
                "file": vis_name,
                "glow_file": glow_name,
                "index_file": idx_name,
                "w": page_px,
                "h": page_px,
            }
        )
    water_ids = [sid for sid, fr in frames.items() if fr.get("kind") == "water"]
    water_ids.sort()
    deep_id = "water_tile_02"
    strip = [
        sid
        for sid in water_ids
        if str(sid).startswith("water_tile") and sid != deep_id
    ]
    shallow = strip[0] if strip else (water_ids[0] if water_ids else "")
    if deep_id in frames:
        deep = deep_id
    elif len(water_ids) > 1:
        deep = water_ids[1]
    else:
        deep = shallow
    frames_x = len(strip) if strip else 1
    opaque = 0
    glow_buildings = 0
    for sid, fr in frames.items():
        pg = int(fr["page"])
        x, y, fw, fh = int(fr["x"]), int(fr["y"]), int(fr["w"]), int(fr["h"])
        tile = pages_rgba[pg][y : y + fh, x : x + fw]
        mag = (tile[:, :, 0] == 255) & (tile[:, :, 1] == 0) & (tile[:, :, 2] == 255) & (tile[:, :, 3] > 0)
        opaque += int(mag.sum())
        if fr.get("kind") == "building":
            g = pages_glow[pg][y : y + fh, x : x + fw]
            if int(g.max()) > 0:
                glow_buildings += 1
    manifest: dict = {
        "tile_w": tile_w,
        "pages": page_rows,
        "frames": frames,
        "water": {
            "frames_x": frames_x,
            "frames_y": 1,
            "shallow": shallow,
            "deep": deep,
            "strip": strip,
        },
        "palette_sha256": palette_sha256(),
        "opaque_magenta_px": opaque,
        "glow_building_count": glow_buildings,
        "lut": {"phases": "lut_phases.png", "snap": "lut_snap.png"},
    }
    if str(PIPE) not in sys.path:
        sys.path.insert(0, str(PIPE))
    import font as font_mod

    font_rgba, glyph_metrics = font_mod.raster_glyphs(tile_w, palette, ramps)
    blobs["font.png"] = _png_bytes(Image.fromarray(font_rgba, "RGBA"))
    phases_cfg = ((data.get("placement") or {}).get("phases")) or {}
    lut_p = lut_phases_rgb(palette, ramps, phases_cfg)
    lut_s = lut_snap_rgb(palette, 32)
    blobs["lut_phases.png"] = _png_bytes(Image.fromarray(lut_p, "RGB"))
    blobs["lut_snap.png"] = _png_bytes(Image.fromarray(lut_s, "RGB"))
    manifest["glyphs"] = {"file": "font.png", "metrics": glyph_metrics}
    digest_src = b"".join(blobs[name] for name in sorted(blobs)) + canonical(manifest)
    digest = hashlib.sha256(digest_src).hexdigest()
    manifest["sha256"] = digest
    byte_sum = sum(len(b) for b in blobs.values())
    if write:
        ATLAS_DIR.mkdir(parents=True, exist_ok=True)
        for name, blob in blobs.items():
            (ATLAS_DIR / name).write_bytes(blob)
        (ATLAS_DIR / "city.json").write_bytes(canonical(manifest) + b"\n")
        (ATLAS_DIR / "atlas.sha256").write_text(digest + "\n", encoding="utf-8")
    result = {
        "sha256": digest,
        "bytes": byte_sum,
        "page_count": page_count,
        "frame_count": len(frames),
        "palette_sha256": manifest["palette_sha256"],
        "opaque_magenta_px": opaque,
        "glow_building_count": glow_buildings,
        "manifest": manifest,
        "blobs": blobs,
        "building_ids": [sid for sid, fr in frames.items() if fr.get("kind") == "building"],
    }
    if write:
        _CACHE = result
        (ATLAS_DIR / "inputs.sha256").write_text(inputs_fingerprint(data, registry) + "\n", encoding="utf-8")
    return result


def inputs_fingerprint(data: dict, registry: dict | None = None) -> str:
    if registry is None:
        registry = load_registry()
    h = hashlib.sha256()
    h.update(Path(__file__).read_bytes())
    tiles_py = REPO / "art" / "pipeline" / "tiles.py"
    if tiles_py.is_file():
        h.update(tiles_py.read_bytes())
    h.update(ASSETS_PATH.read_bytes())
    h.update(PALETTE_PATH.read_bytes())
    if GLYPHS_PATH.is_file():
        h.update(GLYPHS_PATH.read_bytes())
    if FONT_TTF.is_file():
        h.update(FONT_TTF.read_bytes())
    h.update(
        f"{_param(data, 'atlas_page_px', 2048)}:{_param(data, 'atlas_padding_px', 2)}:"
        f"{_param(data, 'glow_window', 200)}:{_param(data, 'glow_sign', 255)}:"
        f"{_param(data, 'building_min_sprite_h', 0)}:{_param(data, 'sprite_overhang_bps', 0)}:"
        f"{_param(data, 'sprite_overhang_tree_bps', 0)}:{_param(data, 'sprite_h_tower', 0)}:"
        f"{_param(data, 'sprite_h_residential', 0)}:{_param(data, 'sprite_h_office', 0)}:"
        f"{_param(data, 'sprite_h_civic', 0)}:{_param(data, 'sprite_h_factory', 0)}:"
        f"{_param(data, 'sprite_h_hub', 0)}:{_param(data, 'sprite_h_tree', 0)}:"
        f"{_param(data, 'sprite_h_kiosk', 0)}:{_param(data, 'sprite_h_booth', 0)}:"
        f"{_param(data, 'sprite_h_lantern', 0)}:{_param(data, 'sprite_h_bench', 0)}:"
        f"{_param(data, 'sprite_h_furniture', 0)}:{_param(data, 'sprite_h_unit', 0)}:"
        f"{_param(data, 'sprite_h_hedge', 0)}:{_param(data, 'sprite_h_vehicle', 0)}:"
        f"{_param(data, 'road_band_half_bps', 0)}".encode()
    )
    for row in registry["assets"]:
        rel = str(row.get("file") or "")
        path, _ready = atlas_source(row)
        size = path.stat().st_size if path.is_file() else 0
        h.update(f"{row['id']}:{path}:{size}".encode())
    return h.hexdigest()


def load_packed() -> dict | None:
    sha_path = ATLAS_DIR / "atlas.sha256"
    json_path = ATLAS_DIR / "city.json"
    if not sha_path.is_file() or not json_path.is_file():
        return None
    manifest = json.loads(json_path.read_text(encoding="utf-8"))
    digest = sha_path.read_text(encoding="utf-8").strip()
    if not isinstance(manifest, dict) or str(manifest.get("sha256") or "") != digest:
        return None
    byte_sum = 0
    for page in manifest.get("pages") or []:
        if not isinstance(page, dict):
            return None
        for key in ("file", "glow_file", "index_file"):
            name = str(page.get(key) or "")
            if not name:
                continue
            path = ATLAS_DIR / name
            if not path.is_file():
                return None
            byte_sum += path.stat().st_size
    lut = manifest.get("lut")
    if isinstance(lut, dict):
        for key in ("phases", "snap"):
            name = str(lut.get(key) or "")
            if not name:
                continue
            path = ATLAS_DIR / name
            if not path.is_file():
                return None
            byte_sum += path.stat().st_size
    glyphs = manifest.get("glyphs")
    if isinstance(glyphs, dict):
        font_name = str(glyphs.get("file") or "")
        font_path = ATLAS_DIR / font_name if font_name else None
        if font_path is None or not font_path.is_file():
            return None
        byte_sum += font_path.stat().st_size
    frames = manifest.get("frames") or {}
    if not isinstance(frames, dict):
        return None
    return {
        "sha256": digest,
        "bytes": byte_sum,
        "page_count": len(manifest.get("pages") or []),
        "frame_count": len(frames),
        "palette_sha256": str(manifest.get("palette_sha256") or ""),
        "opaque_magenta_px": int(manifest.get("opaque_magenta_px") or 0),
        "glow_building_count": int(manifest.get("glow_building_count") or 0),
        "manifest": manifest,
        "blobs": {},
        "building_ids": [
            sid for sid, fr in frames.items() if isinstance(fr, dict) and fr.get("kind") == "building"
        ],
    }


def _atlas_sources_missing(registry: dict) -> bool:
    for row in registry["assets"]:
        path, _ready = atlas_source(row)
        if not path.is_file():
            return True
    return False


def ensure_atlas(data: dict) -> dict:
    global _CACHE
    dirty = bool(data.get("_atlas_disable_sort") or data.get("_atlas_walk") or data.get("_assets_json"))
    if _CACHE is not None and not dirty:
        return _CACHE
    if not dirty:
        registry = load_registry()
        stamp_path = ATLAS_DIR / "inputs.sha256"
        want = inputs_fingerprint(data, registry)
        if stamp_path.is_file() and stamp_path.read_text(encoding="utf-8").strip() == want:
            loaded = load_packed()
            if loaded is not None:
                _CACHE = loaded
                return loaded
        loaded = load_packed()
        if loaded is not None and _atlas_sources_missing(registry):
            _CACHE = loaded
            return loaded
    return pack_atlas(data, write=not dirty)


def atlas_outputs() -> Path:
    return ATLAS_DIR


def city_png_mode(data: dict) -> str:
    overlay = data.get("_atlas_city_png")
    if isinstance(overlay, (bytes, bytearray)):
        return Image.open(io.BytesIO(overlay)).mode
    path = ATLAS_DIR / "city.png"
    if not path.is_file():
        return ""
    return Image.open(path).mode


def read_city_rgba(data: dict) -> np.ndarray | None:
    overlay = data.get("_atlas_city_png")
    if isinstance(overlay, (bytes, bytearray)):
        return np.array(Image.open(io.BytesIO(overlay)).convert("RGBA"), dtype=np.uint8)
    path = ATLAS_DIR / "city.png"
    if not path.is_file():
        return None
    return np.array(Image.open(path).convert("RGBA"), dtype=np.uint8)


def read_city_glow(data: dict) -> np.ndarray | None:
    if data.get("_atlas_glow_zero"):
        rgba = read_city_rgba(data)
        if rgba is None:
            return None
        return np.zeros(rgba.shape[:2], dtype=np.uint8)
    overlay = data.get("_atlas_glow_png")
    if isinstance(overlay, (bytes, bytearray)):
        return np.array(Image.open(io.BytesIO(overlay)).convert("L"), dtype=np.uint8)
    path = ATLAS_DIR / "city_glow.png"
    if not path.is_file():
        return None
    return np.array(Image.open(path).convert("L"), dtype=np.uint8)


def main() -> int:
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--registry":
        blob = rebuild_registry()
        ASSETS_PATH.write_text(json.dumps(blob, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"registry   : {len(blob['assets'])} ids -> {ASSETS_PATH}")
        return 0
    from pack import sections

    data = sections()
    out = pack_atlas(data, write=True)
    print(f"frames     : {out['frame_count']}")
    print(f"pages      : {out['page_count']}")
    print(f"bytes      : {out['bytes']}")
    print(f"sha256     : {out['sha256']}")
    print(f"magenta    : {out['opaque_magenta_px']}")
    print(f"glow bldgs : {out['glow_building_count']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
