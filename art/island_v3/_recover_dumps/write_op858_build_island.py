"""Live Corporator island.

The plaza mesh lives in island.blend (7200 m, polar grid, no buildings).
Running this script re-exports that mesh. It does not regenerate the hull.
"""

from __future__ import annotations

import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_BLEND = os.path.join(ROOT, "island.blend")
OUT_GLB = os.path.join(ROOT, "island.glb")
OUT_PREVIEW = os.path.join(ROOT, "preview_orbit.png")
OUT_UNDER = os.path.join(ROOT, "preview_under.png")
SRC = os.path.join(ROOT, "source")
PLAZA_Z = 0.06
ISLAND_SCALE = 10.0
BUILDING_SCALE = 4.0
HALL_HEIGHT = 280.0 * BUILDING_SCALE
MSFT_HEIGHT = 230.0 * BUILDING_SCALE
DISTRICT_SPAN = 140.0 * BUILDING_SCALE
YARD_SPAN = 170.0 * BUILDING_SCALE
ARCH_SPAN = 160.0 * BUILDING_SCALE
BANK_SPAN = 130.0 * BUILDING_SCALE
HALF = 360.0 * ISLAND_SCALE


def log(msg: str) -> None:
    print(msg, flush=True)


def _ixy(x: float, y: float) -> tuple[float, float]:
    return (x * ISLAND_SCALE, y * ISLAND_SCALE)


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


def export_glb(island: bpy.types.Object) -> None:
    for mat in island.data.materials:
        if mat is not None:
            mat.use_backface_culling = False
            mat.blend_method = "OPAQUE"
    bpy.ops.object.select_all(action="DESELECT")
    island.hide_set(False)
    island.hide_viewport = False
    island.select_set(True)
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
    if not os.path.isfile(OUT_BLEND):
        raise RuntimeError(f"missing {OUT_BLEND}")
    bpy.ops.wm.open_mainfile(filepath=OUT_BLEND)
    island = bpy.data.objects.get("Island")
    if island is None:
        raise RuntimeError("no Island object in blend")
    for ob in list(bpy.data.objects):
        if ob.type == "MESH" and ob.name != "Island":
            bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.orphans_purge(do_recursive=True)
    orbit = bpy.data.objects.get("CamOrbit")
    under = bpy.data.objects.get("CamUnder")
    if orbit is None or under is None:
        raise RuntimeError("missing CamOrbit/CamUnder")
    sc = bpy.context.scene
    sc.camera = orbit
    sc.render.filepath = OUT_PREVIEW
    bpy.ops.render.render(write_still=True)
    sc.camera = under
    sc.render.filepath = OUT_UNDER
    bpy.ops.render.render(write_still=True)
    export_glb(island)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    log("empty island, no buildings")


if __name__ == "__main__":
    main()
