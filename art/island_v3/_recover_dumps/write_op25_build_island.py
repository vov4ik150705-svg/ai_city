"""Empty Corporator island: one solid deck + one carved cliff.

The Meshy boulder is the WRONG brick for the cliff (it makes a cairn).
We steal its material only. Deck uses the tile albedo once (UV 0-1), not tiled.
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
TILE_GLB = os.path.join(ROOT, "source", "tile.glb")
ROCK_GLB = os.path.join(ROOT, "source", "rock.glb")
OUT_BLEND = os.path.join(ROOT, "island.blend")
OUT_GLB = os.path.join(ROOT, "island.glb")
OUT_PREVIEW = os.path.join(ROOT, "preview_orbit.png")
OUT_UNDER = os.path.join(ROOT, "preview_under.png")

SEED = 64018
HALF = 42.0  # 84 m deck
RING_N = 64
NOTCH_DEG = (-68, -22, 22, 68, 112, 158, 202, 248, 292, 338)


def log(msg: str) -> None:
    print(msg, flush=True)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"


def new_collection(name: str) -> bpy.types.Collection:
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def import_mesh(path: str) -> bpy.types.Object:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    fresh = [ob for ob in bpy.data.objects if ob not in before]
    mesh = next(ob for ob in fresh if ob.type == "MESH")
    mesh.parent = None
    for ob in fresh:
        if ob != mesh:
            bpy.data.objects.remove(ob, do_unlink=True)
    return mesh


def stash(ob: bpy.types.Object, col: bpy.types.Collection, name: str) -> bpy.types.Object:
    ob.name = name
    for other in list(ob.users_collection):
        other.objects.unlink(ob)
    col.objects.link(ob)
    ob.hide_render = True
    ob.hide_viewport = True
    return ob


def clone_mat(src: bpy.types.Material | None, name: str) -> bpy.types.Material:
    mat = src.copy() if src is not None else bpy.data.materials.new(name)
    mat.name = name
    mat.blend_method = "OPAQUE"
    if not mat.use_nodes or mat.node_tree is None:
        return mat
    tree = mat.node_tree
    prin = next((n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if prin is None:
        return mat
    for lnk in list(tree.links):
        if lnk.to_node == prin and lnk.to_socket.name in {"Alpha", "Emission Strength"}:
            tree.links.remove(lnk)
    if "Alpha" in prin.inputs:
        prin.inputs["Alpha"].default_value = 1.0
    if "Emission Strength" in prin.inputs:
        prin.inputs["Emission Strength"].default_value = 0.0
    hs = tree.nodes.new("ShaderNodeHueSaturation")
    hs.location = (prin.location.x - 220.0, prin.location.y)
    hs.inputs["Saturation"].default_value = 0.08
    hs.inputs["Value"].default_value = 0.78
    base_links = [lnk for lnk in tree.links if lnk.to_node == prin and lnk.to_socket.name == "Base Color"]
    if base_links:
        src_sock = base_links[0].from_socket
        tree.links.remove(base_links[0])
        tree.links.new(src_sock, hs.inputs["Color"])
    tree.links.new(hs.outputs["Color"], prin.inputs["Base Color"])
    return mat


def square_r(ang: float, half: float) -> float:
    c, s = math.cos(ang), math.sin(ang)
    return half / max(abs(c), abs(s), 1e-6)


def in_notch(ang: float, notches: list[float], width: float = 0.085) -> bool:
    for n in notches:
        d = abs((ang - n + math.pi) % (math.tau) - math.pi)
        if d < width:
            return True
    return False


def rim_radius(ang: float, half: float, teeth: list[float], notches: list[float], cut: bool) -> float:
    base = square_r(ang, half)
    k = int((ang % math.tau) / math.tau * len(teeth)) % len(teeth)
    r = base * (1.0 + 0.065 * math.sin(ang * 17.0 + 0.5) + 0.035 * math.sin(ang * 8.0) + teeth[k])
    if cut and in_notch(ang, notches):
        r *= 0.70
    return r


def ring_xy(half: float, teeth: list[float], notches: list[float], cut: bool, n: int) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    for i in range(n):
        ang = i / n * math.tau
        r = rim_radius(ang, half, teeth, notches, cut)
        pts.append((math.cos(ang) * r, math.sin(ang) * r))
    return pts


def mesh_from_bmesh(bm: bmesh.types.BMesh, name: str) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def project_uv_z(ob: bpy.types.Object) -> None:
    mesh = ob.data
    if mesh.uv_layers.active is None:
        mesh.uv_layers.new(name="UVMap")
    uv = mesh.uv_layers.active.data
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    xmin, xmax = min(xs), max(xs)
    ymin, ymax = min(ys), max(ys)
    dx = max(xmax - xmin, 1e-6)
    dy = max(ymax - ymin, 1e-6)
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            co = mesh.vertices[mesh.loops[li].vertex_index].co
            uv[li].uv = ((co.x - xmin) / dx, (co.y - ymin) / dy)


def active(ob: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def apply_mods(ob: bpy.types.Object) -> None:
    active(ob)
    for mod in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def build_deck(teeth: list[float], notches: list[float], mat: bpy.types.Material) -> bpy.types.Object:
    pts = ring_xy(HALF, teeth, notches, True, RING_N)
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, 0.0)) for x, y in pts]
    bm.verts.ensure_lookup_table()
    bm.faces.new(verts)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2)
    # Facets without ripping holes: poke, then flatten each triangle slightly.
    bmesh.ops.poke(bm, faces=bm.faces[:], offset=0.0)
    rng = random.Random(SEED + 3)
    for v in bm.verts:
        if v.is_boundary:
            continue
        v.co.z = rng.uniform(-0.03, 0.07)
    geom = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    extruded = [e for e in geom["geom"] if isinstance(e, bmesh.types.BMVert)]
    for v in extruded:
        v.co.z -= 0.55
    ob = mesh_from_bmesh(bm, "Deck")
    ob.data.materials.append(mat)
    project_uv_z(ob)
    active(ob)
    bpy.ops.object.shade_flat()
    log(f"deck faces {len(ob.data.polygons)}")
    return ob


def build_cliff(teeth: list[float], notches: list[float], mat: bpy.types.Material) -> bpy.types.Object:
    rng = random.Random(SEED + 9)
    profiles = (
        (0.02, 0.995, True),
        (-2.4, 1.05, True),
        (-8.5, 0.93, True),
        (-16.0, 0.78, False),
        (-26.0, 0.60, False),
        (-36.5, 0.46, False),
        (-46.0, 0.37, False),
        (-52.0, 0.33, False),
    )
    bm = bmesh.new()
    rings: list[list[bmesh.types.BMVert]] = []
    for z, sc, cut in profiles:
        pts = ring_xy(HALF * sc, teeth, notches, cut, RING_N)
        ring = []
        for i, (x, y) in enumerate(pts):
            jitter = 0.0 if z > -1.0 else rng.uniform(-1.1, 1.1)
            ring.append(bm.verts.new((x + rng.uniform(-0.4, 0.4), y + rng.uniform(-0.4, 0.4), z + jitter)))
        rings.append(ring)
        for i in range(RING_N):
            bm.edges.new((ring[i], ring[(i + 1) % RING_N]))
    bm.verts.ensure_lookup_table()
    for a, b in zip(rings, rings[1:]):
        for i in range(RING_N):
            bm.faces.new((a[i], a[(i + 1) % RING_N], b[(i + 1) % RING_N], b[i]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    ob = mesh_from_bmesh(bm, "Cliff")

    # Chunky ledges fused into ONE mass, then remeshed — not a cairn of spheres.
    for i in range(18):
        ang = rng.random() * math.tau
        r = rim_radius(ang, HALF * rng.uniform(0.55, 0.98), teeth, notches, False)
        cube = bpy.data.meshes.new(f"LedgeMesh{i}")
        bm2 = bmesh.new()
        bmesh.ops.create_cube(bm2, size=rng.uniform(6.5, 12.0))
        bmesh.ops.scale(
            bm2,
            verts=bm2.verts,
            vec=(rng.uniform(0.7, 1.4), rng.uniform(0.6, 1.3), rng.uniform(0.35, 0.8)),
        )
        bmesh.ops.rotate(
            bm2,
            verts=bm2.verts,
            cent=(0.0, 0.0, 0.0),
            matrix=__import__("mathutils").Euler(
                (rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5), rng.random() * math.tau)
            ).to_matrix().to_4x4(),
        )
        cube_ob = mesh_from_bmesh(bm2, f"Ledge{i}")
        cube_ob.location = (
            math.cos(ang) * r,
            math.sin(ang) * r,
            rng.uniform(-38.0, -4.0),
        )
        bool_mod = ob.modifiers.new(f"LedgeBool{i}", "BOOLEAN")
        bool_mod.operation = "UNION"
        bool_mod.solver = "FAST"
        bool_mod.object = cube_ob
        apply_mods(ob)
        bpy.data.objects.remove(cube_ob, do_unlink=True)
        bpy.data.meshes.remove(cube)

    rem = ob.modifiers.new("Remesh", "REMESH")
    rem.mode = "VOXEL"
    rem.voxel_size = 1.25
    rem.adaptivity = 0.0
    dec = ob.modifiers.new("Decimate", "DECIMATE")
    dec.ratio = 0.085
    apply_mods(ob)
    ob.data.materials.append(mat)
    project_uv_z(ob)
    active(ob)
    bpy.ops.object.shade_flat()
    log(f"cliff faces {len(ob.data.polygons)}")
    return ob


def water_material() -> bpy.types.Material:
    mat = bpy.data.materials.new("WaterFall")
    mat.use_nodes = True
    mat.blend_method = "BLEND"
    tree = mat.node_tree
    assert tree is not None
    tree.nodes.clear()
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    em = tree.nodes.new("ShaderNodeEmission")
    tr = tree.nodes.new("ShaderNodeBsdfTransparent")
    mix = tree.nodes.new("ShaderNodeMixShader")
    em.inputs["Color"].default_value = (0.20, 0.68, 1.0, 1.0)
    em.inputs["Strength"].default_value = 1.6
    mix.inputs["Fac"].default_value = 0.55
    tree.links.new(tr.outputs["BSDF"], mix.inputs[1])
    tree.links.new(em.outputs["Emission"], mix.inputs[2])
    tree.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return mat


def build_water(col: bpy.types.Collection, teeth: list[float], notches: list[float]) -> None:
    mat = water_material()
    mesh = bpy.data.meshes.new("FallRibbon")
    w0, w1, z1 = 2.2, 0.28, -48.0
    mesh.from_pydata(
        [(-w0, 0.0, 0.05), (w0, 0.0, 0.05), (w1, 0.0, z1), (-w1, 0.0, z1)],
        [],
        [(0, 1, 2, 3)],
    )
    for i, ang in enumerate(notches):
        r = rim_radius(ang, HALF, teeth, notches, True) + 0.2
        ob = bpy.data.objects.new(f"Fall_{i:02d}", mesh)
        ob.location = (math.cos(ang) * r, math.sin(ang) * r, 0.0)
        ob.rotation_euler = (0.0, 0.0, ang - math.pi * 0.5)
        if not ob.data.materials:
            ob.data.materials.append(mat)
        col.objects.link(ob)
    log(f"waterfalls {len(notches)}")


def setup_world() -> None:
    world = bpy.data.worlds.new("IslandSky")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.40, 0.68, 0.96, 1.0)
    bg.inputs["Strength"].default_value = 1.05


def setup_lights() -> None:
    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun_data.energy = 6.5
    sun_data.angle = 0.012
    sun = bpy.data.objects.new("Sun", sun_data)
    sun.rotation_euler = (math.radians(46.0), math.radians(10.0), math.radians(35.0))
    bpy.context.scene.collection.objects.link(sun)
    fill_data = bpy.data.lights.new("Fill", "AREA")
    fill_data.energy = 280.0
    fill_data.size = 60.0
    fill_data.color = (0.55, 0.72, 0.95)
    fill = bpy.data.objects.new("Fill", fill_data)
    fill.location = (-40.0, -70.0, -8.0)
    fill.rotation_euler = (math.radians(70.0), 0.0, math.radians(-20.0))
    bpy.context.scene.collection.objects.link(fill)


def setup_camera(name: str, loc: tuple[float, float, float], look: tuple[float, float, float], lens: float) -> bpy.types.Object:
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam_data.clip_end = 900.0
    cam = bpy.data.objects.new(name, cam_data)
    cam.location = loc
    cam.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(cam)
    return cam


def enable_cycles() -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.exposure = 0.1
    scene.cycles.device = "GPU"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "OPTIX"
        prefs.get_devices()
        for dev in prefs.devices:
            dev.use = True
        log("cycles OPTIX")
    except Exception:
        scene.cycles.device = "CPU"
        log("cycles CPU")


def render_cam(cam: bpy.types.Object, path: str) -> None:
    scene = bpy.context.scene
    scene.camera = cam
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    log(f"wrote {path}")


def main() -> None:
    if not os.path.isfile(TILE_GLB) or not os.path.isfile(ROCK_GLB):
        log("missing source GLB")
        sys.exit(1)
    rng = random.Random(SEED)
    teeth = [rng.uniform(-0.045, 0.045) for _ in range(64)]
    notches = [math.radians(d) for d in NOTCH_DEG]
    reset_scene()
    templates = new_collection("Templates")
    water_col = new_collection("Water")
    island_col = new_collection("Island")

    tile = stash(import_mesh(TILE_GLB), templates, "TileSrc")
    rock = stash(import_mesh(ROCK_GLB), templates, "RockSrc")
    tile_mat = clone_mat(tile.material_slots[0].material if tile.material_slots else None, "DeckStone")
    rock_mat = clone_mat(rock.material_slots[0].material if rock.material_slots else None, "CliffStone")

    deck = build_deck(teeth, notches, tile_mat)
    cliff = build_cliff(teeth, notches, rock_mat)
    for ob in (deck, cliff):
        for col in list(ob.users_collection):
            if col != island_col:
                col.objects.unlink(ob)
        island_col.objects.link(ob)

    yaw = math.radians(16.0)
    c, s = math.cos(yaw), math.sin(yaw)
    for ob in (deck, cliff):
        x, y, z = ob.location
        ob.location = (x * c - y * s, x * s + y * c, z)
        ob.rotation_euler.z += yaw
    build_water(water_col, teeth, notches)
    for ob in water_col.objects:
        x, y, z = ob.location
        ob.location = (x * c - y * s, x * s + y * c, z)
        ob.rotation_euler.z += yaw

    setup_world()
    setup_lights()
    enable_cycles()
    cam_orbit = setup_camera("CamOrbit", (122.0, -150.0, 38.0), (0.0, 0.0, -14.0), 50.0)
    cam_under = setup_camera("CamUnder", (110.0, -132.0, 12.0), (0.0, 2.0, -22.0), 50.0)

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    render_cam(cam_orbit, OUT_PREVIEW)
    render_cam(cam_under, OUT_UNDER)

    bpy.ops.object.select_all(action="DESELECT")
    for col in (island_col, water_col):
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
