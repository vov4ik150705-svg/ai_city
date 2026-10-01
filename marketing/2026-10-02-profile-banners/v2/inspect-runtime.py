import bpy,json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
root='C:/Users/sk640/ai_city/'
for p in ['marketing/2026-10-02-profile-banners/v2/mass-decoded.glb','models/City Hall.glb','models/Finance Tower.glb']:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=root+p)
 pts=[o.matrix_world@Vector(c) for o in bpy.context.scene.objects if o.type=='MESH' for c in o.bound_box]
 print('BOUNDS',p,[min(v[i]for v in pts)for i in range(3)],[max(v[i]for v in pts)for i in range(3)],flush=True)
 print('MATERIALS',[(m.name,[(n.type)for n in m.node_tree.nodes] if m.use_nodes else [])for m in bpy.data.materials],flush=True)
print('CYCLES_DEVICES',flush=True)
prefs=bpy.context.preferences.addons['cycles'].preferences
for kind in ['OPTIX','CUDA','HIP']:
 try:prefs.compute_device_type=kind;prefs.get_devices();print(kind,[(d.name,d.type)for d in prefs.devices],flush=True)
 except Exception as e:print(str(e),flush=True)
