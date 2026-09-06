"""Export thin runtime GLBs from the authoring blend.

Opens island.blend read-only. Never calls save_mainfile / save_as_mainfile.
Does not run the planter delete cycle. Runtime files are dieted separately
by diet_runtime.py.
"""

from __future__ import annotations

import os
import sys

import bpy

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from build_island import PLANTS  # noqa: E402

BLEND = os.path.join(ROOT, "island.blend")
RUNTIME = os.path.join(ROOT, "runtime")
BUILDINGS_DIR = os.path.join(RUNTIME, "buildings")
MASS_GLB = os.path.join(RUNTIME, "island_mass.glb")

INST_PARENTS: tuple[str, ...] = (
    "inst_tree",
    "inst_lamp",
    "inst_fence",
    "inst_stair",
    "inst_sign",
    "inst_cloud",
)
SKIP_TYPES = {"CAMERA", "LIGHT"}
SKIP_NAMES = {"CamOrbit", "CamUnder", "Sun", "Fill", "Bounce"}
KEEP_TEX_SOCKETS = {"Base Color", "Emission Color", "Emission", "Alpha"}
TEXTURE_MAX_PX = 1024


def log(msg: str) -> None:
    print(msg, flush=True)


def plant_slug(name: str) -> str:
    out: list[str] = []
    for i, ch in enumerate(name):
        if ch.isupper() and i > 0:
            out.append("_")
        out.append(ch.lower())
    return "".join(out)


def plant_names() -> set[str]:
    return {row[0] for row in PLANTS}


def plant_slugs() -> dict[str, str]:
    return {row[0]: plant_slug(row[0]) for row in PLANTS}


def open_blend_readonly() -> None:
    if not os.path.isfile(BLEND):
        raise RuntimeError(f"missing {BLEND}")
    current = os.path.normcase(os.path.abspath(bpy.data.filepath or ""))
    want = os.path.normcase(os.path.abspath(BLEND))
    if current != want:
        bpy.ops.wm.open_mainfile(filepath=BLEND)
    log(f"opened {BLEND} (read-only, will not save)")


def ensure_inst_parents() -> list[str]:
    created: list[str] = []
    scene = bpy.context.scene
    if scene is None:
        raise RuntimeError("no scene")
    for name in INST_PARENTS:
        ob = bpy.data.objects.get(name)
        if ob is not None:
            continue
        ob = bpy.data.objects.new(name, None)
        ob.empty_display_type = "PLAIN_AXES"
        scene.collection.objects.link(ob)
        created.append(name)
    if created:
        log(f"created empty inst parents in memory: {created}")
    return created


def select_only(obs: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    active = None
    for ob in obs:
        ob.hide_set(False)
        ob.hide_viewport = False
        ob.hide_render = False
        ob.select_set(True)
        active = ob
    if active is not None:
        bpy.context.view_layer.objects.active = active


def drop_extra_texture_links(ob: bpy.types.Object) -> None:
    if ob.type != "MESH":
        return
    for mat in ob.data.materials:
        if mat is None or mat.node_tree is None:
            continue
        for link in list(mat.node_tree.links):
            to_sock = link.to_socket.name if link.to_socket is not None else ""
            from_node = link.from_node
            if from_node is None or from_node.type != "TEX_IMAGE":
                continue
            if to_sock not in KEEP_TEX_SOCKETS:
                mat.node_tree.links.remove(link)


def scale_object_images(ob: bpy.types.Object, max_px: int) -> None:
    if ob.type != "MESH":
        return
    seen: set[int] = set()
    for mat in ob.data.materials:
        if mat is None or mat.node_tree is None:
            continue
        for node in mat.node_tree.nodes:
            if node.type != "TEX_IMAGE" or node.image is None:
                continue
            img = node.image
            key = img.as_pointer()
            if key in seen:
                continue
            seen.add(key)
            width, height = int(img.size[0]), int(img.size[1])
            if width <= max_px and height <= max_px:
                continue
            scale = max_px / max(width, height)
            img.scale(max(1, int(width * scale)), max(1, int(height * scale)))
            log(f"scaled {img.name} {width}x{height} -> {img.size[0]}x{img.size[1]}")


def thin_building_textures(ob: bpy.types.Object) -> None:
    drop_extra_texture_links(ob)
    scale_object_images(ob, TEXTURE_MAX_PX)


def export_selected(filepath: str) -> None:
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    kwargs: dict[str, object] = {
        "filepath": filepath,
        "export_format": "GLB",
        "use_selection": True,
        "export_cameras": False,
        "export_lights": False,
    }
    optionals: list[tuple[str, object]] = [
        ("export_yup", True),
        ("export_gpu_instances", True),
        ("export_attributes", True),
        ("export_vertex_color", "MATERIAL"),
        ("export_image_format", "WEBP"),
        ("export_image_quality", 75),
    ]
    extras = dict(optionals)
    last_error: TypeError | None = None
    while True:
        try:
            bpy.ops.export_scene.gltf(**kwargs, **extras)
            log(f"wrote {filepath}")
            return
        except TypeError as exc:
            last_error = exc
            if not extras:
                break
            dropped, _ = extras.popitem()
            log(f"export dropped {dropped}: {exc}")
    raise RuntimeError(f"gltf export failed for {filepath}: {last_error}")


def mass_objects() -> list[bpy.types.Object]:
    buildings = plant_names()
    out: list[bpy.types.Object] = []
    for ob in bpy.data.objects:
        if ob.type in SKIP_TYPES or ob.name in SKIP_NAMES:
            continue
        if ob.name in buildings:
            continue
        if ob.name == "Island" or ob.name.startswith("anchor_") or ob.name.startswith("inst_"):
            out.append(ob)
            continue
        if ob.type == "MESH":
            out.append(ob)
    if not any(ob.name == "Island" for ob in out):
        raise RuntimeError("Island mesh missing from mass export set")
    return out


def export_mass() -> None:
    obs = mass_objects()
    log("mass objects: " + ", ".join(ob.name for ob in obs))
    select_only(obs)
    export_selected(MASS_GLB)


def export_buildings() -> None:
    slugs = plant_slugs()
    os.makedirs(BUILDINGS_DIR, exist_ok=True)
    missing: list[str] = []
    for name, slug in slugs.items():
        ob = bpy.data.objects.get(name)
        if ob is None:
            missing.append(name)
            continue
        dest = os.path.join(BUILDINGS_DIR, f"{slug}.glb")
        thin_building_textures(ob)
        select_only([ob])
        export_selected(dest)
    if missing:
        raise RuntimeError(f"missing plant objects: {missing}")


def main() -> None:
    open_blend_readonly()
    island = bpy.data.objects.get("Island")
    if island is None:
        raise RuntimeError("no Island object in blend")
    names = plant_names()
    present = {ob.name for ob in bpy.data.objects}
    missing = sorted(names - present)
    if missing:
        raise RuntimeError(f"blend missing plants: {missing}")
    ensure_inst_parents()
    export_mass()
    export_buildings()
    log("export_runtime done; blend not saved")


if __name__ == "__main__":
    main()
