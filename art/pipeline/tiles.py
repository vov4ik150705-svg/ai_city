"""Procedural isometric ground tileset.

Ground and roads are the one part of this art you should not hand to a diffusion
model. They need pixel-exact shared edges and all 15 road connection variants, and a
model holds neither. Drawing them from the master palette is cheaper, instant, and
correct by construction.

Tiles are authored as flat top-down squares and then warped into the 2:1 diamond,
because drawing a straight road band on a square is trivial while drawing it
already-skewed is not.

    python art/pipeline/tiles.py
"""

from __future__ import annotations

import functools
import math
from pathlib import Path

import numpy as np
from PIL import Image

from pixelize import ART, PALETTE_FILE, load_palette, quantize, subpalette, to_image

TILE_W, TILE_H = 64, 32
TEX = 64
_BAND_BPS = 10000
_road_band: float | None = None
# The ocean is one wrapped WATER_PERIOD x WATER_PERIOD block of tiles, not a per-tile
# pattern: any feature whose period equals the tile is seamless and still reads as a
# lattice, because every tile then carries the identical shape.
WATER_PERIOD = 8
WATER_SEED, WATER_SEED_DEEP = 37, 137
# Ripples are placed as short screen-horizontal dashes rather than drawn by a wave. A wave
# short enough to be visible has a period short enough to be seen as a grid - that is what
# turned the first attempt into chain-link mesh and the second into polka dots.
RIPPLE_DASHES, RIPPLE_LEN, RIPPLE_THICK = 5, 9.0, 0.9
CREST_DASHES, CREST_LEN = 2, 5.0
DEEP_RIPPLE_DASHES = 1
GRAIN_SHARE = 0.06
CREST_SHARE_MAX = 0.10

# Screen-space names for the four tile-space neighbours, as (du, dv).
DIRS = {"NE": (0, -1), "SE": (1, 0), "SW": (0, 1), "NW": (-1, 0)}

# Pack still names earth/cliff ids (derived.render.cube_*), but the frame is diamonds (R-V-52).
CUBE_DIRT = "island_dirt_earth"
CUBE_CLIFF = "island_cliff_earth"
CUBE_ROCK = "cliff_rock"
CLIFF_DEPTH = 11
ISLAND_SHADOW = (7, 7)
# Occupied building grass uses the plaza cube, not a new legend char (R-V-47).
LOT_PAD = "plaza_tile"
LOT_PAD_SKIP = ("park", "plaza")
GROUND_KINDS = {
    "~": {"kind": "water", "sprite": "water_tile"},
    ".": {"kind": "grass", "sprite": "island_block"},
    "r": {"kind": "road", "sprite": "road_straight"},
    "s": {"kind": "sidewalk", "sprite": "sidewalk"},
    "c": {"kind": "crosswalk", "sprite": "crosswalk"},
    "p": {"kind": "plaza_tile", "sprite": "plaza_tile"},
    "m": {"kind": "masonry", "sprite": "masonry"},
    "k": {"kind": "parking", "sprite": "parking"},
    "b": {"kind": "beach", "sprite": "beach"},
    "d": {"kind": "dock", "sprite": "beach"},
    "w": {"kind": "waterfall", "sprite": "waterfall"},
}


def set_pack(data: dict | None) -> None:
    """Bind road_band_half_bps from the pack. Fallback is the previous 0.23 band."""
    global _road_band
    row = ((((data or {}).get("render") or {}).get("params") or {}).get("road_band_half_bps") or {})
    v = int(row.get("v") or 0)
    _road_band = (v / _BAND_BPS) if v > 0 else None


def road_band() -> float:
    global _road_band
    if _road_band is None:
        p = Path(__file__).resolve().parents[2] / "content" / "params" / "render.json"
        if p.is_file():
            import json

            blob = json.loads(p.read_text(encoding="utf-8"))
            set_pack({"render": blob})
    if _road_band is not None:
        return _road_band
    return 4000 / _BAND_BPS


def ground_kinds(data: dict | None = None) -> dict:
    out = {ch: dict(row) for ch, row in GROUND_KINDS.items()}
    extra = (data or {}).get("_tiles_extra_kind")
    if isinstance(extra, dict):
        for ch, row in extra.items():
            if isinstance(row, dict):
                out[str(ch)] = dict(row)
    return out


def lot_pad_id(data: dict | None = None) -> str:
    overlay = (data or {}).get("_lot_pad")
    if isinstance(overlay, str) and overlay:
        return overlay
    return LOT_PAD


