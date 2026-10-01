"""Remove every mesh except Island from the current blend, then re-export."""

from __future__ import annotations

import os

import bpy

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_BLEND = os.path.join(ROOT, "island.blend")
OUT_GLB = os.path.join(ROOT, "island.glb")
OUT_PREVIEW = os.path.join(ROOT, "preview_orbit.png")
OUT_UNDER = os.path.join(ROOT, "preview_under.png")

island = bpy.data.objects.get("Island")
if island is None:
    names = ", ".join(sorted(o.name for o in bpy.data.objects if o.type == "MESH"))
    raise RuntimeError(f"no Island object; meshes: {names}")

removed = []
for ob in list(bpy.data.objects):
    if ob.type == "MESH" and ob.name != "Island":
        removed.append(ob.name)
        bpy.data.objects.remove(ob, do_unlink=True)
bpy.data.orphans_purge(do_recursive=True)
bpy.data.orphans_purge(do_recursive=True)
print("stripped", ", ".join(removed) if removed else "(none)")

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

bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print("wrote empty island")
