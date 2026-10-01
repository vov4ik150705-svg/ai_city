"""Floating island matching the empty-island mockup.

One mass: Voronoi stones go through the volume. Thick torn slab, no needle.
"""

from __future__ import annotations

import math
import os
import random

import bmesh
import bpy
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt
from mathutils.geometry import delaunay_2d_cdt

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_BLEND = os.path.join(ROOT, "island.blend")
OUT_GLB = os.path.join(ROOT, "island.glb")
OUT_PREVIEW = os.path.join(ROOT, "preview_orbit.png")
OUT_UNDER = os.path.join(ROOT, "preview_under.png")
SRC = os.path.join(ROOT, "source")
PLAZA_Z = 0.06
# Island mass (plaza + hull) is canonical 2026-09-05:
# art/island_v3/snapshots/canon_2026-09-05_island/
# Do not change SEED / HALF / MIN_CELL / build_mass without owner.
ISLAND_SCALE = 5.0
BUILDING_SCALE = 4.0
# Hall is the skyline. District toys share one ground span; Microsoft is a
# skinny tower so it scales by height, not footprint.
HALL_HEIGHT = 280.0 * BUILDING_SCALE
MSFT_HEIGHT = 230.0 * BUILDING_SCALE
DISTRICT_SPAN = 140.0 * BUILDING_SCALE
YARD_SPAN = 170.0 * BUILDING_SCALE
ARCH_SPAN = 160.0 * BUILDING_SCALE
BANK_SPAN = 130.0 * BUILDING_SCALE

SEED = 64018
# Plaza half-extent. Stones and hull meters follow ISLAND_SCALE.
HALF = 360.0 * ISLAND_SCALE
N_SITES = 144
MIN_CELL = 38.4 * ISLAND_SCALE
RIM_PER_SIDE = 12
FENCE_PER_SIDE = 28

# Mild perimeter bites — silhouette, not missing tiles.
# (side, t_center, width, depth_m). side 0=+Y 1=+X 2=-Y 3=-X.
NOTCHES_RECT = (
    (0, 0.26, 0.08, 22.0 * ISLAND_SCALE),
    (0, 0.64, 0.07, 18.0 * ISLAND_SCALE),
    (1, 0.30, 0.08, 20.0 * ISLAND_SCALE),
    (1, 0.70, 0.07, 18.0 * ISLAND_SCALE),
    (2, 0.28, 0.08, 24.0 * ISLAND_SCALE),
    (2, 0.66, 0.07, 19.0 * ISLAND_SCALE),
    (3, 0.34, 0.08, 20.0 * ISLAND_SCALE),
    (3, 0.72, 0.07, 17.0 * ISLAND_SCALE),
)


def log(msg: str) -> None:
    print(msg, flush=True)


def _ixy(x: float, y: float) -> tuple[float, float]:
    return (x * ISLAND_SCALE, y * ISLAND_SCALE)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"


def new_col(name: str) -> bpy.types.Collection:
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def _side_point(side: int, t: float, half: float) -> tuple[float, float]:
    if side == 0:
        return (-half + 2.0 * half * t, half)
    if side == 1:
        return (half, half - 2.0 * half * t)
    if side == 2:
        return (half - 2.0 * half * t, -half)
    return (-half, -half + 2.0 * half * t)


def _notch_depth(side: int, t: float) -> float:
    for s, tc, width, depth in NOTCHES_RECT:
        if s != side:
            continue
        if abs(t - tc) < width * 0.5 - 1e-6:
            return depth
    return 0.0


def make_outline(half: float) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    n_side = 20
    for side in range(4):
        splits = {i / n_side for i in range(n_side)}
        splits.add(0.0)
        for s, tc, width, _depth in NOTCHES_RECT:
            if s != side:
                continue
            t0 = max(0.0, tc - width * 0.5)
            t1 = min(1.0, tc + width * 0.5)
            splits.add(t0)
            splits.add(min(1.0, t0 + 0.002))
            splits.add(max(0.0, t1 - 0.002))
            splits.add(t1)
        ts = sorted(t for t in splits if t < 1.0 - 1e-9)
        for t in ts:
            x, y = _side_point(side, t, half)
            d = _notch_depth(side, t)
            if side == 0:
                y -= d
            elif side == 1:
                x -= d
            elif side == 2:
                y += d
            else:
                x += d
            pts.append((x, y))
    return pts


def mesh_from_bm(bm: bmesh.types.BMesh, name: str) -> bpy.types.Object:
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def active(ob: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def _world_bounds(ob: bpy.types.Object) -> tuple[Vector, Vector]:
    bpy.context.view_layer.update()
    pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def import_glb(path: str, name: str) -> bpy.types.Object:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"no mesh in {path}")
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    assert ob is not None
    ob.name = name
    for o in new:
        if o != ob and o.name in bpy.data.objects:
            bpy.data.objects.remove(o, do_unlink=True)
    log(f"imported {name} verts {len(ob.data.vertices)}")
    return ob