def lot_pad_skip(data: dict | None = None) -> tuple[str, ...]:
    overlay = (data or {}).get("_lot_pad_skip")
    if isinstance(overlay, (list, tuple)):
        return tuple(str(x) for x in overlay)
    return LOT_PAD_SKIP


def grass_sprite(kinds: dict | None = None) -> str:
    row = (kinds or GROUND_KINDS).get(".") or {}
    return str(row.get("sprite") or "island_block")


def building_pad_cells(
    objects: list,
    registry: dict,
    skip: tuple[str, ...] | list[str],
) -> set[tuple[int, int]]:
    """Tiles under kind=building footprints, except park/plaza greenery."""
    cells: set[tuple[int, int]] = set()
    skip_set = {str(s) for s in skip}
    for obj in objects:
        if not isinstance(obj, dict):
            continue
        sid = str(obj.get("id") or "")
        if sid in skip_set:
            continue
        row = registry.get(sid) or {}
        if str(row.get("kind") or "") != "building":
            continue
        tile = obj.get("tile") or [0, 0]
        if not isinstance(tile, list) or len(tile) < 2:
            continue
        tx, ty = int(tile[0]), int(tile[1])
        fp = row.get("footprint") or [1, 1]
        cols, rows = int(fp[0] or 1), int(fp[1] or 1)
        for dy in range(max(0, rows)):
            for dx in range(max(0, cols)):
                cells.add((tx + dx, ty + dy))
    return cells


def apply_lot_pad(
    sid: str,
    tx: int,
    ty: int,
    kinds: dict,
    pad_cells: set[tuple[int, int]],
    data: dict | None = None,
) -> str:
    if sid != grass_sprite(kinds):
        return sid
    if (tx, ty) not in pad_cells:
        return sid
    pad = lot_pad_id(data)
    return pad if pad else sid


# 4-bit NESW mask → sprite id. 0 and 15 reuse painted cubes (D-V-12). TZ_ART §3.
ROAD_AUTOTILE = (
    "road_plaza",
    "road_n",
    "road_e",
    "road_ne",
    "road_s",
    "road_ns",
    "road_se",
    "road_nes",
    "road_w",
    "road_nw",
    "road_ew",
    "road_nwe",
    "road_sw",
    "road_nsw",
    "road_esw",
    "road_cross",
)
SIDEWALK_AUTOTILE = (
    "sidewalk",
    "sidewalk_n",
    "sidewalk_e",
    "sidewalk_ne",
    "sidewalk_s",
    "sidewalk_ns",
    "sidewalk_se",
    "sidewalk_nes",
    "sidewalk_w",
    "sidewalk_nw",
    "sidewalk_ew",
    "sidewalk_nwe",
    "sidewalk_sw",
    "sidewalk_nsw",
    "sidewalk_esw",
    "sidewalk_nesw",
)
# UV names for tex_road: tile N/E/S/W → NE/SE/SW/NW in the square texture.
MASK_UV = ("NE", "SE", "SW", "NW")


def _cell_in(grid: list[str], x: int, y: int, chars: tuple[str, ...]) -> bool:
    if y < 0 or x < 0 or y >= len(grid) or x >= len(grid[0]):
        return False
    return grid[y][x] in chars


def neighbor_mask(grid: list[str], tx: int, ty: int, chars: tuple[str, ...]) -> int:
    """Bit 0=N, 1=E, 2=S, 3=W. Same order as ROAD_AUTOTILE / render ground.ts."""
    n = _cell_in(grid, tx, ty - 1, chars)
    e = _cell_in(grid, tx + 1, ty, chars)
    s = _cell_in(grid, tx, ty + 1, chars)
    w = _cell_in(grid, tx - 1, ty, chars)
    return int(n) + (int(e) << 1) + (int(s) << 2) + (int(w) << 3)


def road_sprite(grid: list[str], tx: int, ty: int) -> str:
    """15-way road cube. Neighbour 'c' counts as road."""
    return ROAD_AUTOTILE[neighbor_mask(grid, tx, ty, ("r", "c"))]


def _run_len(grid: list[str], tx: int, ty: int, dx: int, dy: int) -> int:
    n = 1
    x, y = tx + dx, ty + dy
    while _cell_in(grid, x, y, ("r", "c")):
        n += 1
        x += dx
        y += dy
    x, y = tx - dx, ty - dy
    while _cell_in(grid, x, y, ("r", "c")):
        n += 1
        x -= dx
        y -= dy
    return n


