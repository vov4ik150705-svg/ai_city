"""Geometry proof for the diamond island (R-V-52).

Reads the scene from the pack generator. Ground is tiles.py 64×32 diamonds plus
cliff 11 px. Sprites come from art/out after pixelize when present.

    python art/pipeline/scene.py          -> art/preview/scene.png
    python art/pipeline/scene.py --grid   -> also scene_grid.png with ground diamonds under sprites
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ART = Path(__file__).resolve().parent.parent
REPO = ART.parent
sys.path.insert(0, str(REPO / "content"))

from pack import load_json, sections  # noqa: E402
import atlas as atlas_mod  # noqa: E402
import column_mask  # noqa: E402
import tiles  # noqa: E402
import world  # noqa: E402

TILE_W, TILE_H = 64, 32
HALF_W, HALF_H = TILE_W // 2, TILE_H // 2
PAD = 40
BACKDROP = (18, 32, 63, 255)
CLIFF_RGB = (58, 42, 32, 255)
SHADOW_RGB = (12, 16, 28, 160)
ASSETS_PATH = REPO / "art" / "pipeline" / "assets.json"
OUT_DIR = ART / "out"


def tile_origin(tx: int, ty: int) -> tuple[int, int]:
    return (tx - ty) * HALF_W, (tx + ty) * HALF_H


def front_vertex(tx: int, ty: int, cols: int, rows: int) -> tuple[int, int]:
    ox, oy = tile_origin(tx + cols - 1, ty + rows - 1)
    return ox + HALF_W, oy + TILE_H


def instance_place(
    obj: dict,
    sid: str,
    tx: int,
    ty: int,
    cols: int,
    rows: int,
    tw: int,
    th: int,
    ax: int,
    ay: int,
    drop: int,
) -> tuple[tuple[int, int], int, int]:
    """Screen top-left plus packed size after owner ox/oy/lift/w_px/h_px/flip (R-V-60, R-V-61)."""
    ox = int(obj.get("ox") or 0)
    oy = int(obj.get("oy") or 0)
    lift = int(obj.get("lift") or 0)
    w_px = int(obj.get("w_px") or 0)
    h_px = int(obj.get("h_px") or 0)
    nw = w_px if w_px > 0 else tw
    nh = h_px if h_px > 0 else th
    if tw > 0 and th > 0 and (nw != tw or nh != th):
        ax = ax * nw // tw
        ay = ay * nh // th
    if int(obj.get("flip") or 0):
        ax = nw - ax
    fx, fy = front_vertex(tx, ty, cols, rows)
    cloud = TILE_W if sid.startswith("cloud") else 0
    pos = (fx - ax + ox, fy - ay - drop - lift - cloud + oy)
    return pos, nw, nh


def diamond(cx: int, cy: int, w: int, h: int) -> list[tuple[int, int]]:
    return [(cx - w // 2, cy - h // 2), (cx, cy - h), (cx + w // 2, cy - h // 2), (cx, cy)]


def target_width(cols: int, rows: int) -> int:
    half = max(1, TILE_W // 2)
    return max(half, (cols + rows) * half)


def scale_rgba(im: Image.Image, width: int) -> Image.Image:
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    if im.width == width:
        return im
    h = max(1, int(im.height * width / im.width))
    return im.resize((width, h), Image.Resampling.LANCZOS)


def load_registry() -> dict[str, dict]:
    blob = load_json(ASSETS_PATH)
    out: dict[str, dict] = {}
    for row in blob.get("assets") or []:
        if isinstance(row, dict) and row.get("id"):
            out[str(row["id"])] = row
    return out


def sprite_image(
    reg: dict[str, dict], sid: str, cache: dict[str, Image.Image], data: dict | None = None
) -> Image.Image | None:
    if sid in cache:
        return cache[sid]
    outp = OUT_DIR / f"{sid}.png"
    if outp.is_file():
        im = Image.open(outp).convert("RGBA")
        cache[sid] = im
        return im
    row = reg.get(sid)
    if not row:
        return None
    path = REPO / str(row.get("file") or "")
    if not path.is_file():
        return None
    packed = dict(row)
    if packed.get("sprite_h") is None:
        sh = atlas_mod.sprite_h_for(sid, str(packed.get("kind") or "decor"), data)
        if sh is not None:
            packed["sprite_h"] = sh
    rgb = np.array(Image.open(path).convert("RGB"), dtype=np.uint8)
    rgba = atlas_mod.prepare_sprite_rgba(packed, atlas_mod.key_to_rgba(rgb))
    tw, th = atlas_mod.packed_wh(
        packed,
        TILE_W,
        rgba.shape[1],
        rgba.shape[0],
        atlas_mod.building_min_sprite_h(packed, data),
        data,
    )
    scaled = atlas_mod.scale_rgba(rgba, tw, th)
    pix = scaled
    fringe = (pix[:, :, 0] > 200) & (pix[:, :, 2] > 200) & (pix[:, :, 1] < 40)
    pix[fringe, 3] = 0
    im = Image.fromarray(pix, "RGBA")
    cache[sid] = im
    return im


def is_shore(grid: list[str], tx: int, ty: int) -> bool:
    if ty < 0 or tx < 0 or ty >= len(grid) or tx >= len(grid[0]):
        return False
    if grid[ty][tx] == "~":
        return False
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = tx + dx, ty + dy
        if ny < 0 or nx < 0 or ny >= len(grid) or nx >= len(grid[0]) or grid[ny][nx] == "~":
            return True
    return False


def is_shore_water(grid: list[str], tx: int, ty: int) -> bool:
    if ty < 0 or tx < 0 or ty >= len(grid) or tx >= len(grid[0]):
        return False
    if grid[ty][tx] != "~":
        return False
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = tx + dx, ty + dy
        if 0 <= ny < len(grid) and 0 <= nx < len(grid[0]) and grid[ny][nx] != "~":
            return True
    return False


def walker_preview_id(sid: str, grid: list[str], tx: int, ty: int, known: dict) -> str:
    """Same heading as packages/render walkerFacing (R-V-39): west/north use `_w`."""
    if not sid.startswith("walker_") or sid.endswith("_w"):
        return sid

    def walk(x: int, y: int) -> bool:
        if y < 0 or x < 0 or y >= len(grid) or x >= len(grid[0]):
            return False
        return grid[y][x] in {"s", "r", "c"}

    n, s, e, w = walk(tx, ty - 1), walk(tx, ty + 1), walk(tx + 1, ty), walk(tx - 1, ty)
    ns, ew = n or s, e or w
    odd = (tx + ty) % 2 == 1
    if ew and not ns:
        facing = "w" if odd else "e"
    elif ns and not ew:
        facing = "n" if odd else "s"
    elif ew:
        facing = "w" if odd else "e"
    else:
        facing = "e"
    if facing in {"w", "n"}:
        alt = f"{sid}_w"
        if alt in known:
            return alt
    return sid


def top_sprite_id(grid: list[str], tx: int, ty: int, kinds: dict) -> str:
    ch = grid[ty][tx]
    if ch == "r":
        return tiles.road_sprite(grid, tx, ty)
    if ch == "s":
        return tiles.sidewalk_sprite(grid, tx, ty)
    if ch == "c":
        return str((kinds.get("c") or {}).get("sprite") or "crosswalk")
    row = kinds.get(ch) or {}
    return str(row.get("sprite") or "island_block")


def tile_diamond(
    sid: str,
    cache: dict[str, Image.Image],
    pu: int = 0,
    pv: int = 0,
    pair_mask: int = 0,
    curb_mask: int = 0,
    fillet: int = 0,
) -> Image.Image:
    live = sid.startswith("road_") or sid in {"crosswalk", "masonry", "parking", "plaza_tile"}
    key = f"{sid}:{pu}:{pv}:{pair_mask}:{curb_mask}:{fillet}" if live else f"{sid}:{pu}:{pv}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    path = OUT_DIR / "tiles" / f"{sid}.png"
    if path.is_file() and pu == 0 and pv == 0 and not live:
        im = Image.open(path).convert("RGBA")
    else:
        rgb, alpha = tiles.diamond_rgba(
            sid,
            seed=1,
            pu=pu,
            pv=pv,
            pair_mask=pair_mask,
            curb_mask=curb_mask,
            fillet=fillet,
        )
        im = tiles.to_image(rgb, alpha)
    cache[key] = im
    return im


def paint_tile_outlines(overlay: Image.Image, iso: dict, grid: list[str]) -> None:
    """Ground diamonds only. Sprites composite after this so walls are not sliced (R-V-56)."""
    draw = ImageDraw.Draw(overlay)
    off_x, off_y = int(iso["off_x"]), int(iso["off_y"])
    drop = int(iso["drop"])
    for ty, row in enumerate(grid):
        for tx, ch in enumerate(row):
            if ch == "~" and not is_shore_water(grid, tx, ty):
                continue
            x, y = tile_origin(tx, ty)
            draw.polygon(
                diamond(x + off_x + HALF_W, y + off_y + TILE_H - drop, TILE_W, TILE_H),
                outline=(255, 90, 200, 255),
            )


def cliff_strip() -> Image.Image:
    depth = int(tiles.CLIFF_DEPTH)
    im = Image.new("RGBA", (TILE_W, TILE_H + depth), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    top = diamond(HALF_W, TILE_H, TILE_W, TILE_H)
    bot = [(x, y + depth) for x, y in top]
    draw.polygon(
        [top[3], top[2], bot[2], bot[3], bot[0], top[0]],
        fill=CLIFF_RGB,
    )
    return im


def _scan_land_water(
    grid: list[str],
) -> tuple[list[tuple[int, int, int, int, str]], list[tuple[int, int, int, int]]]:
    land: list[tuple[int, int, int, int, str]] = []
    water: list[tuple[int, int, int, int]] = []
    for ty, row in enumerate(grid):
        for tx, ch in enumerate(row):
            ox, oy = tile_origin(tx, ty)
            if ch == "~":
                water.append((ox, oy, tx, ty))
            else:
                land.append((ox, oy, tx, ty, ch))
    land.sort(key=lambda t: (t[3] + t[2], t[2]))
    return land, water


def _ground_cmds(
    grid: list[str],
    land: list[tuple[int, int, int, int, str]],
    water: list[tuple[int, int, int, int]],
    kinds: dict,
    cache: dict[str, Image.Image],
    off: tuple[int, int],
) -> list[tuple[Image.Image, tuple[int, int]]]:
    cmds: list[tuple[Image.Image, tuple[int, int]]] = []
    shx, shy = tiles.ISLAND_SHADOW
    shadow = Image.new("RGBA", (TILE_W, TILE_H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).polygon(diamond(HALF_W, TILE_H, TILE_W, TILE_H), fill=SHADOW_RGB)
    for x, y, _tx, _ty, ch in land:
        cmds.append((shadow, (x + off[0] + shx, y + off[1] + shy)))
    cliff = cliff_strip()
    for x, y, tx, ty, ch in land:
        if is_shore(grid, tx, ty):
            cmds.append((cliff, (x + off[0], y + off[1])))
    for x, y, tx, ty in water:
        if not is_shore_water(grid, tx, ty):
            continue
        wim = tile_diamond("water_tile", cache, pu=tx % 8, pv=ty % 8)
        cmds.append((wim, (x + off[0], y + off[1])))
    for x, y, tx, ty, ch in land:
        sid = top_sprite_id(grid, tx, ty, kinds)
        pair = tiles.road_pair_mask(grid, tx, ty) if ch in {"r", "c"} else 0
        curb = tiles.road_outer_mask(grid, tx, ty) if ch in {"r", "c"} else 0
        fillet = tiles.road_fillet_vertex(grid, tx, ty) if ch == "r" else 0
        dim = tile_diamond(
            sid, cache, pu=tx % 8, pv=ty % 8, pair_mask=pair, curb_mask=curb, fillet=fillet
        )
        cmds.append((dim, (x + off[0], y + off[1])))
    return cmds


def collect_draw_list(data: dict, g: dict) -> tuple[list[tuple[Image.Image, tuple[int, int]]] | None, dict]:
    """Diamond blits plus click map. Loads each unique sprite once; does not composite."""
    scene = g.get("scene") or {}
    grid = list(scene.get("map") or [])
    objects = list(scene.get("objects") or [])
    empty = _empty_iso()
    if not grid:
        return None, empty
    kinds = tiles.ground_kinds(data)
    reg = load_registry()
    cache: dict[str, Image.Image] = {}
    drop = 0
    land, water = _scan_land_water(grid)
    occupied_lots = tiles.building_pad_cells(objects, reg, tiles.lot_pad_skip(data))

    placed = []
    for obj in objects:
        base = str(obj.get("id") or "")
        tile = obj.get("tile") or [0, 0]
        tx, ty = int(tile[0]), int(tile[1])
        sid = walker_preview_id(base, grid, tx, ty, reg)
        row = reg.get(sid) or reg.get(base) or {}
        fp = row.get("footprint") or [1, 1]
        cols, rows = int(fp[0] or 1), int(fp[1] or 1)
        im = sprite_image(reg, sid, cache, data)
        if im is None:
            continue
        packed = dict(row)
        packed["id"] = sid
        ax, ay = atlas_mod.sprite_foot_anchor(np.array(im), packed)
        if int(obj.get("flip") or 0):
            im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        pos, nw, nh = instance_place(obj, sid, tx, ty, cols, rows, im.width, im.height, ax, ay, drop)
        if nw != im.width or nh != im.height:
            im = im.resize((max(1, nw), max(1, nh)), Image.Resampling.NEAREST)
            rgba = np.array(im)
        else:
            rgba = np.array(im)
        if str(row.get("kind") or "") != "building":
            rgba = column_mask.clip_rgba(
                rgba, pos, grid, tx, ty, cols, rows, TILE_W, occupied_lots
            )
        im = Image.fromarray(rgba, "RGBA")
        placed.append(
            {
                "id": sid,
                "pos": pos,
                "depth": (tx + cols - 1) + (ty + rows - 1),
                "tie": tx,
                "im": im,
            }
        )
    placed.sort(key=lambda o: (o["depth"], o["tie"]))

    boxes = [(x, y, x + TILE_W, y + TILE_H + int(tiles.CLIFF_DEPTH)) for x, y, _tx, _ty in water]
    for x, y, _tx, _ty, ch in land:
        boxes.append((x, y, x + TILE_W, y + TILE_H + int(tiles.CLIFF_DEPTH)))
    boxes += [
        (o["pos"][0], o["pos"][1], o["pos"][0] + o["im"].width, o["pos"][1] + o["im"].height)
        for o in placed
    ]
    if not boxes:
        return None, empty
    min_x = min(b[0] for b in boxes)
    min_y = min(b[1] for b in boxes)
    size = (max(b[2] for b in boxes) - min_x + 2 * PAD, max(b[3] for b in boxes) - min_y + 2 * PAD)
    off = (PAD - min_x, PAD - min_y)
    iso = {
        "off_x": off[0],
        "off_y": off[1],
        "half_w": HALF_W,
        "half_h": HALF_H,
        "tile_w": TILE_W,
        "tile_h": TILE_H,
        "drop": drop,
        "pad": PAD,
        "width": size[0],
        "height": size[1],
        "land": len(land),
        "objects": len(placed),
        "n_ground": 0,
    }

    cmds = _ground_cmds(grid, land, water, kinds, cache, off)
    iso["n_ground"] = len(cmds)
    for o in placed:
        pos = (o["pos"][0] + off[0], o["pos"][1] + off[1])
        cmds.append((o["im"], pos))
    return cmds, iso


def _empty_iso() -> dict:
    return {
        "off_x": 0,
        "off_y": 0,
        "half_w": HALF_W,
        "half_h": HALF_H,
        "tile_w": TILE_W,
        "tile_h": TILE_H,
        "drop": 0,
        "pad": PAD,
        "width": 0,
        "height": 0,
        "land": 0,
        "objects": 0,
        "n_ground": 0,
    }


def sprite_wh_meta(
    reg: dict[str, dict],
    sid: str,
    data: dict | None,
    cache_wh: dict[str, tuple[int, int, int, int] | None],
) -> tuple[int, int, int, int] | None:
    """Packed size and foot_anchor. Buildings crop before packed_wh so the click map matches the blit."""
    if sid in cache_wh:
        return cache_wh[sid]
    row = reg.get(sid)
    if not row:
        cache_wh[sid] = None
        return None
    outp = OUT_DIR / f"{sid}.png"
    if outp.is_file():
        with Image.open(outp) as im:
            src_w, src_h = im.size
        packed = dict(row)
        packed["id"] = sid
        ax, ay = atlas_mod.sprite_foot_xy(src_w, src_h, packed)
        cache_wh[sid] = (src_w, src_h, ax, ay)
        return src_w, src_h, ax, ay
    path = REPO / str(row.get("file") or "")
    if not path.is_file():
        cache_wh[sid] = None
        return None
    packed = dict(row)
    packed["id"] = sid
    if packed.get("sprite_h") is None:
        sh = atlas_mod.sprite_h_for(sid, str(packed.get("kind") or "decor"), data)
        if sh is not None:
            packed["sprite_h"] = sh
    rgba: np.ndarray | None = None
    if str(packed.get("kind") or "") == "building":
        rgb = np.array(Image.open(path).convert("RGB"), dtype=np.uint8)
        rgba = atlas_mod.prepare_sprite_rgba(packed, atlas_mod.key_to_rgba(rgb))
        src_w, src_h = int(rgba.shape[1]), int(rgba.shape[0])
    else:
        with Image.open(path) as im:
            src_w, src_h = im.size
    tw, th = atlas_mod.packed_wh(
        packed,
        TILE_W,
        int(src_w),
        int(src_h),
        atlas_mod.building_min_sprite_h(packed, data),
        data,
    )
    ax, ay = atlas_mod.sprite_foot_xy(tw, th, packed)
    cache_wh[sid] = (tw, th, ax, ay)
    return tw, th, ax, ay


def iso_meta_from_world(data: dict, g: dict) -> dict:
    """Click map without decoding RGBA or compositing the island."""
    scene = g.get("scene") or {}
    grid = list(scene.get("map") or [])
    objects = list(scene.get("objects") or [])
    empty = _empty_iso()
    if not grid:
        return empty
    reg = load_registry()
    cache_wh: dict[str, tuple[int, int, int, int] | None] = {}
    drop = 0
    land: list[tuple[int, int, int, int, str]] = []
    water: list[tuple[int, int]] = []
    for ty, row in enumerate(grid):
        for tx, ch in enumerate(row):
            ox, oy = tile_origin(tx, ty)
            if ch == "~":
                water.append((ox, oy))
            else:
                land.append((ox, oy, tx, ty, ch))
    land.sort(key=lambda t: (t[3] + t[2], t[2]))

    placed: list[dict] = []
    for obj in objects:
        base = str(obj.get("id") or "")
        tile = obj.get("tile") or [0, 0]
        tx, ty = int(tile[0]), int(tile[1])
        sid = walker_preview_id(base, grid, tx, ty, reg)
        row = reg.get(sid) or reg.get(base) or {}
        fp = row.get("footprint") or [1, 1]
        cols, rows = int(fp[0] or 1), int(fp[1] or 1)
        geom = sprite_wh_meta(reg, sid, data, cache_wh)
        if geom is None:
            continue
        tw, th, ax, ay = geom
        pos, nw, nh = instance_place(obj, sid, tx, ty, cols, rows, tw, th, ax, ay, drop)
        placed.append(
            {
                "id": sid,
                "tx": tx,
                "ty": ty,
                "pos": pos,
                "depth": (tx + cols - 1) + (ty + rows - 1),
                "tie": tx,
                "tw": nw,
                "th": nh,
                "native_w": tw,
                "native_h": th,
                "ax": ax,
                "ay": ay,
                "cols": cols,
                "rows": rows,
                "obj": obj,
            }
        )
    placed.sort(key=lambda o: (o["depth"], o["tie"]))

    boxes = [(x, y, x + TILE_W, y + TILE_H + int(tiles.CLIFF_DEPTH)) for x, y in water]
    for x, y, _tx, _ty, ch in land:
        boxes.append((x, y, x + TILE_W, y + TILE_H + int(tiles.CLIFF_DEPTH)))
    boxes += [
        (o["pos"][0], o["pos"][1], o["pos"][0] + o["tw"], o["pos"][1] + o["th"]) for o in placed
    ]
    if not boxes:
        return empty
    min_x = min(b[0] for b in boxes)
    min_y = min(b[1] for b in boxes)
    size = (max(b[2] for b in boxes) - min_x + 2 * PAD, max(b[3] for b in boxes) - min_y + 2 * PAD)
    off = (PAD - min_x, PAD - min_y)
    hits = []
    for o in placed:
        obj = o.get("obj") if isinstance(o.get("obj"), dict) else {}
        hits.append(
            {
                "id": o["id"],
                "tx": o["tx"],
                "ty": o["ty"],
                "x": o["pos"][0] + off[0],
                "y": o["pos"][1] + off[1],
                "w": o["tw"],
                "h": o["th"],
                "ox": int(obj.get("ox") or 0),
                "oy": int(obj.get("oy") or 0),
                "lift": int(obj.get("lift") or 0),
                "w_px": int(obj.get("w_px") or 0),
                "h_px": int(obj.get("h_px") or 0),
                "flip": int(obj.get("flip") or 0),
                "native_w": o["native_w"],
                "native_h": o["native_h"],
                "ax": o["ax"],
                "ay": o["ay"],
                "cols": o["cols"],
                "rows": o["rows"],
                "depth": o["depth"],
            }
        )
    return {
        "off_x": off[0],
        "off_y": off[1],
        "half_w": HALF_W,
        "half_h": HALF_H,
        "tile_w": TILE_W,
        "tile_h": TILE_H,
        "drop": drop,
        "pad": PAD,
        "width": size[0],
        "height": size[1],
        "land": len(land),
        "objects": len(placed),
        "hits": hits,
    }


def paint_ground_canvas(data: dict, g: dict, iso: dict) -> Image.Image | None:
    """Land/water/cliff only. Same canvas size as iso_meta so live sprites sit on the tiles."""
    w, h = int(iso.get("width") or 0), int(iso.get("height") or 0)
    if w <= 0 or h <= 0:
        return None
    scene = g.get("scene") or {}
    grid = list(scene.get("map") or [])
    if not grid:
        return None
    kinds = tiles.ground_kinds(data)
    cache: dict[str, Image.Image] = {}
    land, water = _scan_land_water(grid)
    off = (int(iso["off_x"]), int(iso["off_y"]))
    canvas = Image.new("RGBA", (w, h), BACKDROP)
    for im, xy in _ground_cmds(grid, land, water, kinds, cache, off):
        canvas.alpha_composite(im, xy)
    return canvas


def render_world(data: dict, g: dict) -> tuple[Image.Image | None, dict]:
    """Isometric proof frame plus click map. Does not write scene.json (L184)."""
    cmds, iso = collect_draw_list(data, g)
    if not cmds:
        return None, iso
    canvas = Image.new("RGBA", (iso["width"], iso["height"]), BACKDROP)
    for im, xy in cmds:
        canvas.alpha_composite(im, xy)
    return canvas, iso


def write_preview(
    canvas: Image.Image,
    iso: dict,
    grid_overlay: bool = False,
    g: dict | None = None,
    cmds: list[tuple[Image.Image, tuple[int, int]]] | None = None,
) -> None:
    preview = ART / "preview"
    preview.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(preview / "scene.png")
    public = {k: v for k, v in iso.items() if k not in ("n_ground", "hits")}
    (preview / "scene.iso.json").write_text(
        json.dumps(public, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"scene.png  {iso['width']}x{iso['height']}  "
        f"{iso['land']} land tiles, {iso['objects']} objects"
    )
    if not grid_overlay or g is None or cmds is None:
        return
    overlay = Image.new("RGBA", canvas.size, BACKDROP)
    n_ground = int(iso.get("n_ground") or 0)
    for im, xy in cmds[:n_ground]:
        overlay.alpha_composite(im, xy)
    grid = list((g.get("scene") or {}).get("map") or [])
    paint_tile_outlines(overlay, iso, grid)
    for im, xy in cmds[n_ground:]:
        overlay.alpha_composite(im, xy)
    overlay.convert("RGB").save(preview / "scene_grid.png")
    print("  scene_grid.png written with ground diamonds under the sprites")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--grid", action="store_true")
    args = parser.parse_args()
    data = sections()
    g = world.build_world(data, {}, world.pp(data, "demo_seed"))
    cmds, iso = collect_draw_list(data, g)
    if not cmds:
        print("scene.py: generated map is empty; run python content/build.py", file=sys.stderr)
        return 1
    canvas = Image.new("RGBA", (iso["width"], iso["height"]), BACKDROP)
    for im, xy in cmds:
        canvas.alpha_composite(im, xy)
    write_preview(canvas, iso, grid_overlay=bool(args.grid), g=g, cmds=cmds)
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
