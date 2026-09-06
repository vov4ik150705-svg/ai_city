"""Assemble the Corporator empty island from Meshy tile + rock GLBs.

Run:
  blender --background --python art/island_v3/build_island.py
"""

from __future__ import annotations

import math
import os
import random
import sys
from typing import Iterable

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
TILE_M = 2.0
GRID = 40  # 80 m deck — room for 18 buildings plus streets
LAYERS = 9
WATER_COUNT = 10


def log(msg: str) -> None:
    print(msg, flush=True)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


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
    mesh.matrix_world = mesh.matrix_world.copy()
    for ob in fresh:
        if ob != mesh and ob.type != "MESH":
            bpy.data.objects.remove(ob, do_unlink=True)
    return mesh


def stash_template(ob: bpy.types.Object, col: bpy.types.Collection, name: str) -> bpy.types.Object:
    ob.name = name
    for other in list(ob.users_collection):
        other.objects.unlink(ob)
    col.objects.link(ob)
    ob.hide_render = True
    ob.hide_viewport = True
    ob.hide_set(True)
    return ob


def spawn(
    template: bpy.types.Object,
    col: bpy.types.Collection,
    name: str,
    loc: tuple[float, float, float],
    rot: tuple[float, float, float] = (0.0, 0.0, 0.0),
    scale: float | tuple[float, float, float] = 1.0,
) -> bpy.types.Object:
    ob = template.copy()
    ob.data = template.data
    ob.name = name
    ob.location = loc
    ob.rotation_euler = rot
    ob.scale = (scale, scale, scale) if isinstance(scale, (int, float)) else scale
    ob.hide_render = False
    ob.hide_viewport = False
    ob.hide_set(False)
    col.objects.link(ob)
    return ob


