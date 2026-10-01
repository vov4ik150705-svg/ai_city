"""Floating island matching the empty-island mockup.

Plaza = geometric Voronoi slabs on a solid underlay (no holes, no Meshy tiling).
Cliff = one low-poly hull with large faces (no boulder instances, no voxel soup).
No waterfalls.
"""

from __future__ import annotations

import math
import os
import random
import sys

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
RING_N = 28
GRID_STEP = 0.85
N_SITES = 720


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


def rim_r(ang: float, half: float, teeth: list[float]) -> float:
    base = square_r(ang, half)
    k = int((ang % math.tau) / math.tau * len(teeth)) % len(teeth)
    return base * (
        1.0
        + 0.075 * math.sin(ang * 16.0 + 0.35)
        + 0.04 * math.sin(ang * 9.0 + 1.1)
        + teeth[k]
    )


def inside(x: float, y: float, half: float, teeth: list[float], pad: float = 0.0) -> bool:
    ang = math.atan2(y, x)
    return math.hypot(x, y) <= rim_r(ang, half, teeth) + pad


def ring_pts(half: float, teeth: list[float], n: int, jitter: float, rng: random.Random, z: float) -> list[tuple[float, float, float]]:
    pts = []
    for i in range(n):
        ang = i / n * math.tau
        r = rim_r(ang, half, teeth) + rng.uniform(-jitter, jitter)
        pts.append((math.cos(ang) * r, math.sin(ang) * r, z + rng.uniform(-jitter * 0.25, jitter * 0.25)))
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


