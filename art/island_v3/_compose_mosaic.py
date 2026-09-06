"""Compose the canon mosaic island builder from recovered fragments."""

from __future__ import annotations

import ast
import re
from pathlib import Path

ROOT = Path(r"C:\Users\sk640\ai_city\art\island_v3")
APPLIED = ROOT / "_recover_dumps" / "applied_196.txt"
OUT = ROOT / "build_island.py"
CURRENT = ROOT / "build_island.py"

MASS = r'''
_STONE_RGB = (
    (0.027, 0.028, 0.030),
    (0.039, 0.040, 0.042),
    (0.050, 0.052, 0.055),
    (0.064, 0.066, 0.069),
    (0.076, 0.078, 0.082),
)
_PLAZA_RGB = (
    (0.048, 0.050, 0.054),
    (0.082, 0.084, 0.090),
    (0.118, 0.122, 0.128),
    (0.168, 0.172, 0.180),
    (0.228, 0.232, 0.240),
)
_GROUT_RGB = (0.031, 0.032, 0.033)
_PLAZA_MAT0 = len(_STONE_RGB)
_GROUT_MAT = _PLAZA_MAT0 + len(_PLAZA_RGB)


def _cell_key(p: tuple[float, float]) -> tuple[int, int]:
    return (round(p[0] * 40.0), round(p[1] * 40.0))


def _u01(kx: int, ky: int, salt: int) -> float:
    n = (kx * 73856093) ^ (ky * 19349663) ^ (salt * 83492791)
    n = (n * 1103515245 + 12345) & 0x7FFFFFFF
    return float(n % 10007) / 10007.0


def _stone_bin(x: float, y: float, salt: int = 19) -> int:
    kx, ky = _cell_key((x, y))
    return int(_u01(kx, ky, salt) * len(_STONE_RGB)) % len(_STONE_RGB)


def _cell_bin(poly: list[tuple[float, float]]) -> int:
    n = len(poly)
    cx = sum(p[0] for p in poly) / n
    cy = sum(p[1] for p in poly) / n
    return _stone_bin(cx, cy, 19)


def _plaza_bin(poly: list[tuple[float, float]]) -> int:
    return _PLAZA_MAT0 + (_cell_bin(poly) % len(_PLAZA_RGB))


def bind_stone_materials(ob: bpy.types.Object) -> None:
    while ob.data.materials:
        ob.data.materials.pop(index=0)
    for i, rgb in enumerate(_STONE_RGB):
        ob.data.materials.append(matte_solid(f"Stone{i}", rgb, 0.94))
    for i, rgb in enumerate(_PLAZA_RGB):
        ob.data.materials.append(matte_solid(f"Plaza{i}", rgb, 0.94))
    ob.data.materials.append(matte_solid("Grout", _GROUT_RGB, 0.97))


def paint_mass(ob: bpy.types.Object) -> None:
    """Hull only. Plaza grout channels stacked a second coplanar layer and flickered."""
    me = ob.data
    skip_z = -1.0 * ISLAND_SCALE
    area_lim = 22.0 * ISLAND_SCALE * ISLAND_SCALE
    for poly in me.polygons:
        if poly.center.z > skip_z:
            continue
        if poly.material_index == _GROUT_MAT:
            continue
        n = poly.normal
        if n.z > 0.72 and poly.area < area_lim:
            poly.material_index = _GROUT_MAT


def _mark_face(face: bmesh.types.BMFace, mat_i: int) -> None:
    face.material_index = mat_i


def _tri(
    bm: bmesh.types.BMesh,
    a: bmesh.types.BMVert,
    b: bmesh.types.BMVert,
    c: bmesh.types.BMVert,
    mat_i: int,
) -> None:
    try:
        face = bm.faces.new((a, b, c))
        _mark_face(face, mat_i)
    except ValueError:
        pass


def _quad(
    bm: bmesh.types.BMesh,
    a: bmesh.types.BMVert,
    b: bmesh.types.BMVert,
    c: bmesh.types.BMVert,
    d: bmesh.types.BMVert,
    mat_i: int,
) -> None:
    try:
        face = bm.faces.new((a, b, c, d))
        _mark_face(face, mat_i)
    except ValueError:
        _tri(bm, a, b, c, mat_i)
        _tri(bm, a, c, d, mat_i)


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _square_corners(rim: list[tuple[float, float]], cx: float, cy: float) -> list[int]:
    del cx, cy
    if not rim:
        return []
    xs = [p[0] for p in rim]
    ys = [p[1] for p in rim]
    targets = (
        (max(xs), max(ys)),
        (min(xs), max(ys)),
        (min(xs), min(ys)),
        (max(xs), min(ys)),
    )
    out: list[int] = []
    for tx, ty in targets:
        best = 0
        best_d = 1.0e18
        for i, p in enumerate(rim):
            d = (p[0] - tx) * (p[0] - tx) + (p[1] - ty) * (p[1] - ty)
            if d < best_d:
                best_d = d
                best = i
        if best not in out:
            out.append(best)
    return out


def _outline_indices(n_rim: int, n: int, corners: list[int]) -> list[int]:
    idxs = [int(round(k * n_rim / float(n))) % n_rim for k in range(n)]
    for c in corners:
        best = 0
        best_d = n_rim
        for k, idx in enumerate(idxs):
            d = min((idx - c) % n_rim, (c - idx) % n_rim)
            if d < best_d:
                best_d = d
                best = k
        idxs[best] = c
    seen: set[int] = set()
    out: list[int] = []
    for idx in idxs:
        while idx in seen:
            idx = (idx + 1) % n_rim
        seen.add(idx)
        out.append(idx)
    return out


def _outline_loop(
    rim: list[tuple[float, float]],
    cx: float,
    cy: float,
    scale: float,
    z: float,
    n: int,
    salt: int,
    jut: float,
    z_spread: float,
    corners: list[int],
) -> list[tuple[float, float, float]]:
    idxs = _outline_indices(len(rim), n, corners)
    pts: list[tuple[float, float, float]] = []
    for i, idx in enumerate(idxs):
        p = rim[idx]
        dx, dy = p[0] - cx, p[1] - cy
        h = _u01(i, salt, 5)
        sc = scale * (1.0 + jut * (h - 0.22))
        z_i = z + (h - 0.5) * z_spread
        pts.append((cx + dx * sc, cy + dy * sc, z_i))
    return pts


def _loop_walls(
    bm: bmesh.types.BMesh,
    upper: list[bmesh.types.BMVert],
    lower: list[bmesh.types.BMVert],
    n_blocks: int,
    salt: int,
) -> None:
    n = min(len(upper), len(lower))
    if n < 4 or n % 2 != 0:
        return
    for i in range(n_blocks):
        a0 = 2 * i
        a1 = 2 * i + 1
        if a1 >= n:
            break
        mat_i = int(_u01(i, salt, 19) * len(_STONE_RGB)) % len(_STONE_RGB)
        _quad(bm, upper[a0], upper[a1], lower[a1], lower[a0], mat_i)
        b0 = a1
        b1 = (a1 + 1) % n
        join = (mat_i + 1 + (i % 2)) % len(_STONE_RGB)
        _quad(bm, upper[b0], upper[b1], lower[b1], lower[b0], join)


def _nearest_loop(
    p: tuple[float, float],
    loop: list[tuple[float, float]],
    cx: float,
    cy: float,
) -> int:
    ang = math.atan2(p[1] - cy, p[0] - cx)
    best = 0
    best_d = 1.0e18
    for i, q in enumerate(loop):
        a = math.atan2(q[1] - cy, q[0] - cx)
        d = abs((a - ang + math.pi) % math.tau - math.pi)
        if d < best_d:
            best_d = d
            best = i
    return best


def _bridge_loops(
    bm: bmesh.types.BMesh,
    upper: list[bmesh.types.BMVert],
    lower: list[bmesh.types.BMVert],
    salt: int,
) -> None:
    if len(upper) < 3 or len(lower) < 3:
        return
    uxy = [(v.co.x, v.co.y) for v in upper]
    lxy = [(v.co.x, v.co.y) for v in lower]
    cx = sum(p[0] for p in uxy) / len(uxy)
    cy = sum(p[1] for p in uxy) / len(uxy)
    n = len(upper)
    for i in range(n):
        j0 = _nearest_loop(uxy[i], lxy, cx, cy)
        j1 = _nearest_loop(uxy[(i + 1) % n], lxy, cx, cy)
        mat_i = int(_u01(i, salt, 19) * len(_STONE_RGB)) % len(_STONE_RGB)
        if j0 == j1:
            _tri(bm, upper[i], upper[(i + 1) % n], lower[j0], mat_i)
        else:
            _quad(bm, upper[i], upper[(i + 1) % n], lower[j1], lower[j0], mat_i)


def _mids_on_seg(
    bm: bmesh.types.BMesh,
    a: bmesh.types.BMVert,
    b: bmesh.types.BMVert,
    z_lo: float,
    z_hi: float,
) -> list[bmesh.types.BMVert]:
    ax, ay = a.co.x, a.co.y
    dx = b.co.x - ax
    dy = b.co.y - ay
    l2 = dx * dx + dy * dy
    if l2 < 1e-8:
        return []
    snap_d = 0.7 * ISLAND_SCALE
    found: list[tuple[float, bmesh.types.BMVert]] = []
    for v in bm.verts:
        if not v.is_valid or v is a or v is b:
            continue
        if v.co.z < z_lo or v.co.z > z_hi:
            continue
        t = ((v.co.x - ax) * dx + (v.co.y - ay) * dy) / l2
        if t <= 0.02 or t >= 0.98:
            continue
        qx = ax + t * dx
        qy = ay + t * dy
        if math.hypot(v.co.x - qx, v.co.y - qy) > snap_d:
            continue
        v.co.x = qx
        v.co.y = qy
        found.append((t, v))
    found.sort(key=lambda item: item[0])
    out: list[bmesh.types.BMVert] = []
    last_t = -1.0
    for t, v in found:
        if t - last_t < 0.015:
            continue
        out.append(v)
        last_t = t
    return out


def _loop_walls_split(
    bm: bmesh.types.BMesh,
    upper: list[bmesh.types.BMVert],
    lower: list[bmesh.types.BMVert],
    salt: int,
    vert_xyz,
) -> None:
    n = min(len(upper), len(lower))
    if n < 4:
        return
    for i in range(n):
        a = upper[i]
        b = upper[(i + 1) % n]
        la = lower[i]
        lb = lower[(i + 1) % n]
        mat_i = int(_u01(i, salt, 19) * len(_STONE_RGB)) % len(_STONE_RGB)
        mids = _mids_on_seg(bm, a, b, PLAZA_Z - 0.2 * ISLAND_SCALE, PLAZA_Z + 0.2 * ISLAND_SCALE)
        chain = [a] + mids + [b]
        ax, ay = a.co.x, a.co.y
        dx = b.co.x - ax
        dy = b.co.y - ay
        l2 = dx * dx + dy * dy
        ts = [0.0]
        for v in mids:
            ts.append(((v.co.x - ax) * dx + (v.co.y - ay) * dy) / l2 if l2 > 1e-12 else 0.0)
        ts.append(1.0)
        los: list[bmesh.types.BMVert] = []
        for t in ts:
            x = la.co.x + t * (lb.co.x - la.co.x)
            y = la.co.y + t * (lb.co.y - la.co.y)
            z = la.co.z + t * (lb.co.z - la.co.z)
            los.append(vert_xyz(x, y, z))
        for j in range(len(chain) - 1):
            _quad(bm, chain[j], chain[j + 1], los[j + 1], los[j], mat_i)


def _cap_down(bm: bmesh.types.BMesh, loop: list[bmesh.types.BMVert], mat_i: int) -> None:
    if len(loop) < 3:
        return
    try:
        face = bm.faces.new(list(reversed(loop)))
        _mark_face(face, mat_i)
    except ValueError:
        hub = bm.verts.new(
            (
                sum(v.co.x for v in loop) / float(len(loop)),
                sum(v.co.y for v in loop) / float(len(loop)),
                sum(v.co.z for v in loop) / float(len(loop)),
            )
        )
        n = len(loop)
        for i in range(n):
            _tri(bm, hub, loop[(i + 1) % n], loop[i], mat_i)


def _nearest_on_ring(
    p: tuple[float, float],
    ring: list[tuple[float, float]],
) -> tuple[float, float]:
    best_p = ring[0]
    best_e = 1.0e18
    n = len(ring)
    for i in range(n):
        a, b = ring[i], ring[(i + 1) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]
        length2 = dx * dx + dy * dy
        if length2 < 1e-12:
            continue
        t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2
        t = max(0.0, min(1.0, t))
        q = (a[0] + t * dx, a[1] + t * dy)
        d = math.hypot(p[0] - q[0], p[1] - q[1])
        if d < best_e:
            best_e = d
            best_p = q
    return best_p


def _orient_cliff_bm(bm: bmesh.types.BMesh) -> None:
    bm.normal_update()
    pts = [v.co for v in bm.verts]
    if not pts:
        return
    cx = sum(p.x for p in pts) / len(pts)
    cy = sum(p.y for p in pts) / len(pts)
    bottom = min(p.z for p in pts) + 12.6 * ISLAND_SCALE
    for f in bm.faces:
        if not f.is_valid:
            continue
        f.normal_update()
        n = f.normal
        c = f.calc_center_median()
        if c.z < bottom and abs(n.z) > 0.5:
            if n.z > 0.0:
                f.normal_flip()
            continue
        if abs(n.z) > 0.55:
            if c.z > -1.5 * ISLAND_SCALE:
                if n.z < 0.0:
                    f.normal_flip()
            elif n.z > 0.0:
                f.normal_flip()
            continue
        radial = Vector((c.x - cx, c.y - cy, 0.0))
        if radial.length > 1e-6 and n.dot(radial) < 0.0:
            f.normal_flip()
    bm.normal_update()


def _xy_span(ob: bpy.types.Object, label: str) -> None:
    pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
    if not pts:
        return
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    log(
        f"{label} xy {min(xs):.1f}..{max(xs):.1f} / {min(ys):.1f}..{max(ys):.1f} "
        f"z {min(zs):.1f}..{max(zs):.1f}"
    )


def build_mass(cells: list[list[tuple[float, float]]]) -> bpy.types.Object:
    """Voronoi mosaic on a polar underlay; chunky hull below. Canon 2026-09-05."""
    usable = [poly for poly in cells if len(poly) >= 3]
    if not usable:
        return mesh_from_bm(bmesh.new(), "Island")
    rim = boundary_loop(usable)
    if len(rim) < 8:
        rim = make_outline(HALF)
    npts = 0
    sx = 0.0
    sy = 0.0
    for poly in usable:
        for p in poly:
            sx += p[0]
            sy += p[1]
            npts += 1
    cx, cy = sx / float(npts), sy / float(npts)
    n_blocks = 16
    n_loop = n_blocks * 2
    corners = _square_corners(rim, cx, cy)
    idxs = _outline_indices(len(rim), n_loop, corners)
    ring_pts = _ensure_ccw([rim[i] for i in idxs])
    tiles: list[list[tuple[float, float]]] = []
    for poly in usable:
        tiles.extend(_clip_to_ring(poly, ring_pts, (cx, cy)))
    if tiles:
        usable = tiles
        log(f"plaza on ring {len(tiles)} faces")

    bm = bmesh.new()
    vmap: dict[tuple[object, ...], bmesh.types.BMVert] = {}

    def vert(p: tuple[float, float], li: int) -> bmesh.types.BMVert:
        kx, ky = _cell_key(p)
        mk = (kx, ky, li)
        found = vmap.get(mk)
        if found is not None:
            return found
        z = PLAZA_Z if li == 0 else PLAZA_Z - 2.4 * ISLAND_SCALE
        nv = bm.verts.new((p[0], p[1], z))
        vmap[mk] = nv
        return nv

    up0 = [vert(p, 0) for p in ring_pts]
    n_ring = len(up0)
    rings: list[list[bmesh.types.BMVert]] = [[vert(p, 2) for p in ring_pts]]
    for step in range(8, 0, -1):
        t = step / 9.0
        layer = [
            vert((cx + (p[0] - cx) * t, cy + (p[1] - cy) * t), 2) for p in ring_pts
        ]
        rings.append(layer)
    hub = vert((cx, cy), 2)
    for ra, rb in zip(rings, rings[1:]):
        for i in range(n_ring):
            _quad(bm, ra[i], ra[(i + 1) % n_ring], rb[(i + 1) % n_ring], rb[i], 0)
    inner = rings[-1]
    for i in range(n_ring):
        _tri(bm, hub, inner[i], inner[(i + 1) % n_ring], 0)
    for f in bm.faces:
        if not f.is_valid:
            continue
        c = f.calc_center_median()
        bin_i = _stone_bin(c.x, c.y)
        for poly in usable:
            if _pip((c.x, c.y), poly):
                bin_i = _plaza_bin(poly)
                break
        else:
            bin_i = _PLAZA_MAT0 + (bin_i % len(_PLAZA_RGB))
        _mark_face(f, bin_i)
        f.normal_update()
        if f.normal.z < 0.0:
            f.normal_flip()

    def poly_verts(poly: list[tuple[float, float]]) -> list[bmesh.types.BMVert]:
        raw = [vert(p, 0) for p in _ensure_ccw(_dedupe_poly(poly))]
        out: list[bmesh.types.BMVert] = []
        for v in raw:
            if not out or out[-1] is not v:
                out.append(v)
        if len(out) >= 2 and out[0] is out[-1]:
            out.pop()
        return out

    n_tiles = 0
    for poly in usable:
        vs = poly_verts(poly)
        if len(vs) < 3:
            continue
        stone = _plaza_bin(poly)
        try:
            top = bm.faces.new(vs)
            _mark_face(top, stone)
            n_tiles += 1
        except ValueError:
            hx = sum(v.co.x for v in vs) / float(len(vs))
            hy = sum(v.co.y for v in vs) / float(len(vs))
            h = vert((hx, hy), 0)
            before = len(bm.faces)
            for i, tv in enumerate(vs):
                _tri(bm, h, tv, vs[(i + 1) % len(vs)], stone)
            if len(bm.faces) > before:
                n_tiles += 1
    plaza_vs = [v for v in bm.verts if v.is_valid and abs(v.co.z - PLAZA_Z) < 0.2]
    if plaza_vs:
        bmesh.ops.remove_doubles(bm, verts=plaza_vs, dist=2.8 * ISLAND_SCALE)
    tile_fs = [
        f
        for f in bm.faces
        if f.is_valid and f.calc_center_median().z > PLAZA_Z - 0.5
    ]
    if tile_fs:
        bmesh.ops.triangulate(bm, faces=tile_fs)
    bm.edges.ensure_lookup_table()
    seen_e: set[int] = set()
    hole_loops: list[list[bmesh.types.BMVert]] = []
    for e0 in bm.edges:
        if not e0.is_valid or not e0.is_boundary or id(e0) in seen_e:
            continue
        vs_loop: list[bmesh.types.BMVert] = []
        cur = e0
        v = e0.verts[0]
        for _ in range(4096):
            seen_e.add(id(cur))
            vs_loop.append(v)
            v = cur.other_vert(v)
            nxt = None
            for e2 in v.link_edges:
                if e2 is not cur and e2.is_boundary:
                    nxt = e2
                    break
            if nxt is None or nxt is e0:
                break
            cur = nxt
        if len(vs_loop) >= 3:
            hole_loops.append(vs_loop)
    n_holes = 0
    if len(hole_loops) > 1:
        hole_loops.sort(key=len, reverse=True)
        for vs_loop in hole_loops[1:]:
            try:
                gf = bm.faces.new(vs_loop)
                cx0 = sum(v.co.x for v in vs_loop) / float(len(vs_loop))
                cy0 = sum(v.co.y for v in vs_loop) / float(len(vs_loop))
                _mark_face(gf, _PLAZA_MAT0 + (_stone_bin(cx0, cy0) % len(_PLAZA_RGB)))
                n_holes += 1
            except ValueError:
                pass
    if sum(1 for f in bm.faces if f.is_valid) < 8:
        hub0 = vert((cx, cy), 0)
        for i in range(n_ring):
            _tri(
                bm,
                hub0,
                up0[i],
                up0[(i + 1) % n_ring],
                _PLAZA_MAT0 + (_stone_bin(up0[i].co.x, up0[i].co.y) % len(_PLAZA_RGB)),
            )
    up0 = [vert(p, 0) for p in ring_pts]
    for f in bm.faces:
        if not f.is_valid:
            continue
        f.normal_update()
        if f.calc_center_median().z > -0.2 * ISLAND_SCALE and f.normal.z < 0.0:
            f.normal_flip()
    log(f"plaza tiles {n_tiles} holes {n_holes} faces {sum(1 for f in bm.faces if f.is_valid)}")

    n_rim = len(rim)
    z_hi = PLAZA_Z
    z_lo = -248.0 * ISLAND_SCALE
    belts = (
        (0.99, 0.42, 0.12, 1),
        (0.80, 0.64, 0.18, 2),
        (0.64, 0.84, 0.14, 3),
        (0.48, 1.00, 0.12, 4),
    )

    def vert_xyz(x: float, y: float, z: float) -> bmesh.types.BMVert:
        mk = ("h", round(x * 8.0), round(y * 8.0), round(z * 2.0))
        found = vmap.get(mk)
        if found is not None:
            return found
        nv = bm.verts.new((x, y, z))
        vmap[mk] = nv
        return nv

    def loop_verts(pts: list[tuple[float, float, float]]) -> list[bmesh.types.BMVert]:
        return [vert_xyz(p[0], p[1], p[2]) for p in pts]

    z_foot0 = _lerp(z_hi, z_lo, 0.22)
    vf0 = [vert_xyz(p[0], p[1], z_foot0) for p in ring_pts]
    _loop_walls_split(bm, up0, vf0, 20, vert_xyz)
    prev = vf0
    prev_z = z_foot0
    for ti, (scale, t1, jut, salt) in enumerate(belts):
        z1 = _lerp(z_hi, z_lo, t1)
        crown = _outline_loop(rim, cx, cy, scale, prev_z, n_loop, 20 + salt, jut, 0.0, corners)
        vc = loop_verts(crown)
        _bridge_loops(bm, prev, vc, 70 + salt)
        foot = _outline_loop(
            rim,
            cx,
            cy,
            scale * 0.97,
            z1,
            n_loop,
            40 + salt,
            jut * 0.85,
            8.0 * ISLAND_SCALE,
            corners,
        )
        vf = loop_verts(foot)
        _loop_walls(bm, vc, vf, n_blocks, 20 + salt)
        prev = vf
        prev_z = z1
        del ti
    _cap_down(bm, prev, 1)
    _orient_cliff_bm(bm)
    for f in bm.faces:
        if not f.is_valid:
            continue
        f.normal_update()
        c = f.calc_center_median()
        if c.z > -0.2 * ISLAND_SCALE and f.normal.z < 0.0:
            f.normal_flip()
    ob = mesh_from_bm(bm, "Island")
    bind_stone_materials(ob)
    paint_mass(ob)
    active(ob)
    bpy.ops.object.shade_flat()
    _xy_span(ob, "island")
    log(f"island faces {len(ob.data.polygons)} stones {len(usable)} rim {n_rim} blocks {n_blocks}")
    return ob


'''

