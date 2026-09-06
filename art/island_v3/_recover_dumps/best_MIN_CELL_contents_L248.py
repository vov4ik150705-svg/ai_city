"""Floating island matching the empty-island mockup.

Plaza = packed Voronoi flagstones. Cliff = faceted taper, no voxel remesh. No water.
"""

from __future__ import annotations

import math
import os
import random

import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_BLEND = os.path.join(ROOT, "island.blend")
OUT_GLB = os.path.join(ROOT, "island.glb")
OUT_PREVIEW = os.path.join(ROOT, "preview_orbit.png")
OUT_UNDER = os.path.join(ROOT, "preview_under.png")

SEED = 64018
HALF = 40.0
N_SITES = 155
MIN_CELL = 4.7

# Ghosts bite these slots out of the Voronoi rim (empty waterfall notches).
# (side, t_center, width, depth_m). side 0=+Y 1=+X 2=-Y 3=-X. t in [0, 1].
NOTCHES_RECT = (
    (0, 0.32, 0.13, 6.4),
    (0, 0.70, 0.11, 5.6),
    (1, 0.30, 0.12, 6.0),
    (1, 0.66, 0.10, 5.2),
    (2, 0.36, 0.13, 6.8),
    (3, 0.40, 0.12, 5.8),
)


def log(msg: str) -> None:
    print(msg, flush=True)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"


def new_col(name: str) -> bpy.types.Collection:
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def square_r(ang: float, half: float) -> float:
    c, s = math.cos(ang), math.sin(ang)
    return half / max(abs(c), abs(s), 1e-6)


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
    n_side = 14
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


def matte(name: str, rgb: tuple[float, float, float], rough: float = 0.93) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.blend_method = "OPAQUE"
    tree = mat.node_tree
    assert tree is not None
    prin = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
    prin.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
    if "Metallic" in prin.inputs:
        prin.inputs["Metallic"].default_value = 0.0
    if "Roughness" in prin.inputs:
        prin.inputs["Roughness"].default_value = rough
    if "Specular IOR Level" in prin.inputs:
        prin.inputs["Specular IOR Level"].default_value = 0.08
    if "Emission Strength" in prin.inputs:
        prin.inputs["Emission Strength"].default_value = 0.0
    attr = tree.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "Col"
    tree.links.new(attr.outputs["Color"], prin.inputs["Base Color"])
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
            lift = 0.22 * (poly.normal.z + 1.0)
            shade = lo + (hi - lo) * lift + rng.uniform(-0.006, 0.008)
        else:
            shade = rng.uniform(lo, hi)
        shade = max(0.008, min(0.07, shade))
        rgba = (shade * 0.98, shade, shade * 1.03, 1.0)
        for li in poly.loop_indices:
            col.data[li].color = rgba


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
    pad = 1.4
    while len(sites) < N_SITES and tries < N_SITES * 80:
        tries += 1
        x = rng.uniform(-half + pad, half - pad)
        y = rng.uniform(-half + pad, half - pad)
        if any((x - sx) ** 2 + (y - sy) ** 2 < min2 for sx, sy in sites):
            continue
        sites.append((x, y))
    return sites


def make_ghosts(half: float, rng: random.Random) -> list[tuple[float, float]]:
    """Sites we never mesh. Fence along square sides so the rim stays tile-edged, not a circle."""
    ghosts: list[tuple[float, float]] = []
    n_fence = 12
    for side in range(4):
        for i in range(n_fence):
            t = (i + 0.5) / n_fence
            x, y = _side_point(side, t, half + 4.4 + rng.uniform(-0.5, 0.5))
            ghosts.append((x, y))
    for sx, sy in ((1.0, 1.0), (1.0, -1.0), (-1.0, 1.0), (-1.0, -1.0)):
        ghosts.append((sx * (half + 3.6), sy * (half + 3.6)))
        ghosts.append((sx * (half - 0.8), sy * (half + 5.4)))
        ghosts.append((sx * (half + 5.4), sy * (half - 0.8)))
    for side, t, width, depth in NOTCHES_RECT:
        ghosts.append(_side_point(side, t, half - depth * 0.62))
        ghosts.append(_side_point(side, t, half - depth * 0.22))
        ghosts.append(_side_point(side, max(0.03, t - width * 0.40), half + 2.2))
        ghosts.append(_side_point(side, min(0.97, t + width * 0.40), half + 2.2))
    return ghosts