def matte(name: str, rgb: tuple[float, float, float], rough: float = 0.92) -> bpy.types.Material:
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
        prin.inputs["Specular IOR Level"].default_value = 0.12
    if "Emission Strength" in prin.inputs:
        prin.inputs["Emission Strength"].default_value = 0.0
    vc = tree.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    mix = tree.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["Factor"].default_value = 0.55
    mix.inputs["A"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
    tree.links.new(vc.outputs["Color"], mix.inputs["B"])
    tree.links.new(mix.outputs["Result"], prin.inputs["Base Color"])
    return mat


def paint_faces(ob: bpy.types.Object, rng: random.Random, lo: float, hi: float) -> None:
    me = ob.data
    col = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
    for poly in me.polygons:
        shade = rng.uniform(lo, hi)
        rgba = (shade, shade * 1.02, shade * 1.04, 1.0)
        for li in poly.loop_indices:
            col.data[li].color = rgba


def nearest_site(x: float, y: float, sites: list[tuple[float, float]]) -> int:
    best_i = 0
    best_d = 1e18
    for i, (sx, sy) in enumerate(sites):
        d = (x - sx) * (x - sx) + (y - sy) * (y - sy)
        if d < best_d:
            best_d = d
            best_i = i
    return best_i


def build_underlay(half: float, teeth: list[float]) -> bpy.types.Object:
    bm = bmesh.new()
    n = 48
    hub = bm.verts.new((0.0, 0.0, -0.12))
    rim = []
    for i in range(n):
        ang = i / n * math.tau
        r = rim_r(ang, half, teeth) + 0.15
        rim.append(bm.verts.new((math.cos(ang) * r, math.sin(ang) * r, -0.12)))
    for i in range(n):
        bm.faces.new((hub, rim[i], rim[(i + 1) % n]))
    geom = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    down = [v for v in geom["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=down, vec=(0.0, 0.0, -0.55))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_from_bm(bm, "Grout")
    return ob


def build_plaza(half: float, teeth: list[float], rng: random.Random) -> bpy.types.Object:
    sites: list[tuple[float, float]] = []
    tries = 0
    while len(sites) < N_SITES and tries < N_SITES * 20:
        tries += 1
        x = rng.uniform(-half, half)
        y = rng.uniform(-half, half)
        if inside(x, y, half, teeth, -0.4):
            sites.append((x, y))
    log(f"voronoi sites {len(sites)}")

    n = int(2.0 * half / GRID_STEP) + 3
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=n, y_segments=n, size=half * 2.15)
    for v in bm.verts:
        v.co.z = 0.0

    layer = bm.faces.layers.int.new("site")
    kill = []
    for f in bm.faces:
        c = f.calc_center_median()
        if not inside(c.x, c.y, half, teeth, -0.05):
            kill.append(f)
            continue
        f[layer] = nearest_site(c.x, c.y, sites)
    bmesh.ops.delete(bm, geom=kill, context="FACES")

    dissolve = [
        e
        for e in bm.edges
        if len(e.link_faces) == 2 and e.link_faces[0][layer] == e.link_faces[1][layer]
    ]
    if dissolve:
        bmesh.ops.dissolve_edges(bm, edges=dissolve, use_verts=True, use_face_split=False)
    bmesh.ops.dissolve_degenerate(bm, dist=0.0001, edges=bm.edges)
    bmesh.ops.holes_fill(bm, edges=bm.edges, sides=8)

    bmesh.ops.split_edges(bm, edges=bm.edges[:])
    rng2 = random.Random(SEED + 4)
    for f in list(bm.faces):
        vs = list(f.verts)
        if len(vs) < 3:
            continue
        cx = sum(v.co.x for v in vs) / len(vs)
        cy = sum(v.co.y for v in vs) / len(vs)
        z = rng2.uniform(0.0, 0.07)
        tilt_x = rng2.uniform(-0.018, 0.018)
        tilt_y = rng2.uniform(-0.018, 0.018)
        scale = 0.965
        for v in vs:
            dx, dy = v.co.x - cx, v.co.y - cy
            v.co.x = cx + dx * scale
            v.co.y = cy + dy * scale
            v.co.z = z + dx * tilt_x + dy * tilt_y
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_from_bm(bm, "Plaza")
    log(f"plaza faces {len(ob.data.polygons)}")
    return ob


def build_cliff(half: float, teeth: list[float], rng: random.Random) -> bpy.types.Object:
    profiles = (
        (-0.70, 0.98, 0.35),
        (-3.8, 1.07, 1.8),
        (-10.5, 0.90, 1.6),
        (-19.0, 0.72, 1.5),
        (-28.5, 0.54, 1.4),
        (-36.0, 0.44, 1.2),
        (-41.5, 0.40, 1.0),
    )
    bm = bmesh.new()
    rings: list[list[bmesh.types.BMVert]] = []
    for z, sc, jit in profiles:
        pts = ring_pts(half * sc, teeth, RING_N, jit, rng, z)
        ring = [bm.verts.new(p) for p in pts]
        rings.append(ring)
        for i in range(RING_N):
            bm.edges.new((ring[i], ring[(i + 1) % RING_N]))
    bm.verts.ensure_lookup_table()
    for a, b in zip(rings, rings[1:]):
        for i in range(RING_N):
            try:
                bm.faces.new((a[i], a[(i + 1) % RING_N], b[(i + 1) % RING_N], b[i]))
            except ValueError:
                pass
    bm.faces.new(rings[0])
    cap = list(reversed(rings[-1]))
    hub = bm.verts.new((rng.uniform(-2, 2), rng.uniform(-2, 2), rings[-1][0].co.z - 3.5))
    for i in range(RING_N):
        bm.faces.new((hub, cap[i], cap[(i + 1) % RING_N]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_from_bm(bm, "Cliff")
    active(ob)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.mesh.dissolve_limited(angle_limit=math.radians(14.0))
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_flat()
    log(f"cliff faces {len(ob.data.polygons)}")
    return ob


def setup_world() -> None:
    world = bpy.data.worlds.new("Sky")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.43, 0.70, 0.96, 1.0)
    bg.inputs["Strength"].default_value = 1.15


def setup_lights() -> None:
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 5.8
    sun.angle = 0.02
    sun.color = (1.0, 0.98, 0.94)
    so = bpy.data.objects.new("Sun", sun)
    so.rotation_euler = (math.radians(50.0), math.radians(8.0), math.radians(40.0))
    bpy.context.scene.collection.objects.link(so)
    fill = bpy.data.lights.new("Fill", "AREA")
    fill.energy = 220.0
    fill.size = 70.0
    fill.color = (0.62, 0.74, 0.95)
    fo = bpy.data.objects.new("Fill", fill)
    fo.location = (-45.0, -60.0, -5.0)
    fo.rotation_euler = (math.radians(68.0), 0.0, math.radians(-18.0))
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
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.resolution_x = 1920
    sc.render.resolution_y = 1080
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.exposure = 0.12
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


def main() -> None:
    rng = random.Random(SEED)
    teeth = [rng.uniform(-0.05, 0.05) for _ in range(64)]
    reset_scene()
    col = new_col("Island")

    grout = build_underlay(HALF, teeth)
    plaza = build_plaza(HALF, teeth, rng)
    cliff = build_cliff(HALF, teeth, rng)

    gmat = matte("GroutMat", (0.07, 0.075, 0.08), 0.95)
    pmat = matte("PlazaMat", (0.16, 0.165, 0.17), 0.90)
    cmat = matte("CliffMat", (0.13, 0.135, 0.14), 0.93)
    grout.data.materials.append(gmat)
    plaza.data.materials.append(pmat)
    cliff.data.materials.append(cmat)
    paint_faces(plaza, rng, 0.13, 0.30)
    paint_faces(cliff, rng, 0.08, 0.22)
    paint_faces(grout, rng, 0.05, 0.09)

    for ob in (grout, plaza, cliff):
        active(ob)
        bpy.ops.object.shade_flat()
        if ob.name in bpy.context.scene.collection.objects and ob.name not in col.objects:
            bpy.context.scene.collection.objects.unlink(ob)
        if ob.name not in col.objects:
            col.objects.link(ob)

    yaw_objects([grout, plaza, cliff], math.radians(18.0))
    setup_world()
    setup_lights()
    enable_cycles()
    orbit = cam("CamOrbit", (118.0, -138.0, 52.0), (0.0, 0.0, -10.0), 70.0)
    under = cam("CamUnder", (108.0, -128.0, 16.0), (0.0, 2.0, -18.0), 55.0)

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    render_cam(orbit, OUT_PREVIEW)
    render_cam(under, OUT_UNDER)

    bpy.ops.object.select_all(action="DESELECT")
    for ob in col.objects:
        ob.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        use_selection=True,
        export_cameras=False,
        export_lights=False,
    )
    log(f"wrote {OUT_GLB}")
    log("done")


if __name__ == "__main__":
    main()
