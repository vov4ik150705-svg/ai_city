import bpy,json
from mathutils import Vector
sc=bpy.context.scene
result={'engine':sc.render.engine,'camera':sc.camera.name if sc.camera else None,'world':sc.world.name if sc.world else None,'objects':[]}
for o in sc.objects:
 if o.type not in ['MESH','CAMERA','LIGHT']:continue
 d={'name':o.name,'type':o.type,'hidden':o.hide_render,'loc':list(o.location),'rot':list(o.rotation_euler),'scale':list(o.scale)}
 if o.type=='MESH':
  pts=[o.matrix_world@Vector(c) for c in o.bound_box]
  d['min']=[min(p[i]for p in pts)for i in range(3)];d['max']=[max(p[i]for p in pts)for i in range(3)];d['faces']=len(o.data.polygons)
 if o.type=='CAMERA':d.update({'lens':o.data.lens,'kind':o.data.type,'ortho':o.data.ortho_scale})
 result['objects'].append(d)
open('C:/Users/sk640/ai_city/marketing/2026-10-02-profile-banners/v2/scene-inventory.json','w').write(json.dumps(result,indent=2))
print('SCENE_INVENTORY',json.dumps({'camera':result['camera'],'objects':[(o['name'],o['type'],o['hidden'])for o in result['objects']]}),flush=True)
