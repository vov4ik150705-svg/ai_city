"""Front-facing stills of models/*.glb for the website. Does not touch the GLBs."""

from __future__ import annotations

import math
import os
import sys

import bpy
from mathutils import Vector

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS = os.path.join(REPO, "models")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "buildings")

SOURCES = (
    ("Agent Hub.glb", "agent_hub"),
    ("AI Research Center.glb", "ai_research_center"),
    ("Bank.glb", "bank"),
    ("City Hall.glb", "city_hall"),
    ("Clearing House.glb", "clearing_house"),
    ("Cloud Campus.glb", "cloud_campus"),
    ("Data Center.glb", "data_center"),
    ("Drone Depot.glb", "drone_depot"),
    ("Energy Plant.glb", "energy_plant"),
    ("Exchange.glb", "exchange"),
    ("Finance Tower.glb", "finance_tower"),
    ("Flagship Store.glb", "flagship_store"),
    ("Fleet Yard.glb", "fleet_yard"),
    ("Logistics Hub.glb", "logistics_hub"),
    ("neon-residence.glb", "neon_residence"),
    ("Power Node.glb", "power_node"),
    ("Retail_complex.glb", "retail_complex"),
    ("Robotics Lab.glb", "robotics_lab"),
    ("Workshop.glb", "workshop"),
)

# Which way the doorway/logo faces. Does not change the shared 3/4 orbit.
FRONT_YAW_DEG: dict[str, float] = {
    "bank": 90.0,
    "data_center": 90.0,
}

# One product-shot camera for every building: front + right wall.
# elev34 stills kept in buildings_elev34/.
THREE_QUARTER_YAW_DEG = 36.0
ELEVATION_DEG = 26.0
ELEVATION = math.radians(ELEVATION_DEG)
FOV = 32.0
MARGIN = 1.12
RES = 1024
OPAQUE_PIXEL_MIN = 1000


def log(msg: str) -> None:
    print(msg, flush=True)


def import_new_objects(path: str) -> list[bpy.types.Object]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    if not any(o.type == "MESH" for o in new):
        raise RuntimeError(f"no mesh in {path}")
    return new