def place_on_plaza(
    ob: bpy.types.Object,
    xy: tuple[float, float],
    yaw: float,
    *,
    target_height: float | None = None,
    target_span: float | None = None,
) -> None:
    lo, hi = _world_bounds(ob)
    height = hi.z - lo.z
    span = max(hi.x - lo.x, hi.y - lo.y)
    if target_height is not None:
        s = target_height / max(height, 1e-6)
    elif target_span is not None:
        s = target_span / max(span, 1e-6)
    else:
        s = 1.0
    ob.scale = (s, s, s)
    ob.rotation_euler.z = yaw
    bpy.context.view_layer.update()
    lo, hi = _world_bounds(ob)
    cx = 0.5 * (lo.x + hi.x)
    cy = 0.5 * (lo.y + hi.y)
    ob.location.x += xy[0] - cx
    ob.location.y += xy[1] - cy
    ob.location.z += PLAZA_Z - lo.z
    bpy.context.view_layer.update()
    lo, hi = _world_bounds(ob)
    log(
        f"{ob.name} xy {lo.x:.1f}..{hi.x:.1f} / {lo.y:.1f}..{hi.y:.1f} "
        f"z {lo.z:.1f}..{hi.z:.1f}"
    )


def matte_solid(name: str, rgb: tuple[float, float, float], rough: float = 0.94) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.blend_method = "OPAQUE"
    tree = mat.node_tree
    assert tree is not None
    prin = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
    prin.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
    if "Alpha" in prin.inputs:
        prin.inputs["Alpha"].default_value = 1.0
    if "Transmission Weight" in prin.inputs:
        prin.inputs["Transmission Weight"].default_value = 0.0
    mat.use_backface_culling = False
    if "Metallic" in prin.inputs:
        prin.inputs["Metallic"].default_value = 0.0
    if "Roughness" in prin.inputs:
        prin.inputs["Roughness"].default_value = rough
    if "Specular IOR Level" in prin.inputs:
        prin.inputs["Specular IOR Level"].default_value = 0.08
    if "Emission Strength" in prin.inputs:
        prin.inputs["Emission Strength"].default_value = 0.0
    return mat


def paint_faces(
    ob: bpy.types.Object,
    rng: random.Random,
    lo: float,
    hi: float,
    by_normal: bool,
) -> None:
    me = ob.data
    col = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
    me.color_attributes.active_color = col
    for poly in me.polygons:
        if by_normal:
            lift = 0.46 * (poly.normal.z + 1.0)
            shade = lo + (hi - lo) * lift + rng.uniform(-0.012, 0.014)
        else:
            shade = rng.uniform(lo, hi)
        shade = max(0.034, min(0.078, shade))
        rgba = (shade * 0.98, shade, shade * 1.03, 1.0)
        for li in poly.loop_indices:
            col.data[li].color = rgba


def _signed_area(poly: list[tuple[float, float]]) -> float:
    acc = 0.0
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        acc += x1 * y2 - x2 * y1
    return 0.5 * acc