def _rc(grid: list[str], x: int, y: int) -> bool:
    return _cell_in(grid, x, y, ("r", "c"))


def _ns_corridor(grid: list[str], tx: int, ty: int) -> bool:
    """(tx,ty) and (tx+1,ty) sit on a 2-wide north-south strip, including through a junction."""
    if not _rc(grid, tx, ty) or not _rc(grid, tx + 1, ty):
        return False
    y0, y1 = ty, ty
    while y0 > ty - 16 and _rc(grid, tx, y0 - 1) and _rc(grid, tx + 1, y0 - 1):
        y0 -= 1
    while y1 < ty + 16 and _rc(grid, tx, y1 + 1) and _rc(grid, tx + 1, y1 + 1):
        y1 += 1
    for y in range(y0, y1 + 1):
        if _run_len(grid, tx, y, 1, 0) == 2:
            return True
    return False


def _ew_corridor(grid: list[str], tx: int, ty: int) -> bool:
    """(tx,ty) and (tx,ty+1) sit on a 2-wide east-west strip, including through a junction."""
    if not _rc(grid, tx, ty) or not _rc(grid, tx, ty + 1):
        return False
    x0, x1 = tx, tx
    while x0 > tx - 16 and _rc(grid, x0 - 1, ty) and _rc(grid, x0 - 1, ty + 1):
        x0 -= 1
    while x1 < tx + 16 and _rc(grid, x1 + 1, ty) and _rc(grid, x1 + 1, ty + 1):
        x1 += 1
    for x in range(x0, x1 + 1):
        if _run_len(grid, x, ty, 0, 1) == 2:
            return True
    return False


def road_pair_mask(grid: list[str], tx: int, ty: int) -> int:
    """Median on the 2-wide seam, continued through L/T junctions (R-V-66, R-V-72)."""
    bits = 0
    if _ns_corridor(grid, tx, ty):
        bits |= 2
    if _ns_corridor(grid, tx - 1, ty):
        bits |= 8
    if _ew_corridor(grid, tx, ty):
        bits |= 4
    if _ew_corridor(grid, tx, ty - 1):
        bits |= 1
    return bits


def road_outer_mask(grid: list[str], tx: int, ty: int) -> int:
    """Light curb on 2-wide outer long sides, continued around a corner (R-V-69, R-V-72)."""
    n = _rc(grid, tx, ty - 1)
    e = _rc(grid, tx + 1, ty)
    s = _rc(grid, tx, ty + 1)
    w = _rc(grid, tx - 1, ty)
    bits = 0
    if _ns_corridor(grid, tx, ty) or _ns_corridor(grid, tx - 1, ty):
        if not e:
            bits |= 2
        if not w:
            bits |= 8
    if _ew_corridor(grid, tx, ty) or _ew_corridor(grid, tx, ty - 1):
        if not s:
            bits |= 4
        if not n:
            bits |= 1
    return bits


def _two(grid: list[str], x: int, y: int, dx: int, dy: int) -> bool:
    return _rc(grid, x, y) and _rc(grid, x + dx, y + dy)


def road_fillet_vertex(grid: list[str], tx: int, ty: int) -> int:
    """Diamond vertex of a 2-wide L crook: 1=top, 2=right, 4=bottom, 8=left."""
    if not _rc(grid, tx, ty):
        return 0
    for x0, y0 in ((tx, ty), (tx - 1, ty), (tx, ty - 1), (tx - 1, ty - 1)):
        if not (_two(grid, x0, y0, 1, 0) and _two(grid, x0, y0 + 1, 1, 0)):
            continue
        n = _two(grid, x0, y0 - 1, 1, 0)
        s = _two(grid, x0, y0 + 2, 1, 0)
        w = _two(grid, x0 - 1, y0, 0, 1)
        e = _two(grid, x0 + 2, y0, 0, 1)
        if int(n) + int(s) + int(w) + int(e) != 2:
            continue
        if (n and s) or (e and w):
            continue
        if n and e:
            crook, vert = (x0 + 1, y0), 8
        elif n and w:
            crook, vert = (x0, y0), 4
        elif s and e:
            crook, vert = (x0 + 1, y0 + 1), 1
        elif s and w:
            crook, vert = (x0, y0 + 1), 2
        else:
            continue
        if (tx, ty) == crook:
            return vert
    return 0


