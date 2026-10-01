import bpy

sc = bpy.context.scene
cam = bpy.data.objects.get("CamOrbit")
if cam is None:
    raise RuntimeError("no CamOrbit")
sc.camera = cam
sc.render.filepath = r"C:\Users\sk640\ai_city\art\island_v3\preview_orbit.png"
bpy.ops.render.render(write_still=True)
print("wrote orbit preview")