MAIN = r'''
def main() -> None:
    rng = random.Random(SEED)
    reset_scene()
    col = new_col("Island")

    sites = poisson_sites(HALF, rng)
    ghosts = make_ghosts(HALF, rng)
    cells = voronoi_cells(sites, ghosts)
    log(f"voronoi sites {len(sites)} cells {len(cells)} ghosts {len(ghosts)}")
    mass = build_mass(cells)

    on_disk = {n for n in os.listdir(MODELS) if n.lower().endswith(".glb")}
    planned = {row[1] for row in PLANTS}
    if on_disk != planned:
        raise RuntimeError(f"models mismatch extra={on_disk - planned} missing={planned - on_disk}")

    def plant(
        name: str,
        file: str,
        x: float,
        y: float,
        height: float | None,
        span: float | None,
    ) -> bpy.types.Object:
        ob = import_glb(os.path.join(MODELS, file), name)
        yaw = 0.0 if (x == 0.0 and y == 0.0) else math.atan2(x, y)
        place_on_plaza(ob, _ixy(x, y), yaw, target_height=height, target_span=span)
        return ob

    buildings = [plant(*row) for row in PLANTS]
    island = (mass,)
    for ob in island:
        active(ob)
        bpy.ops.object.shade_flat()
        if ob.name in bpy.context.scene.collection.objects and ob.name not in col.objects:
            bpy.context.scene.collection.objects.unlink(ob)
        if ob.name not in col.objects:
            col.objects.link(ob)
    for ob in buildings:
        if ob.name in bpy.context.scene.collection.objects and ob.name not in col.objects:
            bpy.context.scene.collection.objects.unlink(ob)
        if ob.name not in col.objects:
            col.objects.link(ob)

    yaw_objects(list(island) + list(buildings), math.radians(45.0))
    setup_world()
    setup_lights()
    enable_cycles()
    sc = ISLAND_SCALE / 5.0
    orbit = cam("CamOrbit", (560.0 * sc, -700.0 * sc, 240.0 * sc), (0.0, 0.0, -35.0 * sc), 42.0)
    under = cam("CamUnder", (920.0 * sc, -1020.0 * sc, 50.0 * sc), (0.0, 0.0, -150.0 * sc), 42.0)

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    render_cam(orbit, OUT_PREVIEW)
    render_cam(under, OUT_UNDER)
    export_glb(col)
    log(f"done mosaic tiles planted {len(buildings)}")


if __name__ == "__main__":
    main()
'''


