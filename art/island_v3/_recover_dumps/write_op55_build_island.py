"""Floating island matching the empty-island mockup.

Plaza = packed Voronoi flagstones on a hidden grout bed.
Cliff = one hewn hull: ridges, ledges, chopped bottom. No boulders, no water.
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
RING_N = 16
N_SITES = 240
MIN_CELL = 3.55

# Empty waterfall slots: (angle, half-width rad, depth fraction).
NOTCHES = (
    (0.22, 0.16, 0.11),
    (1.12, 0.13, 0.09),
    (1.92, 0.15, 0.12),
    (2.78, 0.12, 0.08),
    (3.95, 0.16, 0.10),
    (4.88, 0.13, 0.09),
    (5.62, 0.11, 0.07),
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


def notch_scale(ang: float) -> float:
    s = 1.0
    for a0, width, depth in NOTCHES:
        da = abs((ang - a0 + math.pi) % math.tau - math.pi)
        if da >= width:
            continue
        flat = width * 0.52
        if da <= flat:
            fall = 1.0
        else:
            t = (da - flat) / max(width - flat, 1e-6)
            fall = 0.5 + 0.5 * math.cos(t * math.pi)
        s *= 1.0 - depth * fall
    return s


def rim_r(ang: float, half: float, teeth: list[float]) -> float:
    base = square_r(ang, half)
    k = int((ang % math.tau) / math.tau * len(teeth)) % len(teeth)
    return (
        base
        * notch_scale(ang)
        * (
            1.0
            + 0.028 * math.sin(ang * 11.0 + 0.4)
            + 0.016 * math.sin(ang * 6.0 + 1.3)
            + teeth[k]
        )
    )


def inside(x: float, y: float, half: float, teeth: list[float], pad: float = 0.0) -> bool:
    return math.hypot(x, y) <= rim_r(math.atan2(y, x), half, teeth) + pad


def outline_poly(half: float, teeth: list[float], n: int = 64) -> list[tuple[float, float]]:
    pts = []
    for i in range(n):
        ang = i / n * math.tau
        r = rim_r(ang, half, teeth)
        pts.append((math.cos(ang) * r, math.sin(ang) * r))
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
            lift = 0.5 * (poly.normal.z + 1.0)
            shade = lo + (hi - lo) * lift + rng.uniform(-0.012, 0.016)
        else:
            shade = rng.uniform(lo, hi)
        shade = max(0.025, min(0.22, shade))
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


def poisson_sites(half: float, teeth: list[float], rng: random.Random) -> list[tuple[float, float]]:
    sites: list[tuple[float, float]] = []
    min2 = MIN_CELL * MIN_CELL
    tries = 0
    while len(sites) < N_SITES and tries < N_SITES * 80:
        tries += 1
        x = rng.uniform(-half, half)
        y = rng.uniform(-half, half)
        if not inside(x, y, half, teeth, -1.1):
            continue
        if any((x - sx) ** 2 + (y - sy) ** 2 < min2 for sx, sy in sites):
            continue
        sites.append((x, y))
    return sites


def build_plaza(half: float, teeth: list[float], rng: random.Random) -> bpy.types.Object:
    sites = poisson_sites(half, teeth, rng)
    log(f"voronoi sites {len(sites)}")
    border = outline_poly(half, teeth, 72)
    bm = bmesh.new()
    built = 0
    near = (MIN_CELL * 5.0) ** 2
    for i, site in enumerate(sites):
        poly = border
        sx, sy = site
        for j, other in enumerate(sites):
            if i == j:
                continue
            ox, oy = other
            if (ox - sx) ** 2 + (oy - sy) ** 2 > near:
                continue
            poly = clip_closer(poly, site, other)
            if len(poly) < 3:
                break
        if len(poly) < 3:
            continue
        z = rng.uniform(0.0, 0.028)
        verts = [bm.verts.new((p[0], p[1], z)) for p in poly]
        try:
            bm.faces.new(verts)
            built += 1
        except ValueError:
            continue
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    inners = bm.faces[:]
    bmesh.ops.inset_individual(
        bm,
        faces=inners,
        thickness=0.085,
        depth=0.038,
        use_even_offset=True,
    )
    geom = bmesh.ops.extrude_face_region(bm, geom=inners)
    down = [v for v in geom["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=down, vec=(0.0, 0.0, -0.22))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_from_bm(bm, "Plaza")
    log(f"plaza faces {len(ob.data.polygons)} cells {built}")
    return ob


def build_underlay(half: float, teeth: list[float]) -> bpy.types.Object:
    bm = bmesh.new()
    n = 64
    hub = bm.verts.new((0.0, 0.0, -0.06))
    rim = []
    for i in range(n):
        ang = i / n * math.tau
        r = rim_r(ang, half, teeth) - 0.12
        rim.append(bm.verts.new((math.cos(ang) * r, math.sin(ang) * r, -0.06)))
    for i in range(n):
        bm.faces.new((hub, rim[i], rim[(i + 1) % n]))
    geom = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    down = [v for v in geom["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=down, vec=(0.0, 0.0, -0.42))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bm(bm, "Grout")


def _ring(
    bm: bmesh.types.BMesh,
    half: float,
    teeth: list[float],
    ridges: list[float],
    z: float,
    scale: float,
    jit: float,
    rng: random.Random,
) -> list[bmesh.types.BMVert]:
    ring = []
    for i in range(RING_N):
        ang = i / RING_N * math.tau
        r = rim_r(ang, half * scale, teeth) * ridges[i]
        r += rng.uniform(-jit, jit)
        zz = z + rng.uniform(-jit * 0.18, jit * 0.18)
        ring.append(bm.verts.new((math.cos(ang) * r, math.sin(ang) * r, zz)))
    for i in range(RING_N):
        try:
            bm.edges.new((ring[i], ring[(i + 1) % RING_N]))
        except ValueError:
            pass
    return ring


def _add_ledges(bm: bmesh.types.BMesh, rng: random.Random) -> None:
    bm.faces.ensure_lookup_table()
    picks: list[bmesh.types.BMFace] = []
    for f in bm.faces:
        c = f.calc_center_median()
        n = f.normal
        if c.z > -4.0 or c.z < -34.0:
            continue
        if abs(n.z) > 0.55:
            continue
        picks.append(f)
    rng.shuffle(picks)
    chosen = picks[:14]
    if not chosen:
        return
    ret = bmesh.ops.extrude_discrete_faces(bm, faces=chosen)
    new_faces = ret.get("faces", [])
    try:
        bmesh.ops.delete(bm, geom=chosen, context="FACES")
    except Exception:
        pass
    for nf in new_faces:
        if not nf.is_valid:
            continue
        n = nf.normal.copy()
        if n.length < 1e-6:
            continue
        n.normalize()
        dist = rng.uniform(2.2, 5.8)
        bmesh.ops.translate(bm, verts=list(nf.verts), vec=n * dist)
        cent = nf.calc_center_median()
        k = rng.uniform(0.68, 0.88)
        for v in nf.verts:
            v.co = cent + (v.co - cent) * k


def build_cliff(half: float, teeth: list[float], rng: random.Random) -> bpy.types.Object:
    ridges = [rng.uniform(0.84, 1.16) for _ in range(RING_N)]
    for i in range(0, RING_N, 2):
        ridges[i] *= rng.uniform(1.06, 1.20)
    profiles = (
        (-0.50, 0.995, 0.35),
        (-2.6, 1.09, 1.6),
        (-5.4, 0.92, 2.0),
        (-9.2, 1.04, 2.2),
        (-14.0, 0.76, 1.9),
        (-18.8, 0.88, 2.1),
        (-24.5, 0.64, 1.7),
        (-30.5, 0.56, 1.5),
        (-36.8, 0.50, 1.3),
        (-42.5, 0.46, 1.1),
    )
    bm = bmesh.new()
    rings: list[list[bmesh.types.BMVert]] = []
    for z, sc, jit in profiles:
        rings.append(_ring(bm, half, teeth, ridges, z, sc, jit, rng))
    for a, b in zip(rings, rings[1:]):
        for i in range(RING_N):
            try:
                bm.faces.new((a[i], a[(i + 1) % RING_N], b[(i + 1) % RING_N], b[i]))
            except ValueError:
                pass
    try:
        bm.faces.new(rings[0])
    except ValueError:
        pass

    last = rings[-1]
    cx = sum(v.co.x for v in last) / RING_N
    cy = sum(v.co.y for v in last) / RING_N
    cz = sum(v.co.z for v in last) / RING_N
    inner: list[bmesh.types.BMVert] = []
    for k in range(4):
        ang = k * math.tau / 4.0 + 0.28
        rr = half * 0.16
        inner.append(
            bm.verts.new(
                (
                    cx + math.cos(ang) * rr,
                    cy + math.sin(ang) * rr,
                    cz + rng.uniform(-2.4, 1.0),
                )
            )
        )
    try:
        bm.faces.new(list(reversed(inner)))
    except ValueError:
        pass
    for i in range(RING_N):
        a = last[i]
        b = last[(i + 1) % RING_N]
        ia = inner[int(i / RING_N * 4) % 4]
        ib = inner[int((i + 1) / RING_N * 4) % 4]
        try:
            if ia == ib:
                bm.faces.new((a, b, ia))
            else:
                bm.faces.new((a, b, ib, ia))
        except ValueError:
            try:
                bm.faces.new((a, b, ia))
            except ValueError:
                pass

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    _add_ledges(bm, rng)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.dissolve_limit(
        bm,
        angle_limit=math.radians(9.0),
        verts=bm.verts,
        edges=bm.edges,
        use_dissolve_boundaries=False,
    )
    ob = mesh_from_bm(bm, "Cliff")
    active(ob)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_flat()
    log(f"cliff faces {len(ob.data.polygons)}")
    return ob


def setup_world() -> None:
    world = bpy.data.worlds.new("Sky")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    assert nt is not None
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 1.08
    tex = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1.6, 1.1, 0.35)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1.7
    noise.inputs["Detail"].default_value = 1.2
    noise.inputs["Roughness"].default_value = 0.38
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "EASE"
    ramp.color_ramp.elements[0].position = 0.42
    ramp.color_ramp.elements[0].color = (0.46, 0.72, 0.96, 1.0)
    ramp.color_ramp.elements[1].position = 0.78
    ramp.color_ramp.elements[1].color = (0.86, 0.92, 0.98, 1.0)
    nt.links.new(tex.outputs["Generated"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def setup_lights() -> None:
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 5.2
    sun.angle = 0.018
    sun.color = (1.0, 0.97, 0.93)
    so = bpy.data.objects.new("Sun", sun)
    so.rotation_euler = (math.radians(46.0), math.radians(6.0), math.radians(52.0))
    bpy.context.scene.collection.objects.link(so)
    fill = bpy.data.lights.new("Fill", "AREA")
    fill.energy = 90.0
    fill.size = 80.0
    fill.color = (0.58, 0.70, 0.92)
    fo = bpy.data.objects.new("Fill", fill)
    fo.location = (-50.0, -55.0, -8.0)
    fo.rotation_euler = (math.radians(70.0), 0.0, math.radians(-22.0))
    bpy.context.scene.collection.objects.link(fo)


def cam(name: str, loc: tuple[float, float, float], look: tuple[float, float, float], lens: float) -> bpy.types.Object:
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.clip_end = 900.0
    ob = bpy.data.objects.new(name, data)
    ob.location = loc
    ob.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
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
    teeth = [rng.uniform(-0.022, 0.022) for _ in range(64)]
    reset_scene()
    col = new_col("Island")

    grout = build_underlay(HALF, teeth)
    plaza = build_plaza(HALF, teeth, rng)
    cliff = build_cliff(HALF, teeth, rng)

    grout.data.materials.append(matte("GroutMat", (0.035, 0.036, 0.038), 0.97))
    plaza.data.materials.append(matte("PlazaMat", (0.10, 0.105, 0.11), 0.90))
    cliff.data.materials.append(matte("CliffMat", (0.08, 0.084, 0.09), 0.95))
    paint_faces(plaza, rng, 0.068, 0.145, False)
    paint_faces(cliff, rng, 0.038, 0.125, True)
    paint_faces(grout, rng, 0.028, 0.045, False)

    for ob in (grout, plaza, cliff):
        active(ob)
        bpy.ops.object.shade_flat()
        if ob.name in bpy.context.scene.collection.objects and ob.name not in col.objects:
            bpy.context.scene.collection.objects.unlink(ob)
        if ob.name not in col.objects:
            col.objects.link(ob)

    yaw_objects([grout, plaza, cliff], math.radians(45.0))
    setup_world()
    setup_lights()
    enable_cycles()
    orbit = cam("CamOrbit", (102.0, -102.0, 76.0), (0.0, 0.0, -10.0), 58.0)
    under = cam("CamUnder", (108.0, -118.0, 14.0), (0.0, 2.0, -20.0), 52.0)

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    render_cam(orbit, OUT_PREVIEW)
    render_cam(under, OUT_UNDER)
    export_glb(col)
    log("done")


if __name__ == "__main__":
    main()
