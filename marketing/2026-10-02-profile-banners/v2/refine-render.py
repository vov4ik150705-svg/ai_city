import bpy,math,json
from mathutils import Vector
OUT='C:/Users/sk640/ai_city/marketing/2026-10-02-profile-banners/v2'
sc=bpy.context.scene
# Owner-authorized improvement of the rock underside and water, no building changes.
for o in sc.objects:
 if o.type!='MESH':continue
 if o.name.startswith(('city_hall__','ai_research_center__','cloud_campus__','finance_tower__','bank__','exchange__','power_node__','agent_hub__','workshop__','energy_plant__','logistics_hub__','flagship_store__','drone_depot__','data_center__','retail_complex__','robotics_lab__','clearing_house__','fleet_yard__','neon_residence__')):continue
 if o.name.startswith(('d197__','d198__','d199__','d200__','d201__')):continue
 inv=o.matrix_world.inverted()
 o.data=o.data.copy()
 for v in o.data.vertices:
  p=o.matrix_world@v.co
  if p.z<-.5:p.z*=.65;v.co=inv@p
water=[]
for id in ['d197','d198','d199','d200','d201']:
 objects=[o for o in sc.objects if o.type=='MESH'and o.name.startswith(id+'__')]
 pts=[o.matrix_world@Vector(v)for o in objects for v in o.bound_box]
 if not pts:continue
 low=min(p.z for p in pts);high=max(p.z for p in pts)
 # Keep the source stream meshes and UVs, fit them into the shorter new underside.
 for o in objects:
  o.data=o.data.copy();inv=o.matrix_world.inverted()
  for v in o.data.vertices:
   p=o.matrix_world@v.co;p.z=-14+(p.z-high)*.40;v.co=inv@p
  water.append(o)
cam=sc.camera;theta=math.radians(-9);elev=math.radians(9);target=Vector((0,0,5));r=260
cam.location=target+Vector((math.sin(theta)*r,-math.cos(theta)*r,r*math.tan(elev)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.context.view_layer.update()
visible=[o for o in sc.objects if o.type=='MESH'and not o.hide_render]
pts=[o.matrix_world@Vector(v)for o in visible for v in o.bound_box]
rot=cam.rotation_euler.to_matrix();right=rot@Vector((1,0,0));up=rot@Vector((0,1,0))
xs=[(p-target).dot(right)for p in pts];ys=[(p-target).dot(up)for p in pts]
pw=max(xs)-min(xs);ph=max(ys)-min(ys);height=max(ph/.9,pw/(3*.48));cam.data.ortho_scale=height*3
mid=target+right*((min(xs)+max(xs))/2)+up*((min(ys)+max(ys))/2)
frame_center=mid-right*(.22*height*3);cam.location+=frame_center-target
sc.cycles.samples=32;sc.render.resolution_percentage=45
sc.render.filepath=OUT+'/island-render-refined-draft.png'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/corporator-banner-scene-v2.blend')
print('REFINED_RENDER',{'projectedWidth':pw,'projectedHeight':ph,'orthoHeight':height},flush=True)
bpy.ops.render.render(write_still=True)