def charcoalize(mat: bpy.types.Material, saturation: float, value: float) -> None:
    if mat is None or not mat.use_nodes or mat.node_tree is None:
        return
    tree = mat.node_tree
    prin = next((n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if prin is None:
        return
    if "Emission Strength" in prin.inputs:
        prin.inputs["Emission Strength"].default_value = 0.0
    links = [lnk for lnk in tree.links if lnk.to_node == prin and lnk.to_socket.name == "Base Color"]
    hs = tree.nodes.new("ShaderNodeHueSaturation")
    hs.location = (prin.location.x - 220.0, prin.location.y)
    hs.inputs["Saturation"].default_value = saturation
    hs.inputs["Value"].default_value = value
    if links:
        src = links[0].from_socket
        tree.links.remove(links[0])
        tree.links.new(src, hs.inputs["Color"])
    else:
        hs.inputs["Color"].default_value = (0.12, 0.13, 0.14, 1.0)
    tree.links.new(hs.outputs["Color"], prin.inputs["Base Color"])


def square_radius(angle: float, half: float) -> float:
    c = math.cos(angle)
    s = math.sin(angle)
    den = max(abs(c), abs(s), 1e-6)
    return half / den


def jagged_radius(angle: float, half: float, rng: random.Random) -> float:
    base = square_radius(angle, half)
    teeth = 0.055 * math.sin(angle * 13.0 + 0.7) + 0.03 * math.sin(angle * 7.0)
    wobble = 0.04 * (rng.random() * 2.0 - 1.0)
    return base * (1.0 + teeth + wobble)


def notch_angles() -> list[float]:
    # Ten edge cuts: not from the centre. Cardinal sides only.
    deg = [-70, -20, 20, 70, 110, 160, 200, 250, 290, 340]
    return [math.radians(d) for d in deg]


def in_notch(angle: float, notches: Iterable[float], width: float = 0.11) -> bool:
    for n in notches:
        d = abs((angle - n + math.pi) % (2.0 * math.pi) - math.pi)
        if d < width:
            return True
    return False


def build_deck(
    tile: bpy.types.Object,
    col: bpy.types.Collection,
    rng: random.Random,
    half: float,
    notches: list[float],
) -> set[tuple[int, int]]:
    occupied: set[tuple[int, int]] = set()
    n = 0
    for i in range(GRID):
        for j in range(GRID):
            x = (i + 0.5 - GRID / 2.0) * TILE_M
            y = (j + 0.5 - GRID / 2.0) * TILE_M
            ang = math.atan2(y, x)
            r = math.hypot(x, y)
            limit = jagged_radius(ang, half, rng)
            if in_notch(ang, notches) and r > limit * 0.78:
                continue
            if r > limit:
                continue
            if r > limit * 0.92 and rng.random() < 0.45:
                continue
            yaw = rng.choice((0.0, math.pi * 0.5, math.pi, math.pi * 1.5))
            zjit = rng.uniform(-0.012, 0.018)
            spawn(
                tile,
                col,
                f"Deck_{i:02d}_{j:02d}",
                (x, y, zjit),
                (0.0, 0.0, yaw),
                1.01,
            )
            occupied.add((i, j))
            n += 1
    log(f"deck tiles {n}")
    return occupied


def water_material() -> bpy.types.Material:
    mat = bpy.data.materials.new("WaterFall")
    mat.use_nodes = True
    mat.blend_method = "BLEND"
    mat.shadow_method = "NONE"
    tree = mat.node_tree
    assert tree is not None
    for node in list(tree.nodes):
        tree.nodes.remove(node)
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    em = tree.nodes.new("ShaderNodeEmission")
    tr = tree.nodes.new("ShaderNodeBsdfTransparent")
    mix = tree.nodes.new("ShaderNodeMixShader")
    em.inputs["Color"].default_value = (0.28, 0.72, 1.0, 1.0)
    em.inputs["Strength"].default_value = 2.4
    mix.inputs["Fac"].default_value = 0.42
    tree.links.new(tr.outputs["BSDF"], mix.inputs[1])
    tree.links.new(em.outputs["Emission"], mix.inputs[2])
    tree.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return mat


def make_fall_mesh() -> bpy.types.Mesh:
    # Flat ribbon, tapering into the void. Not a tube, not a lake.
    z0, z1 = 0.02, -42.0
    w0, w1 = 0.55, 0.12
    verts = [
        (-w0, 0.0, z0),
        (w0, 0.0, z0),
        (w1, 0.0, z1),
        (-w1, 0.0, z1),
    ]
    mesh = bpy.data.meshes.new("FallRibbon")
    mesh.from_pydata(verts, [], [(0, 1, 2, 3)])
    mesh.update()
    return mesh


def build_water(col: bpy.types.Collection, half: float, notches: list[float]) -> None:
    mat = water_material()
    mesh = make_fall_mesh()
    for i, ang in enumerate(notches):
        r = square_radius(ang, half) - 0.4
        x = math.cos(ang) * r
        y = math.sin(ang) * r
        ob = bpy.data.objects.new(f"Fall_{i:02d}", mesh)
        ob.location = (x, y, 0.0)
        ob.rotation_euler = (0.0, 0.0, ang + math.pi * 0.5)
        ob.data.materials.append(mat)
        col.objects.link(ob)
    log(f"waterfalls {len(notches)}")


def stack_column(
    rock: bpy.types.Object,
    col: bpy.types.Collection,
    rng: random.Random,
    x: float,
    y: float,
    z_top: float,
    outward: tuple[float, float],
    scale0: float,
    depth_m: float,
    tag: str,
) -> int:
    placed = 0
    z = z_top
    bottom = z_top - depth_m
    n = 0
    while z > bottom - 0.5:
        sc = scale0 * rng.uniform(0.82, 1.28)
        step = sc * 1.55
        ox = x + outward[0] * rng.uniform(-0.2, 1.0) + rng.uniform(-0.8, 0.8)
        oy = y + outward[1] * rng.uniform(-0.2, 1.0) + rng.uniform(-0.8, 0.8)
        spawn(
            rock,
            col,
            f"Cliff_{tag}_{n:02d}",
            (ox, oy, z - sc * 0.35),
            (
                rng.uniform(0, math.tau),
                rng.uniform(0, math.tau),
                rng.uniform(0, math.tau),
            ),
            (sc * rng.uniform(0.9, 1.15), sc * rng.uniform(0.9, 1.2), sc * rng.uniform(0.75, 1.25)),
        )
        placed += 1
        n += 1
        z -= step * rng.uniform(0.72, 0.95)
        if n > 14:
            break
    return placed


def build_cliff(rock: bpy.types.Object, col: bpy.types.Collection, rng: random.Random, half: float) -> int:
    total = 0
    sides = (
        ("N", 0.0, 1.0),
        ("S", 0.0, -1.0),
        ("E", 1.0, 0.0),
        ("W", -1.0, 0.0),
    )
    for name, nx, ny in sides:
        t = -half
        idx = 0
        while t < half - 1.0:
            width = rng.uniform(5.2, 9.4)
            depth = rng.uniform(14.0, 28.0)
            sc = rng.uniform(2.6, 4.4)
            mid = t + width * 0.5
            if abs(mid) > half + 1.0:
                break
            if name in ("N", "S"):
                x, y = mid, ny * half
            else:
                x, y = nx * half, mid
            # Skip a few gaps so it is not a honeycomb fence.
            if rng.random() < 0.08:
                t += width * rng.uniform(0.5, 0.9)
                continue
            total += stack_column(
                rock,
                col,
                rng,
                x,
                y,
                -0.15,
                (nx * 2.4, ny * 2.4),
                sc,
                depth,
                f"{name}{idx:02d}",
            )
            t += width * rng.uniform(0.72, 1.02)
            idx += 1
        # Corner mass so the square does not look sliced.
        cx = nx * half * (0.92 if nx else rng.choice((-0.92, 0.92)))
        cy = ny * half * (0.92 if ny else rng.choice((-0.92, 0.92)))
        total += stack_column(rock, col, rng, cx, cy, -0.2, (nx * 2.0, ny * 2.0), 3.8, 22.0, f"{name}C")
    log(f"cliff rocks {total}")
    return total


def build_undercut(rock: bpy.types.Object, col: bpy.types.Collection, rng: random.Random, half: float) -> int:
    total = 0
    for layer in range(LAYERS):
        t = layer / float(LAYERS - 1)
        # Shrink, but stop well before a spike. Bottom stays a ripped mass.
        shrink = 1.0 - 0.52 * (t ** 0.75)
        layer_half = half * shrink
        z = -6.0 - t * 38.0
        count = int(18 + (1.0 - t) * 22)
        for k in range(count):
            ang = (k / count) * math.tau + rng.uniform(-0.08, 0.08)
            r = jagged_radius(ang, layer_half, rng) * rng.uniform(0.78, 1.04)
            if t > 0.55 and rng.random() < 0.18:
                r *= rng.uniform(0.45, 0.75)
            x = math.cos(ang) * r
            y = math.sin(ang) * r
            sc = rng.uniform(2.2, 4.1) * (1.05 - 0.25 * t)
            spawn(
                rock,
                col,
                f"Hang_{layer:02d}_{k:02d}",
                (x, y, z + rng.uniform(-1.8, 1.4)),
                (
                    rng.uniform(0, math.tau),
                    rng.uniform(0, math.tau),
                    rng.uniform(0, math.tau),
                ),
                (sc, sc * rng.uniform(0.85, 1.2), sc * rng.uniform(0.7, 1.15)),
            )
            total += 1
        if t > 0.62:
            for k in range(7):
                ang = rng.random() * math.tau
                r = rng.uniform(0.05, 0.55) * layer_half
                sc = rng.uniform(2.4, 3.8)
                spawn(
                    rock,
                    col,
                    f"Core_{layer:02d}_{k:02d}",
                    (math.cos(ang) * r, math.sin(ang) * r, z - rng.uniform(0.5, 4.0)),
                    (
                        rng.uniform(0, math.tau),
                        rng.uniform(0, math.tau),
                        rng.uniform(0, math.tau),
                    ),
                    sc,
                )
                total += 1
    log(f"undercut rocks {total}")
    return total


def setup_world() -> None:
    world = bpy.data.worlds.new("IslandSky")
    bpy.context.scene.world = world
    world.use_nodes = True
    tree = world.node_tree
    assert tree is not None
    bg = tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.42, 0.68, 0.95, 1.0)
    bg.inputs["Strength"].default_value = 0.85


def setup_lights() -> None:
    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun_data.energy = 7.5
    sun_data.angle = 0.008
    sun_data.color = (1.0, 0.98, 0.94)
    sun = bpy.data.objects.new("Sun", sun_data)
    sun.rotation_euler = (math.radians(48.0), math.radians(12.0), math.radians(38.0))
    bpy.context.scene.collection.objects.link(sun)

    fill_data = bpy.data.lights.new("Fill", "AREA")
    fill_data.energy = 450.0
    fill_data.size = 50.0
    fill_data.color = (0.55, 0.7, 0.95)
    fill = bpy.data.objects.new("Fill", fill_data)
    fill.location = (-30.0, -55.0, -10.0)
    fill.rotation_euler = (math.radians(72.0), 0.0, math.radians(-25.0))
    bpy.context.scene.collection.objects.link(fill)

    rim_data = bpy.data.lights.new("Rim", "AREA")
    rim_data.energy = 180.0
    rim_data.size = 30.0
    rim = bpy.data.objects.new("Rim", rim_data)
    rim.location = (40.0, 20.0, -25.0)
    rim.rotation_euler = (math.radians(110.0), 0.0, math.radians(60.0))
    bpy.context.scene.collection.objects.link(rim)


def setup_camera(name: str, loc: tuple[float, float, float], look: tuple[float, float, float]) -> bpy.types.Object:
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = 70.0
    cam_data.clip_end = 800.0
    cam = bpy.data.objects.new(name, cam_data)
    cam.location = loc
    direction = Vector(look) - Vector(loc)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(cam)
    return cam


def enable_cycles() -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.cycles.device = "GPU"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    used = False
    for kind in ("OPTIX", "CUDA", "HIP"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            for dev in prefs.devices:
                dev.use = True
                used = True
            if used:
                log(f"cycles device {kind}")
                return
        except Exception as exc:
            log(f"skip {kind}: {exc}")
    scene.cycles.device = "CPU"
    log("cycles device CPU")


def select_island(cols: list[bpy.types.Collection]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for col in cols:
        for ob in col.objects:
            ob.select_set(True)


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
    reset_scene()
    templates = new_collection("Templates")
    deck_col = new_collection("Deck")
    cliff_col = new_collection("Cliff")
    hang_col = new_collection("Undercut")
    water_col = new_collection("Water")

    log("import tile")
    tile = stash_template(import_mesh(TILE_GLB), templates, "TileTemplate")
    log("import rock")
    rock = stash_template(import_mesh(ROCK_GLB), templates, "RockTemplate")
    for slot in tile.material_slots:
        charcoalize(slot.material, 0.18, 0.82)
    for slot in rock.material_slots:
        charcoalize(slot.material, 0.12, 0.72)

    half = GRID * TILE_M * 0.5
    notches = notch_angles()
    build_deck(tile, deck_col, rng, half, notches)
    build_cliff(rock, cliff_col, rng, half)
    build_undercut(rock, hang_col, rng, half)
    build_water(water_col, half, notches)

    # Whole island yaw so the square reads as a toothed diamond in orbit.
    yaw = math.radians(18.0)
    for col in (deck_col, cliff_col, hang_col, water_col):
        for ob in col.objects:
            x, y, z = ob.location
            c, s = math.cos(yaw), math.sin(yaw)
            ob.location = (x * c - y * s, x * s + y * c, z)
            ob.rotation_euler.z += yaw

    setup_world()
    setup_lights()
    enable_cycles()
    cam_orbit = setup_camera("CamOrbit", (92.0, -96.0, 62.0), (0.0, 0.0, -8.0))
    cam_under = setup_camera("CamUnder", (70.0, -88.0, 8.0), (0.0, 0.0, -18.0))

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    render_cam(cam_orbit, OUT_PREVIEW)
    render_cam(cam_under, OUT_UNDER)

    select_island([deck_col, cliff_col, hang_col, water_col])
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        use_selection=True,
        export_cameras=False,
        export_lights=False,
        export_apply=False,
    )
    log(f"wrote {OUT_GLB}")
    log("done")


if __name__ == "__main__":
    main()