def curb_fillet_vertex(curb: int) -> int:
    """Outer corner: two adjacent curb bits meet at a diamond vertex."""
    n, e, s, w = curb & 1, curb & 2, curb & 4, curb & 8
    if w and s and not n and not e:
        return 8
    if e and s and not n and not w:
        return 4
    if e and n and not s and not w:
        return 2
    if w and n and not s and not e:
        return 1
    return 0


def assert_road_pair_mask() -> None:
    """NS/EW 2-wide ends get the seam only, never a cap line (R-V-66)."""
    ns = [".rr.", ".rr.", ".rr.", ".rr."]
    if road_pair_mask(ns, 1, 0) != 2 or road_pair_mask(ns, 2, 0) != 8:
        raise AssertionError("NS north cap must pair only E/W")
    if road_pair_mask(ns, 1, 3) != 2 or road_pair_mask(ns, 2, 3) != 8:
        raise AssertionError("NS south cap must pair only E/W")
    ew = ["....", "rrrr", "rrrr", "...."]
    if road_pair_mask(ew, 0, 1) != 4 or road_pair_mask(ew, 0, 2) != 1:
        raise AssertionError("EW west cap must pair only N/S")
    if road_pair_mask(ew, 3, 1) != 4 or road_pair_mask(ew, 3, 2) != 1:
        raise AssertionError("EW east cap must pair only N/S")
    if road_outer_mask(ns, 1, 0) != 8 or road_outer_mask(ns, 2, 0) != 2:
        raise AssertionError("NS outer curb is the long sides, not the cap")
    if road_outer_mask(ns, 1, 3) != 8 or road_outer_mask(ns, 2, 3) != 2:
        raise AssertionError("NS south cap must not grow a sideways curb")
    elbow = [".rr..", ".rr..", ".rrrr", ".rrrr", "....."]
    if road_pair_mask(elbow, 2, 2) != 12:
        raise AssertionError("L crook must keep both medians through the corner")
    if road_fillet_vertex(elbow, 2, 2) != 8:
        raise AssertionError("L crook fillets the left diamond vertex")
    tee = ["..rr..", "..rr..", "rrrrrr", "rrrrrr", "......"]
    if road_pair_mask(tee, 2, 2) == 0:
        raise AssertionError("T inner must keep the median, not drop it")
    pix, _al = diamond_rgba("road_se", 1, pair_mask=12, fillet=8)
    if int(np.all(pix == rgb("e6ecf5"), axis=2).sum()) < 8:
        raise AssertionError("L fillet must paint on the diamond")


def sidewalk_sprite(grid: list[str], tx: int, ty: int) -> str:
    """Curb faces adjacent road/crosswalk, not other sidewalk."""
    return SIDEWALK_AUTOTILE[neighbor_mask(grid, tx, ty, ("r", "c"))]


def road_autotile_ids() -> list[str]:
    return list(ROAD_AUTOTILE)


def sidewalk_autotile_ids() -> list[str]:
    return list(SIDEWALK_AUTOTILE)


def mask_uv_dirs(mask: int) -> tuple[str, ...]:
    return tuple(name for i, name in enumerate(MASK_UV) if mask & (1 << i))


