"""Vertical-column occupancy for iso sprites (R-V-58, R-V-59).

A pixel of a non-building lives if a plumb line down the screen first hits a keep
diamond. Buildings keep their eaves over foreign r (R-V-56). tileAt(px, py) on a
wall is the R-V-56 bug: it treats the wall as ground.
"""

from __future__ import annotations

CLIP_CHARS = frozenset("rc~bdw")
KEEP_NEIGHBOR = frozenset(".psk")
ORTHO = ((1, 0), (-1, 0), (0, 1), (0, -1))


def tile_origin(tx: int, ty: int, tile_w: int) -> tuple[int, int]:
    half_w = max(1, tile_w // 2)
    quarter_h = max(1, half_w // 2)
    return (tx - ty) * half_w, (tx + ty) * quarter_h


def tile_center(tx: int, ty: int, tile_w: int) -> tuple[int, int]:
    ox, oy = tile_origin(tx, ty, tile_w)
    half_w = max(1, tile_w // 2)
    quarter_h = max(1, half_w // 2)
    return ox + half_w, oy + quarter_h


def diamond_y_span(px: int, tx: int, ty: int, tile_w: int) -> tuple[int, int] | None:
    """Inclusive y interval where x=px is inside the tile diamond, or None."""
    half_w = max(1, tile_w // 2)
    quarter_h = max(1, half_w // 2)
    cx, cy = tile_center(tx, ty, tile_w)
    dx = abs(px - cx)
    if dx > half_w:
        return None
    slack = quarter_h * (half_w - dx)
    y_half = slack // half_w
    return cy - y_half, cy + y_half


def cell(grid: list[str], x: int, y: int) -> str:
    if y < 0 or y >= len(grid) or x < 0 or x >= len(grid[y]):
        return ""
    return grid[y][x]


def footprint_tiles(tx: int, ty: int, cols: int, rows: int) -> set[tuple[int, int]]:
    out: set[tuple[int, int]] = set()
    for dy in range(max(1, rows)):
        for dx in range(max(1, cols)):
            out.add((tx + dx, ty + dy))
    return out


def keep_tiles(
    grid: list[str],
    tx: int,
    ty: int,
    cols: int,
    rows: int,
    occupied: set[tuple[int, int]] | None = None,
) -> set[tuple[int, int]]:
    foot = footprint_tiles(tx, ty, cols, rows)
    keep = set(foot)
    foreign = set()
    if occupied:
        foreign = occupied - foot
    for fx, fy in foot:
        for dx, dy in ORTHO:
            nx, ny = fx + dx, fy + dy
            if (nx, ny) in foot:
                continue
            if (nx, ny) in foreign:
                continue
            if cell(grid, nx, ny) in KEEP_NEIGHBOR:
                keep.add((nx, ny))
    return keep


def _grid_wh(grid: list[str]) -> tuple[int, int]:
    h = len(grid)
    w = len(grid[0]) if h else 0
    return w, h


def first_hit_tile(
    px: int,
    py: int,
    grid: list[str],
    tile_w: int,
    tiles: set[tuple[int, int]] | None = None,
) -> tuple[int, int] | None:
    """First diamond the downward ray (px, y>=py) meets. Front-most on ties."""
    if not grid:
        return None
    gw, gh = _grid_wh(grid)
    if tiles is None:
        scan = ((tx, ty) for ty in range(gh) for tx in range(min(gw, len(grid[ty]))))
    else:
        scan = tiles
    best: tuple[int, int, int, int] | None = None
    for tx, ty in scan:
        if ty < 0 or ty >= gh or tx < 0 or tx >= len(grid[ty]):
            continue
        span = diamond_y_span(px, tx, ty, tile_w)
        if span is None:
            continue
        y0, y1 = span
        if py > y1:
            continue
        hit_y = py if py >= y0 else y0
        depth = tx + ty
        cand = (hit_y, -depth, tx, ty)
        if best is None or cand < best:
            best = cand
    if best is None:
        return None
    return best[2], best[3]


def search_tiles(
    tx: int,
    ty: int,
    cols: int,
    rows: int,
    grid: list[str],
    occupied: set[tuple[int, int]] | None = None,
) -> set[tuple[int, int]]:
    """Footprint, keep neighbours, and one ring of clip tiles — enough for eaves."""
    keep = keep_tiles(grid, tx, ty, cols, rows, occupied)
    out = set(keep)
    gw, gh = _grid_wh(grid)
    for fx, fy in list(keep):
        for dx, dy in ORTHO:
            nx, ny = fx + dx, fy + dy
            if 0 <= ny < gh and 0 <= nx < len(grid[ny]):
                out.add((nx, ny))
    if occupied:
        out |= occupied
    return out


def pixel_kept(
    px: int,
    py: int,
    grid: list[str],
    tx: int,
    ty: int,
    cols: int,
    rows: int,
    tile_w: int,
    kind: str = "decor",
    occupied: set[tuple[int, int]] | None = None,
) -> bool:
    if kind == "building":
        return True
    keep = keep_tiles(grid, tx, ty, cols, rows, occupied)
    hit = first_hit_tile(px, py, grid, tile_w, search_tiles(tx, ty, cols, rows, grid, occupied))
    if hit is None:
        return True
    if hit in keep:
        return True
    if occupied and hit in occupied:
        return False
    ch = cell(grid, hit[0], hit[1])
    if ch in CLIP_CHARS:
        return False
    return True


def clip_rgba(
    rgba,
    pos: tuple[int, int],
    grid: list[str],
    tx: int,
    ty: int,
    cols: int,
    rows: int,
    tile_w: int,
    occupied: set[tuple[int, int]] | None = None,
):
    """Zero alpha of opaque non-building pixels whose first plumb hit is foreign asphalt/water/lot."""
    import numpy as np

    out = np.array(rgba, copy=True)
    h, w = out.shape[0], out.shape[1]
    keep = keep_tiles(grid, tx, ty, cols, rows, occupied)
    scan = search_tiles(tx, ty, cols, rows, grid, occupied)
    foreign = occupied or set()
    sx, sy = pos
    for j in range(h):
        wy = sy + j
        for i in range(w):
            if out[j, i, 3] == 0:
                continue
            hit = first_hit_tile(sx + i, wy, grid, tile_w, scan)
            if hit is None or hit in keep:
                continue
            if hit in foreign or cell(grid, hit[0], hit[1]) in CLIP_CHARS:
                out[j, i, 3] = 0
    return out