def _ensure_ccw(poly: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if _signed_area(poly) < 0.0:
        return list(reversed(poly))
    return list(poly)


def _left_of(
    a: tuple[float, float],
    b: tuple[float, float],
    p: tuple[float, float],
) -> bool:
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-7


def _seg_hit(
    a: tuple[float, float],
    b: tuple[float, float],
    p: tuple[float, float],
    q: tuple[float, float],
) -> tuple[float, float]:
    dx, dy = q[0] - p[0], q[1] - p[1]
    ex, ey = b[0] - a[0], b[1] - a[1]
    den = dx * ey - dy * ex
    if abs(den) < 1e-12:
        return q
    t = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / den
    t = max(0.0, min(1.0, t))
    return (p[0] + t * dx, p[1] + t * dy)


def _sutherland(
    subject: list[tuple[float, float]],
    clip: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    """Clip convex subject against convex CCW clip polygon."""
    out = list(subject)
    n_c = len(clip)
    for i in range(n_c):
        a, b = clip[i], clip[(i + 1) % n_c]
        inp = out
        out = []
        if len(inp) < 2:
            break
        prev = inp[-1]
        prev_in = _left_of(a, b, prev)
        for cur in inp:
            cur_in = _left_of(a, b, cur)
            if cur_in:
                if not prev_in:
                    out.append(_seg_hit(a, b, prev, cur))
                out.append(cur)
            elif prev_in:
                out.append(_seg_hit(a, b, prev, cur))
            prev, prev_in = cur, cur_in
    return out


def _pip(p: tuple[float, float], ring: list[tuple[float, float]]) -> bool:
    """Winding test. Boundary counts as inside."""
    w = 0
    n = len(ring)
    for i in range(n):
        x1 = ring[i][0] - p[0]
        y1 = ring[i][1] - p[1]
        x2 = ring[(i + 1) % n][0] - p[0]
        y2 = ring[(i + 1) % n][1] - p[1]
        cr = x1 * y2 - x2 * y1
        if y1 <= 0.0:
            if y2 > 0.0 and cr > 0.0:
                w += 1
        elif y2 <= 0.0 and cr < 0.0:
            w -= 1
    return w != 0


def _dedupe_poly(poly: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for p in poly:
        if out:
            ox, oy = out[-1]
            if (p[0] - ox) * (p[0] - ox) + (p[1] - oy) * (p[1] - oy) < 1e-8:
                continue
        out.append(p)
    if len(out) >= 2:
        ax, ay = out[0]
        bx, by = out[-1]
        if (ax - bx) * (ax - bx) + (ay - by) * (ay - by) < 1e-8:
            out.pop()
    return out


def _convex_hull(pts: list[tuple[float, float]]) -> list[tuple[float, float]]:
    raw = sorted(pts, key=lambda p: (p[0], p[1]))
    uniq: list[tuple[float, float]] = []
    for p in raw:
        if not uniq or math.hypot(p[0] - uniq[-1][0], p[1] - uniq[-1][1]) > 1e-6:
            uniq.append(p)
    if len(uniq) <= 2:
        return list(pts)

    def cross(
        o: tuple[float, float], a: tuple[float, float], b: tuple[float, float]
    ) -> float:
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower: list[tuple[float, float]] = []
    for p in uniq:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0.0:
            lower.pop()
        lower.append(p)
    upper: list[tuple[float, float]] = []
    for p in reversed(uniq):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0.0:
            upper.pop()
        upper.append(p)
    hull = lower[:-1] + upper[:-1]
    return hull if len(hull) >= 3 else list(pts)


def _resample_closed(poly: list[tuple[float, float]], n: int) -> list[tuple[float, float]]:
    pts = _ensure_ccw(_dedupe_poly(poly))
    if len(pts) < 3 or n < 3:
        return pts
    lengths: list[float] = []
    total = 0.0
    m = len(pts)
    for i in range(m):
        a, b = pts[i], pts[(i + 1) % m]
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        lengths.append(d)
        total += d
    if total < 1e-6:
        return pts
    out: list[tuple[float, float]] = []
    for k in range(n):
        target = (float(k) / float(n)) * total
        acc = 0.0
        chosen = pts[0]
        for i, d in enumerate(lengths):
            nxt = acc + d
            if nxt >= target or i == m - 1:
                t = 0.0 if d < 1e-12 else (target - acc) / d
                t = max(0.0, min(1.0, t))
                a, b = pts[i], pts[(i + 1) % m]
                chosen = (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
                break
            acc = nxt
        out.append(chosen)
    return out


def _snap_to_ring(
    p: tuple[float, float],
    ring: list[tuple[float, float]],
    thresh: float = 8.0,
) -> tuple[float, float]:
    """Weld clip hits onto the plaza ring so tiles share the outer loop."""
    best_v = p
    best_d = thresh
    for q in ring:
        d = math.hypot(p[0] - q[0], p[1] - q[1])
        if d < best_d:
            best_d = d
            best_v = q
    if best_d < 0.9:
        return best_v
    best_p = p
    best_e = thresh
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
    if best_e >= thresh:
        return p
    for q in ring:
        if math.hypot(best_p[0] - q[0], best_p[1] - q[1]) < 0.9 * ISLAND_SCALE:
            return q
    return best_p


def _snap_poly_to_ring(
    poly: list[tuple[float, float]],
    ring: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    return [_snap_to_ring(p, ring) for p in poly]


def _clip_to_ring(
    cell: list[tuple[float, float]],
    ring: list[tuple[float, float]],
    origin: tuple[float, float],
) -> list[list[tuple[float, float]]]:
    """Cut a Voronoi cell to the top-ring outline. Clip window must be convex."""
    del origin
    if len(cell) < 3 or len(ring) < 3:
        return []
    clip = _ensure_ccw(list(ring))
    if all(_pip(p, clip) for p in cell):
        return [_snap_poly_to_ring(cell, clip)]
    part = _dedupe_poly(_sutherland(cell, clip))
    if len(part) >= 3 and abs(_signed_area(part)) > 0.001:
        return [_snap_poly_to_ring(part, clip)]
    return []


def clip_closer(
    poly: list[tuple[float, float]],
    site: tuple[float, float],
    other: tuple[float, float],
) -> list[tuple[float, float]]:
    if not poly:
        return []
    ax, ay = site
    ox, oy = other
    nx, ny = ox - ax, oy - ay
    rhs = (ox * ox + oy * oy) - (ax * ax + ay * ay)

    def inside_pt(p: tuple[float, float]) -> bool:
        return 2.0 * (p[0] * nx + p[1] * ny) <= rhs + 1e-7

    def hit(p: tuple[float, float], q: tuple[float, float]) -> tuple[float, float]:
        dx, dy = q[0] - p[0], q[1] - p[1]
        a = 2.0 * (p[0] * nx + p[1] * ny) - rhs
        b = 2.0 * (dx * nx + dy * ny)
        t = 0.0 if abs(b) < 1e-12 else max(0.0, min(1.0, -a / b))
        return (p[0] + t * dx, p[1] + t * dy)

    out: list[tuple[float, float]] = []
    prev = poly[-1]
    prev_in = inside_pt(prev)
    for cur in poly:
        cur_in = inside_pt(cur)
        if cur_in:
            if not prev_in:
                out.append(hit(prev, cur))
            out.append(cur)
        elif prev_in:
            out.append(hit(prev, cur))
        prev, prev_in = cur, cur_in
    return out


def poisson_sites(half: float, rng: random.Random) -> list[tuple[float, float]]:
    sites: list[tuple[float, float]] = []
    min2 = MIN_CELL * MIN_CELL
    tries = 0
    pad = 4.8 * ISLAND_SCALE
    while len(sites) < N_SITES and tries < N_SITES * 80:
        tries += 1
        x = rng.uniform(-half + pad, half - pad)
        y = rng.uniform(-half + pad, half - pad)
        if any((x - sx) ** 2 + (y - sy) ** 2 < min2 for sx, sy in sites):
            continue
        sites.append((x, y))
    rim_min2 = (MIN_CELL * 0.72) ** 2
    for side in range(4):
        for i in range(RIM_PER_SIDE):
            t = (i + 0.5) / float(RIM_PER_SIDE)
            inset = 14.4 * ISLAND_SCALE + _notch_depth(side, t) * 0.6
            x, y = _side_point(side, t, half - inset + rng.uniform(-3.0 * ISLAND_SCALE, 3.0 * ISLAND_SCALE))
            if any((x - sx) ** 2 + (y - sy) ** 2 < rim_min2 for sx, sy in sites):
                continue
            sites.append((x, y))
    return sites


def make_ghosts(half: float, rng: random.Random) -> list[tuple[float, float]]:
    """Fence only. Interior notch ghosts steal cells and leave black bites."""
    ghosts: list[tuple[float, float]] = []
    n_fence = FENCE_PER_SIDE
    for side in range(4):
        for i in range(n_fence):
            t = (i + 0.5) / n_fence
            dist = half + 19.2 * ISLAND_SCALE
            d = _notch_depth(side, t)
            if d > 0.0:
                dist = half + 2.0 * ISLAND_SCALE
            x, y = _side_point(side, t, dist + rng.uniform(-1.8 * ISLAND_SCALE, 1.8 * ISLAND_SCALE))
            ghosts.append((x, y))
    for sx, sy in ((1.0, 1.0), (1.0, -1.0), (-1.0, 1.0), (-1.0, -1.0)):
        ghosts.append((sx * (half + 21.6 * ISLAND_SCALE), sy * (half + 21.6 * ISLAND_SCALE)))
        ghosts.append((sx * (half + 3.6 * ISLAND_SCALE), sy * (half + 28.8 * ISLAND_SCALE)))
        ghosts.append((sx * (half + 28.8 * ISLAND_SCALE), sy * (half + 3.6 * ISLAND_SCALE)))
    return ghosts


def voronoi_cells(
    sites: list[tuple[float, float]],
    ghosts: list[tuple[float, float]],
) -> list[list[tuple[float, float]]]:
    all_pts = sites + ghosts
    h = HALF + 144.0 * ISLAND_SCALE
    box = [(-h, -h), (h, -h), (h, h), (-h, h)]
    cells: list[list[tuple[float, float]]] = []
    for site in sites:
        poly = box
        sx, sy = site
        for ox, oy in all_pts:
            if (ox - sx) ** 2 + (oy - sy) ** 2 < 1e-10:
                continue
            poly = clip_closer(poly, site, (ox, oy))
            if len(poly) < 3:
                break
        if len(poly) >= 3:
            cells.append(poly)
    return cells


def boundary_loop(cells: list[list[tuple[float, float]]]) -> list[tuple[float, float]]:
    def key(p: tuple[float, float]) -> tuple[int, int]:
        return (round(p[0] * 200.0), round(p[1] * 200.0))

    und: dict[tuple[tuple[int, int], tuple[int, int]], int] = {}
    directed: list[tuple[tuple[int, int], tuple[int, int], tuple[float, float]]] = []
    for poly in cells:
        m = len(poly)
        for i in range(m):
            a, b = poly[i], poly[(i + 1) % m]
            ka, kb = key(a), key(b)
            if ka == kb:
                continue
            ek = (ka, kb) if ka < kb else (kb, ka)
            und[ek] = und.get(ek, 0) + 1
            directed.append((ka, kb, a))
    adj: dict[tuple[int, int], list[tuple[int, int]]] = {}
    pos: dict[tuple[int, int], tuple[float, float]] = {}
    for ka, kb, a in directed:
        ek = (ka, kb) if ka < kb else (kb, ka)
        if und.get(ek, 0) != 1:
            continue
        adj.setdefault(ka, []).append(kb)
        pos[ka] = a
    if not adj:
        return []
    start = max(adj.keys(), key=lambda k: pos[k][0] * pos[k][0] + pos[k][1] * pos[k][1])
    loop = [start]
    prev: tuple[int, int] | None = None
    cur = start
    for _ in range(len(adj) + 4):
        nxts = adj.get(cur, [])
        nxt = None
        for cand in nxts:
            if cand != prev:
                nxt = cand
                break
        if nxt is None:
            break
        if nxt == start:
            break
        loop.append(nxt)
        prev, cur = cur, nxt
    pts = [pos[k] for k in loop if k in pos]
    log(f"boundary loop {len(pts)}")
    return pts


def build_plaza(
    cells: list[list[tuple[float, float]]],
    rng: random.Random,
) -> bpy.types.Object:
    bm = bmesh.new()
    built = 0
    for poly in cells:
        if len(poly) < 3:
            continue
        verts = [bm.verts.new((p[0], p[1], 0.06)) for p in poly]
        try:
            bm.faces.new(verts)
            built += 1
        except ValueError:
            continue
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    chamfer = []
    for f in bm.faces:
        if f.normal.z < 0.75:
            continue
        if f.calc_area() < 216.0:
            continue
        vs = list(f.verts)
        n = len(vs)
        if n < 3:
            continue
        min_e = min((vs[i].co - vs[(i + 1) % n].co).length for i in range(n))
        if min_e > 2.7:
            chamfer.append(f)
    if chamfer:
        bmesh.ops.inset_individual(
            bm,
            faces=chamfer,
            thickness=1.26,
            depth=0.0,
            use_even_offset=True,
        )
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=-0.60)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        c = f.calc_center_median()
        if c.z > 0.0 and f.normal.z < 0.0:
            f.normal_flip()
        if c.z < -0.02 and f.normal.z > 0.0:
            f.normal_flip()
    ob = mesh_from_bm(bm, "Plaza")
    log(f"plaza faces {len(ob.data.polygons)} cells {built}")
    return ob


def paint_plaza(ob: bpy.types.Object, rng: random.Random) -> None:
    me = ob.data
    col = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
    me.color_attributes.active_color = col
    for poly in me.polygons:
        n = poly.normal
        shade = rng.uniform(0.036, 0.072)
        if abs(n.z) < 0.55:
            shade = rng.uniform(0.042, 0.068)
        rgba = (shade * 0.97, shade, shade * 1.04, 1.0)
        for li in poly.loop_indices:
            col.data[li].color = rgba


def build_grout(cells: list[list[tuple[float, float]]]) -> bpy.types.Object:
    """Floor under grout gaps so inset channels never show the void."""
    bm = bmesh.new()
    for poly in cells:
        if len(poly) < 3:
            continue
        verts = [bm.verts.new((p[0], p[1], 0.01)) for p in poly]
        try:
            bm.faces.new(verts)
        except ValueError:
            continue
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0.0:
            f.normal_flip()
    ob = mesh_from_bm(bm, "Grout")
    for poly in ob.data.polygons:
        if poly.normal.z < 0.0:
            poly.flip()
    ob.data.update()
    return ob


def build_seal(border: list[tuple[float, float]]) -> bpy.types.Object:
    """Rock floor under tiles so the open cliff never reads as a hole."""
    bm = bmesh.new()
    if len(border) < 3:
        return mesh_from_bm(bm, "Seal")
    cx = sum(p[0] for p in border) / len(border)
    cy = sum(p[1] for p in border) / len(border)
    z = -0.04
    hub = bm.verts.new((cx, cy, z))
    rim = [bm.verts.new((p[0], p[1], z)) for p in border]
    for i in range(len(rim)):
        bm.faces.new((hub, rim[(i + 1) % len(rim)], rim[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0.0:
            f.normal_flip()
    ob = mesh_from_bm(bm, "Seal")
    active(ob)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return ob


def _force_up(ob: bpy.types.Object) -> None:
    me = ob.data
    for poly in me.polygons:
        if poly.normal.z < 0.0:
            poly.flip()
    me.update()


def _cleanup_mesh(ob: bpy.types.Object, consistent: bool = True, weld: float = 0.06) -> None:
    active(ob)
    mod = ob.modifiers.new("Weld", "WELD")
    mod.merge_threshold = weld
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=weld)
    if consistent:
        bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_flat()


def _orient_cliff_bm(bm: bmesh.types.BMesh) -> None:
    bm.normal_update()
    pts = [v.co for v in bm.verts]
    cx = sum(p.x for p in pts) / len(pts)
    cy = sum(p.y for p in pts) / len(pts)
    bottom = min(p.z for p in pts) + 12.6
    for f in bm.faces:
        f.normal_update()
        n = f.normal
        c = f.calc_center_median()
        if c.z < bottom and abs(n.z) > 0.5:
            if n.z > 0.0:
                f.normal_flip()
            continue
        if abs(n.z) > 0.55:
            # Plaza faces up. Hull shelves face down so GLB backface-cull does not
            # open slits under the top ring.
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
        log(f"{label} empty")
        return
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    log(f"{label} xy {min(xs):.1f}..{max(xs):.1f} / {min(ys):.1f}..{max(ys):.1f} z {min(zs):.1f}..{max(zs):.1f}")


def _resample_closed(
    pts: list[tuple[float, float]],
    n: int,
    phase: float = 0.0,
) -> list[tuple[float, float]]:
    """Even arc-length samples. phase in [0, 1) rotates which boulder sits on a meridian."""
    m = len(pts)
    if m < 3 or n < 3:
        return list(pts)
    acc = [0.0]
    for i in range(m):
        a, b = pts[i], pts[(i + 1) % m]
        acc.append(acc[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    total = acc[-1]
    if total < 1e-6:
        return list(pts[:n])
    out: list[tuple[float, float]] = []
    for k in range(n):
        t = ((k + phase) / n) * total % total
        for i in range(m):
            if acc[i + 1] + 1e-9 < t:
                continue
            span = acc[i + 1] - acc[i]
            u = 0.0 if span < 1e-9 else (t - acc[i]) / span
            a, b = pts[i], pts[(i + 1) % m]
            out.append((a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])))
            break
    return out


def _add_cliff_ring(
    bm: bmesh.types.BMesh,
    xy: list[tuple[float, float]],
    z: float,
    scales: list[float],
    ox: float,
    oy: float,
    zj: list[float],
) -> list[bmesh.types.BMVert]:
    vs: list[bmesh.types.BMVert] = []
    for i, (x, y) in enumerate(xy):
        sc = scales[i]
        vs.append(bm.verts.new((x * sc + ox, y * sc + oy, z + zj[i])))
    return vs


def _bridge_equal(
    bm: bmesh.types.BMesh,
    a: list[bmesh.types.BMVert],
    b: list[bmesh.types.BMVert],
) -> None:
    n = len(a)
    for i in range(n):
        j = (i + 1) % n
        try:
            bm.faces.new((a[i], a[j], b[j], b[i]))
        except ValueError:
            try:
                bm.faces.new((a[i], a[j], b[j]))
                bm.faces.new((a[i], b[j], b[i]))
            except ValueError:
                pass


def _add_chunk(
    bm: bmesh.types.BMesh,
    center: Vector,
    radius: float,
    rng: random.Random,
) -> None:
    """One irregular crystal. Hull is built in a throwaway mesh so overlaps stay distinct."""
    tmp = bmesh.new()
    n = rng.randint(8, 12)
    axes = (
        rng.uniform(0.82, 1.18),
        rng.uniform(0.78, 1.16),
        rng.uniform(0.80, 1.20),
    )
    tilt = Euler(
        (rng.uniform(-0.52, 0.52), rng.uniform(-0.52, 0.52), rng.uniform(0.0, math.tau))
    )
    vs: list[bmesh.types.BMVert] = []
    golden = math.pi * (3.0 - math.sqrt(5.0))
    for i in range(n):
        y = 1.0 - (i / max(n - 1, 1)) * 2.0
        r = math.sqrt(max(0.0, 1.0 - y * y))
        th = golden * i + rng.uniform(-0.4, 0.4)
        p = Vector((math.cos(th) * r * axes[0], y * axes[1], math.sin(th) * r * axes[2]))
        p *= radius * rng.uniform(0.58, 1.0)
        p.rotate(tilt)
        vs.append(tmp.verts.new(center + p))
    ret = bmesh.ops.convex_hull(tmp, input=vs, use_existing_faces=False)
    kill = [
        g
        for g in list(ret.get("geom_interior", [])) + list(ret.get("geom_unused", []))
        if isinstance(g, bmesh.types.BMVert)
    ]
    if kill:
        bmesh.ops.delete(tmp, geom=kill, context="VERTS")
    for v in tmp.verts:
        if v.co.z > -1.2:
            v.co.z = -1.2
    mapping: dict[bmesh.types.BMVert, bmesh.types.BMVert] = {}
    for v in tmp.verts:
        mapping[v] = bm.verts.new(v.co.copy())
    for f in tmp.faces:
        try:
            bm.faces.new([mapping[v] for v in f.verts])
        except ValueError:
            pass
    tmp.free()


def _core_fill(bm: bmesh.types.BMesh, exact: list[tuple[float, float]]) -> None:
    """Solid dark plug inside the boulder pile so sky never shows through cracks."""
    n_around = 6
    layers = (
        (-8.0, 0.58),
        (-110.0, 0.44),
        (-220.0, 0.30),
        (-330.0, 0.18),
        (-420.0, 0.08),
    )
    rings: list[list[bmesh.types.BMVert]] = []
    for z, s in layers:
        xy = _resample_closed(exact, n_around, abs(z) * 0.002)
        rings.append([bm.verts.new((x * s, y * s, z)) for x, y in xy])
    for i in range(len(rings) - 1):
        _bridge_equal(bm, rings[i], rings[i + 1])
    _cap_ring(bm, rings[-1], flip=True)


def _scatter_chunks(
    bm: bmesh.types.BMesh,
    exact: list[tuple[float, float]],
    rng: random.Random,
) -> None:
    """Packed crystals: outer silhouette stays chunky, core is filled."""
    belts = (
        (-36.0, 0.92, 10, 168.0),
        (-36.0, 0.52, 7, 150.0),
        (-36.0, 0.18, 1, 200.0),
        (-100.0, 0.82, 9, 170.0),
        (-100.0, 0.44, 6, 145.0),
        (-100.0, 0.12, 1, 175.0),
        (-175.0, 0.68, 8, 155.0),
        (-175.0, 0.34, 6, 130.0),
        (-175.0, 0.10, 1, 150.0),
        (-255.0, 0.50, 7, 130.0),
        (-255.0, 0.22, 5, 110.0),
        (-255.0, 0.08, 1, 120.0),
        (-330.0, 0.32, 6, 105.0),
        (-330.0, 0.12, 4, 88.0),
        (-385.0, 0.18, 5, 72.0),
        (-418.0, 0.08, 4, 52.0),
    )
    for bi, (z, s, count, rad) in enumerate(belts):
        if count == 1:
            loc = Vector((0.0, 0.0, z + rng.uniform(-12.0, 12.0)))
            _add_chunk(bm, loc, rad * rng.uniform(0.92, 1.08), rng)
            continue
        xy = _resample_closed(exact, count, 0.11 * float(bi))
        for x, y in xy:
            js = rng.uniform(0.96, 1.04)
            loc = Vector((x * s * js, y * s * js, z + rng.uniform(-14.0, 14.0)))
            _add_chunk(bm, loc, rad * rng.uniform(0.90, 1.10), rng)


def build_cliff(
    _half: float,
    border: list[tuple[float, float]],
    rng: random.Random,
) -> bpy.types.Object:
    """Slab matches tiles. Body is overlapping crystal boulders like the mockup."""
    exact = list(border)
    n = len(exact)
    log(f"cliff loop {n} from border {len(border)}")
    if n < 8:
        return mesh_from_bm(bmesh.new(), "Cliff")
    slab_z = -8.0
    bm = bmesh.new()
    _core_fill(bm, exact)
    _scatter_chunks(bm, exact, rng)
    ones = [1.0] * n
    z0 = [0.0] * n
    top = _add_cliff_ring(bm, exact, 0.0, ones, 0.0, 0.0, z0)
    slab = _add_cliff_ring(bm, exact, slab_z, ones, 0.0, 0.0, z0)
    _cap_ring(bm, top, flip=False)
    _bridge_equal(bm, top, slab)
    _orient_cliff_bm(bm)
    ob = mesh_from_bm(bm, "Cliff")
    _cleanup_mesh(ob, consistent=False, weld=0.02)
    bm2 = bmesh.new()
    bm2.from_mesh(ob.data)
    _orient_cliff_bm(bm2)
    bm2.to_mesh(ob.data)
    bm2.free()
    ob.data.update()
    _xy_span(ob, "cliff")
    log(f"cliff faces {len(ob.data.polygons)} chunks")
    return ob


def setup_world() -> None:
    """Pale blue sky with window-space wisps — 3D icospheres never landed in this frustum."""
    world = bpy.data.worlds.new("Sky")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 1.38
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1.35, 0.95, 1.0)
    mapping.inputs["Location"].default_value = (0.08, 0.22, 0.0)
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.feature = "F1"
    vor.inputs["Scale"].default_value = 3.8
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (0.90, 0.94, 1.0, 1.0)
    cr.elements[1].position = 0.18
    cr.elements[1].color = (0.44, 0.72, 0.98, 1.0)
    nt.links.new(coord.outputs["Window"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], vor.inputs["Vector"])
    nt.links.new(vor.outputs["Distance"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    try:
        world.cycles.sample_as_light = False
        world.cycles.sampling_method = "NONE"
    except Exception:
        pass


def setup_lights() -> None:
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 11.5
    sun.angle = 0.032
    sun.color = (1.0, 0.97, 0.90)
    so = bpy.data.objects.new("Sun", sun)
    so.rotation_euler = (math.radians(42.0), math.radians(4.0), math.radians(-50.0))
    bpy.context.scene.collection.objects.link(so)
    fill = bpy.data.lights.new("Fill", "AREA")
    fill.energy = 22.0
    fill.size = 1260.0 * ISLAND_SCALE
    fill.color = (0.70, 0.80, 0.98)
    fo = bpy.data.objects.new("Fill", fill)
    fo.location = (630.0 * ISLAND_SCALE, -810.0 * ISLAND_SCALE, 252.0 * ISLAND_SCALE)
    fo.rotation_euler = (math.radians(48.0), 0.0, math.radians(40.0))
    bpy.context.scene.collection.objects.link(fo)
    bounce = bpy.data.lights.new("Bounce", "AREA")
    bounce.energy = 14.0
    bounce.size = 980.0 * ISLAND_SCALE
    bounce.color = (0.62, 0.70, 0.90)
    bo = bpy.data.objects.new("Bounce", bounce)
    bo.location = (420.0 * ISLAND_SCALE, 180.0 * ISLAND_SCALE, -40.0 * ISLAND_SCALE)
    bo.rotation_euler = (math.radians(-25.0), 0.0, math.radians(35.0))
    bpy.context.scene.collection.objects.link(bo)


def cam(
    name: str,
    loc: tuple[float, float, float],
    look: tuple[float, float, float],
    lens: float,
    use_dof: bool = False,
) -> bpy.types.Object:
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.clip_start = 4.0 * ISLAND_SCALE
    data.clip_end = 12000.0 * ISLAND_SCALE
    look_v = Vector(look)
    loc_v = Vector(loc)
    if use_dof:
        data.dof.use_dof = True
        data.dof.focus_distance = (look_v - loc_v).length
        data.dof.aperture_fstop = 3.6
    ob = bpy.data.objects.new(name, data)
    ob.location = loc
    ob.rotation_euler = (look_v - loc_v).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(ob)
    return ob


def enable_cycles() -> None:
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 32
    sc.cycles.max_bounces = 4
    sc.cycles.diffuse_bounces = 2
    sc.cycles.use_denoising = True
    sc.render.resolution_x = 1920
    sc.render.resolution_y = 1080
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.exposure = 0.24
    sc.cycles.device = "GPU"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "OPTIX"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        log("cycles OPTIX")
    except Exception:
        sc.cycles.device = "CPU"


def render_cam(camera: bpy.types.Object, path: str) -> None:
    bpy.context.scene.camera = camera
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    log(f"wrote {path}")


def yaw_objects(obs: list[bpy.types.Object], angle: float) -> None:
    c, s = math.cos(angle), math.sin(angle)
    for ob in obs:
        x, y, z = ob.location
        ob.location = (x * c - y * s, x * s + y * c, z)
        ob.rotation_euler.z += angle


def export_glb(col: bpy.types.Collection) -> None:
    for ob in col.objects:
        if ob.type != "MESH":
            continue
        for mat in ob.data.materials:
            if mat is not None:
                mat.use_backface_culling = False
                mat.blend_method = "OPAQUE"
    bpy.ops.object.select_all(action="DESELECT")
    for ob in col.objects:
        ob.select_set(True)
    kwargs = dict(
        filepath=OUT_GLB,
        export_format="GLB",
        use_selection=True,
        export_cameras=False,
        export_lights=False,
    )
    try:
        bpy.ops.export_scene.gltf(export_vertex_color="MATERIAL", export_attributes=True, **kwargs)
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)
    log(f"wrote {OUT_GLB}")


def main() -> None:
    rng = random.Random(SEED)
    reset_scene()
    col = new_col("Island")

    sites = poisson_sites(HALF, rng)
    ghosts = make_ghosts(HALF, rng)
    cells = voronoi_cells(sites, ghosts)
    log(f"voronoi sites {len(sites)} cells {len(cells)} ghosts {len(ghosts)}")
    mass = build_mass(cells)

    def plant(
        name: str,
        file: str,
        xy: tuple[float, float],
        yaw: float,
        *,
        height: float | None = None,
        span: float | None = None,
    ) -> bpy.types.Object:
        ob = import_glb(os.path.join(SRC, file), name)
        place_on_plaza(ob, xy, yaw, target_height=height, target_span=span)
        return ob

    hall = plant("CityHall", "city_hall_qu.glb", _ixy(0.0, 8.0), 0.0, height=HALL_HEIGHT)
    tesla = plant(
        "Tesla",
        "tesla.glb",
        _ixy(-200.0, 190.0),
        math.atan2(-200.0, 190.0),
        span=DISTRICT_SPAN,
    )
    apple = plant(
        "Apple",
        "apple.glb",
        _ixy(190.0, 190.0),
        math.atan2(190.0, 190.0),
        span=DISTRICT_SPAN,
    )
    coinbase = plant(
        "Coinbase",
        "coinbase.glb",
        _ixy(-250.0, 10.0),
        math.atan2(-250.0, 10.0),
        span=ARCH_SPAN,
    )
    microsoft = plant(
        "Microsoft",
        "microsoft.glb",
        _ixy(250.0, 10.0),
        math.atan2(250.0, 10.0),
        height=MSFT_HEIGHT,
    )
    bank = plant(
        "Bank",
        "bank_qu.glb",
        _ixy(-190.0, -190.0),
        math.atan2(-190.0, -190.0),
        span=BANK_SPAN,
    )
    amazon = plant(
        "Amazon",
        "amazon.glb",
        _ixy(190.0, -190.0),
        math.atan2(190.0, -190.0),
        span=DISTRICT_SPAN,
    )
    fleet = plant(
        "FleetYard",
        "fleet_yard.glb",
        _ixy(10.0, -250.0),
        math.atan2(10.0, -250.0),
        span=YARD_SPAN,
    )
    nvidia = plant(
        "Nvidia",
        "nvidia.glb",
        _ixy(0.0, 245.0),
        math.atan2(0.0, 245.0),
        span=DISTRICT_SPAN,
    )
    workshop = plant(
        "Workshop",
        "workshop.glb",
        _ixy(245.0, -120.0),
        math.atan2(245.0, -120.0),
        span=BANK_SPAN,
    )
    power = plant(
        "PowerNode",
        "power_node.glb",
        _ixy(-300.0, -90.0),
        math.atan2(-300.0, -90.0),
        span=BANK_SPAN,
    )
    amazon_wh = plant(
        "AmazonWarehouse",
        "amazon_warehouse.glb",
        _ixy(280.0, -280.0),
        math.atan2(280.0, -280.0),
        span=DISTRICT_SPAN,
    )

    island = (mass,)
    buildings = (
        hall,
        tesla,
        apple,
        coinbase,
        microsoft,
        bank,
        amazon,
        fleet,
        nvidia,
        workshop,
        power,
        amazon_wh,
    )
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
    orbit = cam("CamOrbit", (560.0, -700.0, 240.0), (0.0, 0.0, -35.0), 42.0)
    under = cam("CamUnder", (920.0, -1020.0, 50.0), (0.0, 0.0, -150.0), 42.0)

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    render_cam(orbit, OUT_PREVIEW)
    render_cam(under, OUT_UNDER)
    export_glb(col)
    log("done")


if __name__ == "__main__":
    main()