def rgb(hexstr: str) -> np.ndarray:
    return np.array([int(hexstr[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.uint8)


def uv_grid() -> tuple[np.ndarray, np.ndarray]:
    axis = np.linspace(0.0, 1.0, TEX, endpoint=False)
    return np.meshgrid(axis, axis)  # uu varies along x, vv along y, matching tex[v, u]


def speckle(
    shape: tuple[int, int],
    colors: list[str],
    weights: list[float],
    seed: int,
    clump: int = 2,
) -> np.ndarray:
    """Clumps rather than single pixels, so the noise survives the iso squash."""
    rng = np.random.default_rng(seed)
    h, w = shape
    step = clump if clump > 0 else 2
    small = rng.choice(
        len(colors),
        size=(h // step + 1, w // step + 1),
        p=np.array(weights) / sum(weights),
    )
    idx = np.repeat(np.repeat(small, step, axis=0), step, axis=1)[:h, :w]
    lut = np.stack([rgb(c) for c in colors])
    return lut[idx]


def tex_grass(seed: int) -> np.ndarray:
    # Solid original-spot colour 2e3a16. The second field 0f3d1f was the dark
    # patches. seed kept so diamond_rgba signature stays (R-V-63).
    _ = seed
    tex = np.empty((TEX, TEX, 3), dtype=np.uint8)
    tex[:] = rgb("2e3a16")
    return tex


def tex_concrete(seed: int) -> np.ndarray:
    tex = speckle((TEX, TEX), ["4a5266", "3a3f4d", "5c667c"], [58, 26, 16], seed)
    uu, vv = uv_grid()
    seam = (np.abs(uu - 0.5) < 0.012) | (np.abs(vv - 0.5) < 0.012)
    tex[seam] = rgb("3a3f4d")
    return tex


def wrapped_blobs(size: int, seed: int, cells: int) -> np.ndarray:
    """Smoothstep value noise on a cells x cells lattice, periodic in both axes."""
    rng = np.random.default_rng(seed)
    grid = rng.random((cells, cells))
    t = np.arange(size) * cells / size
    i0 = np.floor(t).astype(int)
    f = t - i0
    f = f * f * (3.0 - 2.0 * f)
    i1 = (i0 + 1) % cells
    ay, ax = f[:, None], f[None, :]
    return (
        grid[np.ix_(i0, i0)] * (1 - ax) * (1 - ay)
        + grid[np.ix_(i0, i1)] * ax * (1 - ay)
        + grid[np.ix_(i1, i0)] * (1 - ax) * ay
        + grid[np.ix_(i1, i1)] * ax * ay
    )


def dash_centres(size: int, seed: int, count: int,
                 half_len: float) -> list[tuple[int, int, float]]:
    rng = np.random.default_rng(seed)
    out = []
    for _ in range(count):
        x0, y0 = (int(v) for v in rng.integers(0, size, 2))
        out.append((x0, y0, float(rng.uniform(0.5, 1.0)) * half_len))
    return out


def dash_mask(size: int, centres: list[tuple[int, int, float]], thick: float) -> np.ndarray:
    """Short dashes that read as screen-horizontal after iso_warp.

    The warp sends screen x to (u - v) and screen y to (u + v), so a dash stays level on
    screen by holding (u + v) and running along (u - v). Offsets wrap, so a dash crossing
    the block edge continues on the far side and the block still tiles.
    """
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    out = np.zeros((size, size), bool)
    for x0, y0, hl in centres:
        dx = ((xs - x0 + size / 2) % size) - size / 2
        dy = ((ys - y0 + size / 2) % size) - size / 2
        out |= (np.abs(dx + dy) <= thick * 2.0) & (np.abs(dx - dy) <= hl * 2.0)
    return out


@functools.cache
def water_block(deep: bool) -> np.ndarray:
    n = WATER_PERIOD * TEX
    seed = WATER_SEED_DEEP if deep else WATER_SEED
    # Open sea sits on the backdrop colour, so the edge of a finite map does not read as
    # a shoreline in the middle of the sky.
    tex = np.broadcast_to(rgb("12203f"), (n, n, 3)).copy()

    blob = wrapped_blobs(n, seed, WATER_PERIOD * 2)
    tex[blob > (0.74 if deep else 0.62)] = rgb("1b2436")

    rng = np.random.default_rng(seed + 5)
    grain = rng.random((n // 2 + 1, n // 2 + 1)) < GRAIN_SHARE
    grain = np.repeat(np.repeat(grain, 2, 0), 2, 1)[:n, :n]
    tex[grain] = rgb("1b2436")

    tiles_in_block = WATER_PERIOD * WATER_PERIOD
    ripples = (DEEP_RIPPLE_DASHES if deep else RIPPLE_DASHES) * tiles_in_block
    tex[dash_mask(n, dash_centres(n, seed + 11, ripples, RIPPLE_LEN), RIPPLE_THICK)] = rgb("1b3a6b")
    if not deep:
        crests = dash_centres(n, seed + 23, CREST_DASHES * tiles_in_block, CREST_LEN)
        tex[dash_mask(n, crests, RIPPLE_THICK)] = rgb("2a5a9e")
    return tex


def tex_water(pu: int, pv: int, *, deep: bool = False) -> np.ndarray:
    """The (pu, pv) cut of the ocean block, so neighbouring tiles continue one field."""
    block = water_block(deep)
    return block[pv * TEX : (pv + 1) * TEX, pu * TEX : (pu + 1) * TEX]


def tex_sidewalk(dirs: tuple[str, ...], seed: int) -> np.ndarray:
    """Pavers plus a dark curb only on edges that face a road (TZ_ART §3)."""
    tex = speckle((TEX, TEX), ["5c667c", "4a5266", "c2cbdb"], [50, 30, 20], seed)
    uu, vv = uv_grid()
    curb = np.zeros((TEX, TEX), bool)
    edge = 0.10
    if "SE" in dirs:
        curb |= (uu >= 1.0 - edge)
    if "NW" in dirs:
        curb |= (uu <= edge)
    if "SW" in dirs:
        curb |= (vv >= 1.0 - edge)
    if "NE" in dirs:
        curb |= (vv <= edge)
    tex[curb] = rgb("3a3f4d")
    return tex


def _pair_ok(fillet: int, edge: str, uu: np.ndarray, vv: np.ndarray) -> np.ndarray:
    """Keep the straight median on the half away from the filleted vertex."""
    cut = 0.52
    ones = np.ones(uu.shape, dtype=bool)
    if fillet == 0:
        return ones
    if edge == "NW":
        if fillet == 8:
            return vv <= cut
        if fillet == 1:
            return vv >= 1.0 - cut
        return ones
    if edge == "SE":
        if fillet == 4:
            return vv <= cut
        if fillet == 2:
            return vv >= 1.0 - cut
        return ones
    if edge == "SW":
        if fillet == 8:
            return uu >= 1.0 - cut
        if fillet == 4:
            return uu <= cut
        return ones
    if edge == "NE":
        if fillet == 1:
            return uu >= 1.0 - cut
        if fillet == 2:
            return uu <= cut
        return ones
    return ones


def tex_road(
    dirs: tuple[str, ...],
    seed: int,
    pair: tuple[str, ...] = (),
    curb: tuple[str, ...] = (),
    fillet: int = 0,
) -> np.ndarray:
    """Charcoal asphalt, white dashed median, light curb on 2-wide outer sides (R-V-69)."""
    _ = dirs
    tex = speckle((TEX, TEX), ["2b303b", "3a3f4d", "40465a"], [55, 30, 15], seed + 977)
    uu, vv = uv_grid()
    edge = 0.09
    kerb = np.zeros((TEX, TEX), bool)
    if "SE" in curb:
        kerb |= uu >= 1.0 - edge
    if "NW" in curb:
        kerb |= uu <= edge
    if "SW" in curb:
        kerb |= vv >= 1.0 - edge
    if "NE" in curb:
        kerb |= vv <= edge
    tex[kerb] = rgb("a3aec2")
    dash = np.zeros((TEX, TEX), bool)
    axis = np.arange(TEX)
    step = (axis // 5) % 2 == 0
    band = 0.04
    if "SE" in pair:
        dash |= (uu >= 1.0 - band) & step[:, None] & _pair_ok(fillet, "SE", uu, vv)
    if "NW" in pair:
        dash |= (uu <= band) & step[:, None] & _pair_ok(fillet, "NW", uu, vv)
    if "SW" in pair:
        dash |= (vv >= 1.0 - band) & step[None, :] & _pair_ok(fillet, "SW", uu, vv)
    if "NE" in pair:
        dash |= (vv <= band) & step[None, :] & _pair_ok(fillet, "NE", uu, vv)
    tex[dash] = rgb("e6ecf5")
    return tex


def tex_masonry(seed: int, pu: int = 0, pv: int = 0) -> np.ndarray:
    """Same asphalt as the road, no median and no curb (R-V-71)."""
    return tex_road((), seed + pu + pv * 8, (), ())


def tex_parking(seed: int) -> np.ndarray:
    """Road asphalt, one muted stall bay per diamond — not a bright grid (R-V-72)."""
    tex = tex_road((), seed + 11, (), ())
    uu, vv = uv_grid()
    w = 0.012
    stall = ((np.abs(uu - 0.10) < w) | (np.abs(uu - 0.90) < w)) & (vv > 0.18) & (vv < 0.82)
    tex[stall] = rgb("8e97a6")
    return tex


def iso_warp(tex: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    ys, xs = np.mgrid[0:TILE_H, 0:TILE_W]
    cx, cy = (TILE_W - 1) / 2, (TILE_H - 1) / 2
    inside = np.abs(xs - cx) / (TILE_W / 2) + np.abs(ys - cy) / (TILE_H / 2) <= 1.0

    su = (xs - TILE_W / 2) / (TILE_W / 2)
    sv = ys / (TILE_H / 2)
    ui = np.clip((((su + sv) / 2) * TEX).astype(int), 0, TEX - 1)
    vi = np.clip((((sv - su) / 2) * TEX).astype(int), 0, TEX - 1)

    out = tex[vi, ui].copy()
    out[~inside] = 0
    return out, np.where(inside, 255, 0).astype(np.uint8)


def _paint_fillet(
    pix: np.ndarray, alpha: np.ndarray, vertex: int, colour: str, dashed: bool
) -> None:
    """Quarter-circle on the diamond around `vertex` (R-V-72)."""
    if vertex == 0:
        return
    ys, xs = np.mgrid[0:TILE_H, 0:TILE_W].astype(np.float32)
    top = (TILE_W / 2.0, 0.0)
    right = (float(TILE_W - 1), TILE_H / 2.0)
    bot = (TILE_W / 2.0, float(TILE_H - 1))
    left = (0.0, TILE_H / 2.0)
    if vertex == 1:
        cx, cy = top
        m0 = ((top[0] + left[0]) / 2.0, (top[1] + left[1]) / 2.0)
        m1 = ((top[0] + right[0]) / 2.0, (top[1] + right[1]) / 2.0)
    elif vertex == 2:
        cx, cy = right
        m0 = ((top[0] + right[0]) / 2.0, (top[1] + right[1]) / 2.0)
        m1 = ((bot[0] + right[0]) / 2.0, (bot[1] + right[1]) / 2.0)
    elif vertex == 4:
        cx, cy = bot
        m0 = ((bot[0] + left[0]) / 2.0, (bot[1] + left[1]) / 2.0)
        m1 = ((bot[0] + right[0]) / 2.0, (bot[1] + right[1]) / 2.0)
    else:
        cx, cy = left
        m0 = ((top[0] + left[0]) / 2.0, (top[1] + left[1]) / 2.0)
        m1 = ((bot[0] + left[0]) / 2.0, (bot[1] + left[1]) / 2.0)
    radius = math.hypot(m0[0] - cx, m0[1] - cy)
    dist = np.hypot(xs - cx, ys - cy)
    ang = np.arctan2(ys - cy, xs - cx)
    a0 = math.atan2(m0[1] - cy, m0[0] - cx)
    a1 = math.atan2(m1[1] - cy, m1[0] - cx)
    lo, hi = (a0, a1) if a0 < a1 else (a1, a0)
    if hi - lo > math.pi:
        on_ang = (ang >= hi) | (ang <= lo)
        along = np.where(ang >= hi, ang - hi, ang + (2 * math.pi - hi))
    else:
        on_ang = (ang >= lo) & (ang <= hi)
        along = ang - lo
    on = (np.abs(dist - radius) <= 1.8) & on_ang & (alpha > 0)
    if dashed:
        on &= (np.floor(along * radius / 5.0) % 2) == 0
    pix[on] = rgb(colour)


def tex_plaza(seed: int) -> np.ndarray:
    """Large grey slabs, light grout — City Hall pad on the mockup (R-V-72)."""
    tex = speckle((TEX, TEX), ["555e6e", "4a5260", "5c6678"], [55, 28, 17], seed, clump=8)
    uu, vv = uv_grid()
    w = 0.045
    grout = (uu < w) | (uu > 1.0 - w) | (vv < w) | (vv > 1.0 - w)
    tex[grout] = rgb("8a93a4")
    return tex


def tex_beach(seed: int) -> np.ndarray:
    return speckle((TEX, TEX), ["c4b8a4", "a89880", "d8d0c4"], [48, 32, 20], seed)


def tex_crosswalk(
    seed: int, pair: tuple[str, ...] = (), curb: tuple[str, ...] = ()
) -> np.ndarray:
    tex = tex_road(("NE", "SE", "SW", "NW"), seed, pair, curb)
    uu, vv = uv_grid()
    bars = (np.floor(uu * 8) % 2) == 0
    tex[bars] = rgb("e6ecf5")
    return tex


def tex_waterfall(seed: int) -> np.ndarray:
    tex = tex_water(0, 0)
    uu, vv = uv_grid()
    streak = (np.abs(uu - 0.5) < 0.18) & (vv > 0.2)
    tex[streak] = rgb("2a5a9e")
    return tex


def tex_for_sprite(
    sid: str,
    seed: int,
    pu: int = 0,
    pv: int = 0,
    pair_mask: int = 0,
    curb_mask: int = 0,
    fillet: int = 0,
) -> np.ndarray:
    pair = mask_uv_dirs(pair_mask)
    curb = mask_uv_dirs(curb_mask)
    if sid == "island_block":
        return tex_grass(seed)
    if sid in {"plaza_tile"}:
        return tex_plaza(seed)
    if sid == "masonry":
        return tex_masonry(seed, pu, pv)
    if sid == "parking":
        return tex_parking(seed)
    if sid == "beach":
        return tex_beach(seed)
    if sid == "crosswalk":
        return tex_crosswalk(seed, pair, curb)
    if sid == "waterfall":
        return tex_waterfall(seed)
    if sid.startswith("water"):
        return tex_water(pu, pv, deep="deep" in sid or sid.endswith("_02"))
    if sid.startswith("sidewalk"):
        idx = SIDEWALK_AUTOTILE.index(sid) if sid in SIDEWALK_AUTOTILE else 0
        return tex_sidewalk(mask_uv_dirs(idx), seed)
    if sid.startswith("road_"):
        idx = ROAD_AUTOTILE.index(sid) if sid in ROAD_AUTOTILE else 0
        return tex_road(mask_uv_dirs(idx), seed, pair, curb, fillet)
    return tex_grass(seed)


def diamond_rgba(
    sid: str,
    seed: int = 1,
    pu: int = 0,
    pv: int = 0,
    pair_mask: int = 0,
    curb_mask: int = 0,
    fillet: int = 0,
) -> tuple[np.ndarray, np.ndarray]:
    pix, alpha = iso_warp(tex_for_sprite(sid, seed, pu, pv, pair_mask, curb_mask, fillet))
    if sid.startswith("road_") or sid == "crosswalk":
        _paint_fillet(pix, alpha, fillet, "e6ecf5", True)
        _paint_fillet(pix, alpha, curb_fillet_vertex(curb_mask), "a3aec2", False)
    return pix, alpha


def write_tile(path: Path, rgb: np.ndarray, alpha: np.ndarray) -> None:
    to_image(rgb, alpha).save(path)


def ground_sprite_ids() -> list[str]:
    ids = [str(row["sprite"]) for row in GROUND_KINDS.values()]
    ids.extend(ROAD_AUTOTILE)
    ids.extend(SIDEWALK_AUTOTILE)
    seen: list[str] = []
    for sid in ids:
        if sid not in seen:
            seen.append(sid)
    return seen


def main() -> None:
    assert_road_pair_mask()
    render = ART.parent / "content" / "params" / "render.json"
    if render.is_file():
        import json

        blob = json.loads(render.read_text(encoding="utf-8"))
        set_pack({"render": blob})
    out = ART / "out" / "tiles"
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    for i, sid in enumerate(ground_sprite_ids()):
        rgb, alpha = diamond_rgba(sid, seed=1 + i)
        write_tile(out / f"{sid}.png", rgb, alpha)
        n += 1
    water_dir = out / "water"
    water_dir.mkdir(parents=True, exist_ok=True)
    atlas = np.zeros((WATER_PERIOD * TILE_H, WATER_PERIOD * TILE_W, 4), dtype=np.uint8)
    for pv in range(WATER_PERIOD):
        for pu in range(WATER_PERIOD):
            rgb, alpha = iso_warp(tex_water(pu, pv))
            write_tile(water_dir / f"w_{pu}_{pv}.png", rgb, alpha)
            y, x = pv * TILE_H, pu * TILE_W
            atlas[y : y + TILE_H, x : x + TILE_W, :3] = rgb
            atlas[y : y + TILE_H, x : x + TILE_W, 3] = alpha
    Image.fromarray(atlas, "RGBA").save(out / "water_atlas.png")
    deep = np.zeros_like(atlas)
    for pv in range(WATER_PERIOD):
        for pu in range(WATER_PERIOD):
            rgb, alpha = iso_warp(tex_water(pu, pv, deep=True))
            y, x = pv * TILE_H, pu * TILE_W
            deep[y : y + TILE_H, x : x + TILE_W, :3] = rgb
            deep[y : y + TILE_H, x : x + TILE_W, 3] = alpha
    Image.fromarray(deep, "RGBA").save(out / "water_deep_atlas.png")
    print(f"wrote {n} diamonds + water atlases -> {out}")


if __name__ == "__main__":
    main()
