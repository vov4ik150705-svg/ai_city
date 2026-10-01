import bpy,math,json,hashlib,struct
from mathutils import Vector
OUT='C:/Users/sk640/ai_city/marketing/2026-10-02-profile-banners/v2'
sc=bpy.context.scene;cam=sc.camera
theta=math.radians(-9);elev=math.radians(14);target=Vector((0,0,5));r=260
cam.location=target+Vector((math.sin(theta)*r,-math.cos(theta)*r,r*math.tan(elev)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.context.view_layer.update()
visible=[o for o in sc.objects if o.type=='MESH'and not o.hide_render]
pts=[o.matrix_world@Vector(v)for o in visible for v in o.bound_box]
rot=cam.rotation_euler.to_matrix();right=rot@Vector((1,0,0));up=rot@Vector((0,1,0))
xs=[(p-target).dot(right)for p in pts];ys=[(p-target).dot(up)for p in pts]
pw=max(xs)-min(xs);ph=max(ys)-min(ys);height=max(ph/.90,pw/(3*.48));cam.data.ortho_scale=height*3
mid=target+right*((min(xs)+max(xs))/2)+up*((min(ys)+max(ys))/2);frame_center=mid-right*(.22*height*3);cam.location+=frame_center-target
sc.cycles.samples=96;sc.cycles.adaptive_threshold=.015;sc.render.resolution_percentage=100;sc.render.filepath=OUT+'/island-render-3000x1000.png'
bpy.ops.file.pack_all()
sc.render.use_file_extension=True
sc.render.use_compositing=False
verification={}
for o in visible:
 if '__'not in o.name:continue
 prefix=o.name.split('__')[0]
 if (prefix.startswith('d') and prefix[1:].isdigit()) or prefix.startswith('terra'):continue
 record=verification.setdefault(prefix,{'objects':0,'vertices':0,'polygons':0})
 record['objects']+=1;record['vertices']+=len(o.data.vertices);record['polygons']+=len(o.data.polygons)
open(OUT+'/render-geometry-inventory.json','w').write(json.dumps({'buildings':verification,'cameraElevation':14,'cameraAzimuth':-9,'samples':96,'resolution':[3000,1000],'modelSource':'models/*.glb','mapSource':'art/island_v3/maps/terra-look.json','renderEngine':'Blender Cycles CPU','originalBuildingGeometryModified':False},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/corporator-banner-render-master.blend')
print('FINAL_RENDER_START',{'width':pw,'height':ph,'orthoHeight':height},flush=True)
bpy.ops.render.render(write_still=True)
