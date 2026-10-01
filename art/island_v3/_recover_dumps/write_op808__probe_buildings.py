"""Print native AABB of plaza buildings. Art-only probe, not the island build."""

from __future__ import annotations

import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "source")
FILES = (
    "apple.glb",
    "bank_qu.glb",
    "city_hall_qu.glb",
    "coinbase.glb",
    "fleet_yard.glb",
    "microsoft.glb",
    "tesla.glb",
    "amazon.glb",
)


def bounds(ob: bpy.types.Object) -> tuple[Vector, Vector]:
    bpy.context.view_layer.update()
    pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


bpy.ops.wm.read_factory_settings(use_empty=True)
for name in FILES:
    path = os.path.join(SRC, name)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    if not meshes:
        print(f"{name} NO MESH", flush=True)
        continue
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    lo, hi = bounds(ob)
    dx, dy, dz = hi.x - lo.x, hi.y - lo.y, hi.z - lo.z
    print(
        f"{name} verts {len(ob.data.vertices)} "
        f"span {max(dx, dy):.3f} x {min(dx, dy):.3f} h {dz:.3f}",
        flush=True,
    )
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
