"""Headless EEVEE stills of diet variants. One building-level per Blender process.

Does not save the blend. Does not touch models/ or island.blend.
"""

from __future__ import annotations

import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
RUNTIME = os.path.join(ROOT, "runtime")
SHOTS = os.path.join(RUNTIME, "_diet_shots")
DECODED = os.path.join(SHOTS, "_decoded")

BUILDINGS = ("nvidia_tower", "bank", "city_hall", "clearinghouse")
LEVELS = ("src", "8k", "4k", "2k")

THETA = math.radians(40.0)
PHI = math.radians(62.0)
FOV = 45.0
MARGIN = 1.28
RES = 512
BG = (0.72, 0.73, 0.74, 1.0)


def log(msg: str) -> None:
    print(msg, flush=True)


def import_mesh(path: str) -> bpy.types.Object:
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
    if ob is None:
        raise RuntimeError(f"join failed for {path}")
    for o in new:
        if o != ob and o.name in bpy.data.objects:
            bpy.data.objects.remove(o, do_unlink=True)
    return ob


def world_bounds(ob: bpy.types.Object) -> tuple[Vector, Vector]:
    bpy.context.view_layer.update()
    pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
    if not pts:
        raise RuntimeError(f"{ob.name} has no vertices")
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def setup_world_and_lights(scene: bpy.types.Scene) -> None:
    world = bpy.data.worlds.new("DietWorld")
    scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    bg = nodes.new("ShaderNodeBackground")
    bg.inputs[0].default_value = BG
    bg.inputs[1].default_value = 1.0
    out = nodes.new("ShaderNodeOutputWorld")
    links.new(bg.outputs[0], out.inputs[0])

    hemi = bpy.data.lights.new("Hemi", "SUN")
    hemi.color = (0.843, 0.906, 0.961)
    hemi.energy = 2.0
    hemi_ob = bpy.data.objects.new("Hemi", hemi)
    hemi_ob.rotation_euler = (math.radians(50.0), 0.0, math.radians(20.0))
    scene.collection.objects.link(hemi_ob)

    sun = bpy.data.lights.new("Sun", "SUN")
    sun.color = (1.0, 0.949, 0.847)
    sun.energy = 4.0
    sun.angle = math.radians(8.0)
    sun_ob = bpy.data.objects.new("Sun", sun)
    sun_ob.location = (2400.0, -1400.0, 4200.0)
    direction = Vector((-2400.0, 1400.0, -4200.0))
    sun_ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(sun_ob)


def setup_eevee(scene: bpy.types.Scene) -> None:
    engines = {item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    if "BLENDER_EEVEE_NEXT" in engines:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    elif "BLENDER_EEVEE" in engines:
        scene.render.engine = "BLENDER_EEVEE"
    else:
        raise RuntimeError(f"EEVEE missing, have {sorted(engines)}")
    scene.render.resolution_x = RES
    scene.render.resolution_y = RES
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    eevee = getattr(scene, "eevee", None)
    if eevee is not None:
        if hasattr(eevee, "taa_render_samples"):
            eevee.taa_render_samples = 16
        if hasattr(eevee, "use_shadows"):
            eevee.use_shadows = True


def camera_for_bounds(mn: Vector, mx: Vector) -> tuple[Vector, Vector, float]:
    center = (mn + mx) * 0.5
    size = mx - mn
    half = max(size.x, size.y, size.z, 1.0) * 0.5
    radius = (half / math.tan(math.radians(FOV) * 0.5)) * MARGIN
    offset = Vector(
        (
            radius * math.sin(PHI) * math.sin(THETA),
            -radius * math.sin(PHI) * math.cos(THETA),
            radius * math.cos(PHI),
        )
    )
    return center + offset, center, radius


def place_camera(scene: bpy.types.Scene, loc: Vector, target: Vector) -> None:
    cam_data = bpy.data.cameras.new("DietCam")
    cam_data.lens_unit = "FOV"
    cam_data.angle = math.radians(FOV)
    cam_data.clip_start = max(1.0, (loc - target).length * 0.01)
    cam_data.clip_end = max(200000.0, (loc - target).length * 20.0)
    cam = bpy.data.objects.new("DietCam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (target - loc).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam


def reset_empty() -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    if scene is None:
        raise RuntimeError("no scene after factory reset")
    return scene


def bounds_of(path: str) -> tuple[Vector, Vector]:
    reset_empty()
    ob = import_mesh(path)
    return world_bounds(ob)


def render_pair(src_path: str, glb_path: str, dest: str) -> None:
    mn, mx = bounds_of(src_path)
    cam_loc, cam_target, radius = camera_for_bounds(mn, mx)
    log(f"cam radius {radius:.1f} target {tuple(round(v, 1) for v in cam_target)}")

    scene = reset_empty()
    setup_eevee(scene)
    setup_world_and_lights(scene)
    import_mesh(glb_path)
    place_camera(scene, cam_loc, cam_target)
    scene.render.filepath = dest
    bpy.ops.render.render(write_still=True)
    if not os.path.isfile(dest) or os.path.getsize(dest) < 80000:
        raise RuntimeError(f"render looks empty: {dest} size={os.path.getsize(dest) if os.path.isfile(dest) else 0}")
    log(f"wrote {dest} {os.path.getsize(dest)} B")


def main() -> None:
    os.makedirs(SHOTS, exist_ok=True)
    argv = sys.argv
    extra = argv[argv.index("--") + 1 :] if "--" in argv else []
    if len(extra) != 2:
        raise RuntimeError("usage: blender --python _diet_render.py -- <slug> <level>")
    slug, level = extra
    if slug not in BUILDINGS or level not in LEVELS:
        raise RuntimeError(f"bad args {extra}")
    src = os.path.join(DECODED, "src", f"{slug}.glb")
    glb = os.path.join(DECODED, level, f"{slug}.glb")
    dest = os.path.join(SHOTS, f"{slug}_{level}.png")
    if not os.path.isfile(src) or not os.path.isfile(glb):
        raise RuntimeError(f"missing {src} or {glb}")
    render_pair(src, glb, dest)


if __name__ == "__main__":
    main()
