"""Export the Island mesh only into the 2026-09-05 canon snapshot.

Run against the current working blend:
  blender.exe art/island_v3/island.blend --background --python art/island_v3/_freeze_canon.py
Does not overwrite the working island.blend / island.glb.
"""

from __future__ import annotations

import os

import bpy

ROOT = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(ROOT, "snapshots", "canon_2026-09-05_island")
os.makedirs(DST, exist_ok=True)

island = bpy.data.objects.get("Island")
if island is None:
    names = ", ".join(sorted(o.name for o in bpy.data.objects if o.type == "MESH"))
    raise RuntimeError(f"no Island object; meshes: {names}")

for ob in bpy.data.objects:
    if ob.type == "MESH" and ob.name != "Island":
        ob.hide_render = True
        ob.hide_viewport = True
        ob.hide_set(True)

sc = bpy.context.scene
orbit = bpy.data.objects.get("CamOrbit")
under = bpy.data.objects.get("CamUnder")
if orbit is None or under is None:
    raise RuntimeError("missing CamOrbit/CamUnder")

sc.camera = orbit
sc.render.filepath = os.path.join(DST, "preview_orbit.png")
bpy.ops.render.render(write_still=True)

sc.camera = under
sc.render.filepath = os.path.join(DST, "preview_under.png")
bpy.ops.render.render(write_still=True)

for mat in island.data.materials:
    if mat is not None:
        mat.use_backface_culling = False
        mat.blend_method = "OPAQUE"

bpy.ops.object.select_all(action="DESELECT")
island.hide_set(False)
island.hide_viewport = False
island.select_set(True)
bpy.context.view_layer.objects.active = island
out_glb = os.path.join(DST, "island.glb")
kwargs = dict(
    filepath=out_glb,
    export_format="GLB",
    use_selection=True,
    export_cameras=False,
    export_lights=False,
)
try:
    bpy.ops.export_scene.gltf(export_vertex_color="MATERIAL", export_attributes=True, **kwargs)
except TypeError:
    bpy.ops.export_scene.gltf(**kwargs)

for ob in list(bpy.data.objects):
    if ob.type == "MESH" and ob.name != "Island":
        bpy.data.objects.remove(ob, do_unlink=True)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(DST, "island.blend"))
print(f"canon island faces {len(island.data.polygons)}")
print(f"wrote {DST}")
