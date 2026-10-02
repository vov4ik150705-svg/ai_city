import bpy,math,json
from mathutils import Vector
OUT='C:/Users/sk640/ai_city/marketing/2026-10-02-profile-banners/v3'
bpy.ops.wm.open_mainfile(filepath=OUT+'/terra-original-geometry.blend')
sc=bpy.context.scene;cam=sc.camera;target=Vector((0,0,5));r=280
theta=math.radians(-13);elev=math.radians(12)
cam.location=target+Vector((math.sin(theta)*r,-math.cos(theta)*r,r*math.tan(elev)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.context.view_layer.update();rot=cam.rotation_euler.to_matrix();right=rot@Vector((1,0,0));up=rot@Vector((0,1,0))
visible=[o for o in sc.objects if o.type=='MESH'and not o.hide_render]
pts=[o.matrix_world@Vector(v)for o in visible for v in o.bound_box]
xs=[(p-target).dot(right)for p in pts];ys=[(p-target).dot(up)for p in pts]
pw=max(xs)-min(xs);span=pw/.50;height=span/3;cam.data.ortho_scale=span
cx=(min(xs)+max(xs))/2-span*.17;cy=max(ys)+height*.035-height/2;cam.location+=right*cx+up*cy
inventory={}
for o in visible:
 prefix=o.name.split('__')[0];rec=inventory.setdefault(prefix,{'minY':1e9,'maxY':-1e9,'minX':1e9,'maxX':-1e9})
 for v in o.bound_box:
  p=o.matrix_world@Vector(v);y=(p-target).dot(up);x=(p-target).dot(right)
  rec['minY']=min(rec['minY'],y);rec['maxY']=max(rec['maxY'],y);rec['minX']=min(rec['minX'],x);rec['maxX']=max(rec['maxX'],x)
for rec in inventory.values():rec['screenTop']=(cy+height/2-rec['maxY'])/height*1000;rec['screenBottom']=(cy+height/2-rec['minY'])/height*1000
open(OUT+'/projected-bounds.json','w').write(json.dumps(inventory,indent=2))
sc.render.resolution_percentage=30;sc.render.filepath=OUT+'/island-draft-refined.png';sc.cycles.samples=16
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/terra-original-geometry.blend')
print('CAMERA',{'span':span,'height':height,'top':max(ys)},flush=True)
bpy.ops.render.render(write_still=True)