def plants_block(cur: str) -> str:
    m = re.search(
        r"PLANTS: tuple\[tuple\[str, str, float, float, float \| None, float \| None], \.\.\.\] = \((.*?)\)\n\n",
        cur,
        re.S,
    )
    if not m:
        raise SystemExit("PLANTS missing in current builder")
    return (
        "MODELS = os.path.join(REPO, \"models\")\n"
        "PLANTS: tuple[tuple[str, str, float, float, float | None, float | None], ...] = ("
        + m.group(1)
        + ")\n\n"
    )


def main() -> None:
    applied = APPLIED.read_text(encoding="utf-8")
    current = CURRENT.read_text(encoding="utf-8")
    head, _rest = applied.split("def build_plaza(", 1)
    _pre, tail = applied.split("def setup_world() -> None:", 1)
    head = head.replace("from mathutils.geometry import delaunay_2d_cdt\n", "")
    head = head.replace("SRC = os.path.join(ROOT, \"source\")\n", "")
    head = head.replace("ISLAND_SCALE = 5.0", "ISLAND_SCALE = 10.0")
    if "REPO =" not in head:
        head = head.replace(
            "ROOT = os.path.dirname(os.path.abspath(__file__))\n",
            "ROOT = os.path.dirname(os.path.abspath(__file__))\n"
            "REPO = os.path.dirname(os.path.dirname(ROOT))\n",
        )
    # Drop leftover plant constants if PLANTS is appended after BANK_SPAN.
    head = re.sub(
        r"\ndef log\(msg: str\) -> None:",
        "\n" + plants_block(current) + "def log(msg: str) -> None:",
        head,
        count=1,
    )
    head = head.replace("thresh: float = 8.0", "thresh: float | None = None")
    old_snap_body = '''    """Weld clip hits onto the plaza ring so tiles share the outer loop."""
    best_v = p
    best_d = thresh'''
    new_snap_body = '''    """Weld clip hits onto the plaza ring so tiles share the outer loop."""
    if thresh is None:
        thresh = 2.4 * ISLAND_SCALE
    best_v = p
    best_d = thresh'''
    if old_snap_body not in head:
        raise SystemExit("snap docstring missing")
    head = head.replace(old_snap_body, new_snap_body, 1)
    head = head.replace(
        "if len(part) >= 3 and abs(_signed_area(part)) > 0.001:",
        "if len(part) >= 3 and abs(_signed_area(part)) > 1.0 * ISLAND_SCALE * ISLAND_SCALE:",
    )
    # Drop unused paint_faces to keep file smaller? leave it.
    text = head + MASS + "def setup_world() -> None:" + tail
    text = re.sub(r"def main\(\) -> None:.*", MAIN.strip() + "\n", text, count=1, flags=re.S)
    ast.parse(text)
    OUT.write_text(text, encoding="utf-8", newline="\n")
    print("wrote", OUT, "lines", text.count("\n") + 1)
    for key in (
        "def build_mass",
        "PLAZA_Z - 2.4 * ISLAND_SCALE",
        "plaza tiles",
        "ISLAND_SCALE = 10.0",
        "bank_building_qu_0906034155",
        "plaza grid",
    ):
        print(" ", key, key in text)


if __name__ == "__main__":
    main()
