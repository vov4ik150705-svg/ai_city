from __future__ import annotations

import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(ROOT, "source", "power_node.glb")
bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=path)
new = [o for o in bpy.data.objects if o not in before]
meshes = [o for o in new if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.context.view_layer.update()
pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
xs = [p.x for p in pts]
ys = [p.y for p in pts]
zs = [p.z for p in pts]
dx, dy, dz = max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)
print(
    f"power_node verts {len(ob.data.vertices)} span {max(dx, dy):.3f} x {min(dx, dy):.3f} h {dz:.3f}",
    flush=True,
)
