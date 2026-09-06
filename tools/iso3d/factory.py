"""Corporator isometric 3D factory (Blender 4.5, bpy).

Offline art: one orthographic camera, one light rig, procedural buildings
matching mockup extracts in assets/buildings/. Does not touch art/raw.

  blender --background --python tools/iso3d/factory.py -- --id energy_plant
  blender --background --python tools/iso3d/factory.py -- --all
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from buildings import BUILDERS, RIG, make_mats  # noqa: E402

ROOT = HERE.parents[1]
OUT = ROOT / "assets" / "_iso3d" / "out"

ISO_ELEV_DEG = 35.264
ISO_AZIM_DEG = 45.0
RES = 768
SKY = (0.42, 0.46, 0.52, 1.0)


def argv_after_dash() -> list[str]:
    if "--" in sys.argv:
        return sys.argv[sys.argv.index("--") + 1 :]
    return []


def clear_scene() -> None:
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for item in list(coll):
            coll.remove(item)


def setup_world_and_render() -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = RES
    scene.render.resolution_y = RES
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.filepath = str(OUT / "tmp")
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.15
    scene.view_settings.gamma = 1.0
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.cycles.device = "GPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.refresh_devices()
        for compute in ("OPTIX", "CUDA", "HIP"):
            prefs.compute_device_type = compute
            if any(d.type in ("CUDA", "OPTIX", "HIP") for d in prefs.devices):
                break
        for device in prefs.devices:
            device.use = True
    except Exception:
        scene.cycles.device = "CPU"
        scene.cycles.samples = 24
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    assert nt is not None
    bg = nt.nodes.get("Background")
    if bg is not None:
        bg.inputs["Color"].default_value = SKY
        bg.inputs["Strength"].default_value = 0.55


def _aim(ob: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - ob.location
    if direction.length < 1e-6:
        return
    ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_camera_light(look_z: float, ortho: float) -> None:
    scene = bpy.context.scene
    elev = math.radians(ISO_ELEV_DEG)
    azim = math.radians(ISO_AZIM_DEG)
    dist = 28.0
    lx = -dist * math.cos(elev) * math.cos(azim)
    ly = -dist * math.cos(elev) * math.sin(azim)
    lz = dist * math.sin(elev)
    target = (0.0, 0.0, look_z)

    cam_data = bpy.data.cameras.new("iso_cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho
    cam_data.clip_start = 0.1
    cam_data.clip_end = 200.0
    cam = bpy.data.objects.new("iso_cam", cam_data)
    cam.location = (lx, ly, lz)
    scene.collection.objects.link(cam)
    _aim(cam, target)
    scene.camera = cam

    sun_data = bpy.data.lights.new("key_sun", "SUN")
    sun_data.energy = 4.0
    sun_data.angle = math.radians(12.0)
    sun = bpy.data.objects.new("key_sun", sun_data)
    sun.location = (-18.0, -6.0, 22.0)
    scene.collection.objects.link(sun)
    _aim(sun, target)

    fill_data = bpy.data.lights.new("fill", "SUN")
    fill_data.energy = 0.8
    fill_data.angle = math.radians(25.0)
    fill = bpy.data.objects.new("fill", fill_data)
    fill.location = (12.0, -8.0, 14.0)
    scene.collection.objects.link(fill)
    _aim(fill, target)


def composite_magenta(src: Path, dest: Path, *, pad: int = 12) -> None:
    img = bpy.data.images.load(str(src), check_existing=False)
    w, h = int(img.size[0]), int(img.size[1])
    px = list(img.pixels)
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        row = y * w
        for x in range(w):
            i = (row + x) * 4
            if px[i + 3] >= 0.08:
                if x < min_x:
                    min_x = x
                if y < min_y:
                    min_y = y
                if x > max_x:
                    max_x = x
                if y > max_y:
                    max_y = y
    if max_x < min_x:
        bpy.data.images.remove(img)
        return
    min_x = max(0, min_x - pad)
    min_y = max(0, min_y - pad)
    max_x = min(w - 1, max_x + pad)
    max_y = min(h - 1, max_y + pad)
    cw, ch = max_x - min_x + 1, max_y - min_y + 1
    cropped = bpy.data.images.new("crop", cw, ch, alpha=True)
    out = [0.0] * (cw * ch * 4)
    for y in range(ch):
        sy = min_y + y
        for x in range(cw):
            si = ((sy * w) + (min_x + x)) * 4
            di = (y * cw + x) * 4
            a = px[si + 3]
            if a < 0.08:
                out[di], out[di + 1], out[di + 2], out[di + 3] = 1.0, 0.0, 1.0, 1.0
            else:
                out[di : di + 4] = px[si : si + 4]
                out[di + 3] = 1.0
    cropped.pixels[:] = out
    cropped.filepath_raw = str(dest)
    cropped.file_format = "PNG"
    cropped.save()
    bpy.data.images.remove(cropped)
    bpy.data.images.remove(img)


def render_id(asset_id: str) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    clear_scene()
    setup_world_and_render()
    mats = make_mats()
    BUILDERS[asset_id](mats)
    rig = RIG[asset_id]
    setup_camera_light(look_z=rig["look_z"], ortho=rig["ortho"])
    ref_png = ROOT / "assets" / "buildings" / f"{asset_id}.png"
    if ref_png.exists() and bpy.context.scene.camera is not None:
        cam = bpy.context.scene.camera
        cam.data.show_background_images = True
        bg = cam.data.background_images.new()
        bg.image = bpy.data.images.load(str(ref_png), check_existing=True)
        bg.alpha = 0.5
    raw = OUT / f"{asset_id}_rgba.png"
    final = OUT / f"{asset_id}.png"
    scene = bpy.context.scene
    scene.render.filepath = str(raw)
    bpy.context.view_layer.update()
    print(
        f"render {asset_id}: objects={len(scene.objects)} cam={scene.camera}",
        flush=True,
    )
    bpy.ops.render.render(write_still=True)
    composite_magenta(raw, final)
    blend = OUT / f"{asset_id}.blend"
    try:
        bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    except Exception as exc:
        print(f"blend save skipped: {exc}", flush=True)
    print(f"wrote {final}", flush=True)
    return final


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--id", default="energy_plant", choices=sorted(BUILDERS))
    p.add_argument("--all", action="store_true")
    args = p.parse_args(argv_after_dash())
    if args.all:
        blender = bpy.app.binary_path
        script = str(HERE / "factory.py")
        rc = 0
        for i in BUILDERS:
            # Fresh process: Eevee Next shadow pages leak across in-process frames.
            r = __import__("subprocess").run(
                [blender, "--background", "--python", script, "--", "--id", i]
            )
            rc = rc or r.returncode
        raise SystemExit(rc)
    render_id(args.id)


if __name__ == "__main__":
    main()