def world_bounds(meshes: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    bpy.context.view_layer.update()
    pts: list[Vector] = []
    for ob in meshes:
        for corner in ob.bound_box:
            pts.append(ob.matrix_world @ Vector(corner))
    if not pts:
        raise RuntimeError("empty bounds")
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def setup_world_and_lights(scene: bpy.types.Scene) -> None:
    world = bpy.data.worlds.new("WebWorld")
    scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    bg = nodes.new("ShaderNodeBackground")
    bg.inputs[0].default_value = (0.82, 0.85, 0.90, 1.0)
    bg.inputs[1].default_value = 0.55
    out = nodes.new("ShaderNodeOutputWorld")
    links.new(bg.outputs[0], out.inputs[0])

    key = bpy.data.lights.new("Key", "SUN")
    key.color = (1.0, 0.96, 0.90)
    key.energy = 4.2
    key.angle = math.radians(6.0)
    key_ob = bpy.data.objects.new("Key", key)
    key_ob.rotation_euler = (math.radians(48.0), 0.0, math.radians(28.0))
    scene.collection.objects.link(key_ob)

    fill = bpy.data.lights.new("Fill", "SUN")
    fill.color = (0.78, 0.86, 1.0)
    fill.energy = 1.4
    fill.angle = math.radians(24.0)
    fill_ob = bpy.data.objects.new("Fill", fill)
    fill_ob.rotation_euler = (math.radians(70.0), 0.0, math.radians(-130.0))
    scene.collection.objects.link(fill_ob)

    rim = bpy.data.lights.new("Rim", "SUN")
    rim.color = (0.90, 0.94, 1.0)
    rim.energy = 1.8
    rim.angle = math.radians(10.0)
    rim_ob = bpy.data.objects.new("Rim", rim)
    rim_ob.rotation_euler = (math.radians(18.0), 0.0, math.radians(160.0))
    scene.collection.objects.link(rim_ob)


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
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.render.use_file_extension = True
    scene.use_nodes = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.05
    eevee = getattr(scene, "eevee", None)
    if eevee is not None:
        if hasattr(eevee, "taa_render_samples"):
            eevee.taa_render_samples = 16
        if hasattr(eevee, "use_shadows"):
            eevee.use_shadows = True


def camera_for_bounds(mn: Vector, mx: Vector, front_yaw_deg: float) -> tuple[Vector, Vector]:
    center = (mn + mx) * 0.5
    size = mx - mn
    half = size * 0.5
    fit = math.sqrt(half.x * half.x + half.y * half.y + half.z * half.z)
    if fit < 1.0:
        fit = 1.0
    radius = (fit / math.tan(math.radians(FOV) * 0.5)) * MARGIN
    horiz = radius * math.cos(ELEVATION)
    vert = radius * math.sin(ELEVATION)
    if size.x >= size.y:
        axis = Vector((0.0, -1.0, 0.0))
    else:
        axis = Vector((-1.0, 0.0, 0.0))
    yaw = math.radians(front_yaw_deg + THREE_QUARTER_YAW_DEG)
    axis = Vector(
        (
            axis.x * math.cos(yaw) - axis.y * math.sin(yaw),
            axis.x * math.sin(yaw) + axis.y * math.cos(yaw),
            0.0,
        )
    )
    loc = Vector((center.x, center.y, center.z)) + axis * horiz + Vector((0.0, 0.0, vert))
    return loc, center


def place_camera(scene: bpy.types.Scene, loc: Vector, target: Vector) -> bpy.types.Object:
    cam_data = bpy.data.cameras.new("FrontCam")
    cam_data.lens_unit = "FOV"
    cam_data.angle = math.radians(FOV)
    dist = (loc - target).length
    cam_data.clip_start = max(0.1, dist * 0.01)
    cam_data.clip_end = max(200000.0, dist * 20.0)
    cam = bpy.data.objects.new("FrontCam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (target - loc).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    return cam


def remove_object(ob: bpy.types.Object) -> None:
    data = ob.data
    bpy.data.objects.remove(ob, do_unlink=True)
    if data is not None and data.users == 0:
        if isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)
        elif isinstance(data, bpy.types.Camera):
            bpy.data.cameras.remove(data)


def purge_job_objects(imported: list[bpy.types.Object], cam: bpy.types.Object | None) -> None:
    for ob in list(imported):
        if ob.name in bpy.data.objects:
            remove_object(ob)
    if cam is not None and cam.name in bpy.data.objects:
        remove_object(cam)
    for img in list(bpy.data.images):
        if img.users == 0:
            bpy.data.images.remove(img)
    for mat in list(bpy.data.materials):
        if mat.users == 0:
            bpy.data.materials.remove(mat)


def png_opaque_count(path: str) -> int:
    img = bpy.data.images.load(path)
    try:
        alpha = img.pixels[:][3::4]
        return sum(1 for a in alpha if a > 0.03)
    finally:
        bpy.data.images.remove(img)


def reset_scene() -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    if scene is None:
        raise RuntimeError("no scene after factory reset")
    setup_eevee(scene)
    setup_world_and_lights(scene)
    return scene


def render_one(scene: bpy.types.Scene, src_name: str, slug: str) -> None:
    src = os.path.join(MODELS, src_name)
    dest = os.path.join(OUT, f"{slug}.png")
    if not os.path.isfile(src):
        raise RuntimeError(f"missing {src}")
    imported: list[bpy.types.Object] = []
    cam: bpy.types.Object | None = None
    try:
        imported = import_new_objects(src)
        for ob in imported:
            if ob.type in {"LIGHT", "CAMERA"}:
                ob.hide_render = True
        mn, mx = world_bounds([o for o in imported if o.type == "MESH"])
        span = mx - mn
        log(f"  aabb={tuple(round(v, 1) for v in span)}")
        loc, target = camera_for_bounds(mn, mx, FRONT_YAW_DEG.get(slug, 0.0))
        cam = place_camera(scene, loc, target)
        log(f"  orbit elev={ELEVATION_DEG} yaw3q={THREE_QUARTER_YAW_DEG} front={FRONT_YAW_DEG.get(slug, 0.0)}")
        scene.render.filepath = dest
        bpy.ops.render.render(write_still=True)
        opaque = png_opaque_count(dest)
        if opaque < OPAQUE_PIXEL_MIN:
            raise RuntimeError(f"empty still: {dest} opaque={opaque}")
        log(f"wrote {slug}.png opaque={opaque}")
    finally:
        purge_job_objects(imported, cam)


def selected(only: set[str]) -> list[tuple[str, str]]:
    if not only:
        return list(SOURCES)
    picked = [(name, slug) for name, slug in SOURCES if slug in only]
    missing = only - {slug for _, slug in picked}
    if missing:
        raise RuntimeError(f"unknown slug: {sorted(missing)}")
    return picked


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    argv = sys.argv
    extra = argv[argv.index("--") + 1 :] if "--" in argv else []
    only = {token.strip() for arg in extra for token in arg.split(",") if token.strip()}
    jobs = selected(only)
    failed: list[str] = []
    for src_name, slug in jobs:
        log(f"render {slug} <- {src_name}")
        try:
            scene = reset_scene()
            render_one(scene, src_name, slug)
        except Exception as exc:
            log(f"FAIL {slug}: {exc}")
            failed.append(slug)
    if failed:
        raise SystemExit("render failed: " + ", ".join(failed))
    log(f"ok {len(jobs)} stills -> {OUT}")


if __name__ == "__main__":
    main()