def voronoi_cells(
    sites: list[tuple[float, float]],
    ghosts: list[tuple[float, float]],
) -> list[list[tuple[float, float]]]:
    all_pts = sites + ghosts
    h = HALF + 16.0
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


def simplify_loop(pts: list[tuple[float, float]], target: int = 34) -> list[tuple[float, float]]:
    """Keep high-turn verts (notches, corners) so the cliff has large planar faces."""
    n = len(pts)
    if n <= target:
        return pts
    scored: list[tuple[float, int]] = []
    for i in range(n):
        ax, ay = pts[(i - 1) % n]
        bx, by = pts[i]
        cx, cy = pts[(i + 1) % n]
        v1 = Vector((bx - ax, by - ay, 0.0))
        v2 = Vector((cx - bx, cy - by, 0.0))
        if v1.length < 1e-6 or v2.length < 1e-6:
            turn = 0.0
        else:
            turn = abs(v1.normalized().cross(v2.normalized()).z)
        scored.append((turn, i))
    keep: set[int] = {0, n // 4, n // 2, (3 * n) // 4}
    for _turn, i in sorted(scored, reverse=True):
        keep.add(i)
        if len(keep) >= target:
            break
    step = max(1, n // target)
    for i in range(0, n, step):
        keep.add(i)
        if len(keep) >= target + 6:
            break
    out = [pts[i] for i in sorted(keep)]
    log(f"cliff loop {len(out)} from {n}")
    return out


def build_plaza(
    cells: list[list[tuple[float, float]]],
    rng: random.Random,
) -> bpy.types.Object:
    bm = bmesh.new()
    built = 0
    for poly in cells:
        if len(poly) < 3:
            continue
        z = rng.uniform(0.0, 0.018)
        verts = [bm.verts.new((p[0], p[1], z)) for p in poly]
        try:
            bm.faces.new(verts)
            built += 1
        except ValueError:
            continue
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.inset_individual(
        bm,
        faces=bm.faces[:],
        thickness=0.18,
        depth=0.045,
        use_even_offset=True,
    )
    geom = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    down = [v for v in geom["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=down, vec=(0.0, 0.0, -0.28))
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_from_bm(bm, "Plaza")
    active(ob)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    log(f"plaza faces {len(ob.data.polygons)} cells {built}")
    return ob


def paint_plaza(ob: bpy.types.Object, rng: random.Random) -> None:
    me = ob.data
    col = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
    me.color_attributes.active_color = col
    for poly in me.polygons:
        n = poly.normal
        if abs(n.z) > 0.25:
            shade = rng.uniform(0.018, 0.038)
        else:
            shade = rng.uniform(0.010, 0.018)
        rgba = (shade * 0.97, shade, shade * 1.04, 1.0)
        for li in poly.loop_indices:
            col.data[li].color = rgba


def build_seal(border: list[tuple[float, float]]) -> bpy.types.Object:
    """Same-color under-plaza seal so voronoi slivers do not show the hollow cliff."""
    bm = bmesh.new()
    if len(border) < 3:
        return mesh_from_bm(bm, "Seal")
    cx = sum(p[0] for p in border) / len(border)
    cy = sum(p[1] for p in border) / len(border)
    hub = bm.verts.new((cx * 0.999, cy * 0.999, -0.08))
    rim = [bm.verts.new((p[0] * 0.999, p[1] * 0.999, -0.08)) for p in border]
    for i in range(len(rim)):
        bm.faces.new((hub, rim[i], rim[(i + 1) % len(rim)]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bm(bm, "Seal")


def _cleanup_mesh(ob: bpy.types.Object) -> None:
    active(ob)
    weld = ob.modifiers.new("Weld", "WELD")
    weld.merge_threshold = 0.06
    bpy.ops.object.modifier_apply(modifier=weld.name)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.06)
    bpy.ops.mesh.dissolve_limited(angle_limit=math.radians(18.0))
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_flat()


def _xy_span(ob: bpy.types.Object, label: str) -> None:
    pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
    if not pts:
        log(f"{label} empty")
        return
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    log(f"{label} xy {min(xs):.1f}..{max(xs):.1f} / {min(ys):.1f}..{max(ys):.1f} z {min(zs):.1f}..{max(zs):.1f}")


def build_cliff(
    _half: float,
    border: list[tuple[float, float]],
    rng: random.Random,
) -> bpy.types.Object:
    """Open-top faceted taper. Same footprint as the plaza. No remesh, no cube soup."""
    loop = simplify_loop(border, target=34)
    n = len(loop)
    if n < 8:
        loop = border
        n = len(loop)
    zs = (-0.10, -5.4, -15.0, -27.5, -41.0)
    scale_span = (
        (1.00, 1.00),
        (0.86, 1.00),
        (0.58, 0.86),
        (0.30, 0.52),
        (0.08, 0.20),
    )
    bm = bmesh.new()
    rings: list[list[bmesh.types.BMVert]] = []
    for ri, z in enumerate(zs):
        vs: list[bmesh.types.BMVert] = []
        lo, hi = scale_span[ri]
        for i, (x, y) in enumerate(loop):
            if ri == 0:
                s = 1.0
                zz = z
            else:
                s = rng.uniform(lo, hi)
                if ri == 1 and i % 5 == 2:
                    s = min(1.0, s * rng.uniform(0.98, 1.0))
                if ri >= 2 and i % 4 == (ri % 4):
                    s *= rng.uniform(0.74, 0.90)
                zz = z + rng.uniform(-0.7, 0.7)
            vs.append(bm.verts.new((x * s, y * s, zz)))
        rings.append(vs)
    for ri in range(len(rings) - 1):
        a, b = rings[ri], rings[ri + 1]
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_from_bm(bm, "Cliff")
    _cleanup_mesh(ob)
    _xy_span(ob, "cliff")
    log(f"cliff faces {len(ob.data.polygons)}")
    return ob


def setup_world() -> None:
    world = bpy.data.worlds.new("Sky")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.48, 0.76, 1.0, 1.0)
    bg.inputs["Strength"].default_value = 0.95


def setup_lights() -> None:
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 14.0
    sun.angle = 0.0022
    sun.color = (1.0, 0.97, 0.92)
    so = bpy.data.objects.new("Sun", sun)
    so.rotation_euler = (math.radians(42.0), math.radians(8.0), math.radians(-38.0))
    bpy.context.scene.collection.objects.link(so)
    fill = bpy.data.lights.new("Fill", "AREA")
    fill.energy = 1.35
    fill.size = 90.0
    fill.color = (0.55, 0.68, 0.92)
    fo = bpy.data.objects.new("Fill", fill)
    fo.location = (-50.0, -55.0, -8.0)
    fo.rotation_euler = (math.radians(70.0), 0.0, math.radians(-22.0))
    bpy.context.scene.collection.objects.link(fo)


def add_clouds(cam_loc: Vector, look: Vector) -> None:
    mat = bpy.data.materials.new("CloudMat")
    mat.use_nodes = True
    tree = mat.node_tree
    assert tree is not None
    prin = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
    prin.inputs["Base Color"].default_value = (0.96, 0.97, 0.99, 1.0)
    if "Roughness" in prin.inputs:
        prin.inputs["Roughness"].default_value = 1.0
    if "Specular IOR Level" in prin.inputs:
        prin.inputs["Specular IOR Level"].default_value = 0.0
    if "Emission Color" in prin.inputs:
        prin.inputs["Emission Color"].default_value = (0.92, 0.95, 1.0, 1.0)
    if "Emission Strength" in prin.inputs:
        prin.inputs["Emission Strength"].default_value = 0.28
    fwd = (look - cam_loc).normalized()
    world_up = Vector((0.0, 0.0, 1.0))
    right = fwd.cross(world_up)
    if right.length < 0.05:
        right = Vector((1.0, 0.0, 0.0))
    right.normalize()
    up = right.cross(fwd).normalized()
    specs = (
        (right * 88.0 + up * 52.0 + fwd * 18.0, 34.0, 0.16),
        (right * -82.0 + up * 56.0 + fwd * 10.0, 38.0, 0.14),
        (right * 12.0 + up * 64.0 + fwd * 28.0, 30.0, 0.18),
        (right * 54.0 + up * 38.0 + fwd * -6.0, 24.0, 0.15),
    )
    for offset, rad, squash in specs:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=rad, location=offset)
        ob = bpy.context.object
        ob.scale.z = squash
        ob.data.materials.append(mat)
        ob.visible_shadow = False
        bpy.ops.object.shade_smooth()


def cam(name: str, loc: tuple[float, float, float], look: tuple[float, float, float], lens: float) -> bpy.types.Object:
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.clip_end = 900.0
    look_v = Vector(look)
    loc_v = Vector(loc)
    data.dof.use_dof = True
    data.dof.focus_distance = (look_v - loc_v).length
    data.dof.aperture_fstop = 4.5
    ob = bpy.data.objects.new(name, data)
    ob.location = loc
    ob.rotation_euler = (look_v - loc_v).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(ob)
    return ob


def enable_cycles() -> None:
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 32
    sc.cycles.use_denoising = True
    sc.render.resolution_x = 1920
    sc.render.resolution_y = 1080
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.exposure = 0.02
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
    border = boundary_loop(cells)
    if len(border) < 12:
        border = make_outline(HALF)
        log("boundary fallback to square outline")
    plaza = build_plaza(cells, rng)
    seal = build_seal(border)
    cliff = build_cliff(HALF, border, rng)
    _xy_span(plaza, "plaza")

    plaza.data.materials.append(matte("PlazaMat", (0.04, 0.042, 0.044), 0.94))
    seal.data.materials.append(matte("SealMat", (0.032, 0.034, 0.036), 0.95))
    cliff.data.materials.append(matte("CliffMat", (0.036, 0.038, 0.040), 0.97))
    paint_plaza(plaza, rng)
    paint_faces(seal, rng, 0.022, 0.030, False)
    paint_faces(cliff, rng, 0.014, 0.052, True)

    for ob in (plaza, seal, cliff):
        active(ob)
        bpy.ops.object.shade_flat()
        if ob.name in bpy.context.scene.collection.objects and ob.name not in col.objects:
            bpy.context.scene.collection.objects.unlink(ob)
        if ob.name not in col.objects:
            col.objects.link(ob)

    yaw_objects([plaza, seal, cliff], math.radians(45.0))
    setup_world()
    setup_lights()
    enable_cycles()
    orbit = cam("CamOrbit", (90.0, -90.0, 88.0), (0.0, 0.0, -8.0), 48.0)
    under = cam("CamUnder", (112.0, -122.0, 10.0), (0.0, 2.0, -22.0), 50.0)
    add_clouds(Vector(orbit.location), Vector((0.0, 0.0, -8.0)))

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    render_cam(orbit, OUT_PREVIEW)
    render_cam(under, OUT_UNDER)
    export_glb(col)
    log("done")


if __name__ == "__main__":
    main()
