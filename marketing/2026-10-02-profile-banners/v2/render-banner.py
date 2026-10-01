import bpy,json,math,os,sys
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT='C:/Users/sk640/ai_city'
OUT=ROOT+'/marketing/2026-10-02-profile-banners/v2'
look=json.load(open(ROOT+'/art/island_v3/maps/terra-look.json'))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
originals={'city_hall':'City Hall','ai_research_center':'AI Research Center','cloud_campus':'Cloud Campus','finance_tower':'Finance Tower','bank':'Bank','exchange':'Exchange','power_node':'Power Node','agent_hub':'Agent Hub','workshop':'Workshop','energy_plant':'Energy Plant','logistics_hub':'Logistics Hub','flagship_store':'Flagship Store','drone_depot':'Drone Depot','data_center':'Data Center','retail_complex':'Retail_complex','robotics_lab':'Robotics Lab','clearing_house':'Clearing House','fleet_yard':'Fleet Yard','neon_residence':'neon-residence'}
def imp(file):
 before=set(sc.objects);bpy.ops.import_scene.gltf(filepath=file);return [o for o in sc.objects if o not in before]
def bounds(obs):
 bpy.context.view_layer.update();p=[o.matrix_world@Vector(v)for o in obs if o.type=='MESH'for v in o.bound_box]
 return Vector([min(v[i]for v in p)for i in range(3)]),Vector([max(v[i]for v in p)for i in range(3)])
mass=imp(OUT+'/mass-decoded.glb')
# Runtime mass contains the original authored island only; keep its original topology.
mass_scale=Matrix.Diagonal((4.05,4.05,4.05,1))
for o in mass:
 if o.parent is None:o.matrix_world=mass_scale@o.matrix_world
 if 'attachment' in o.name.lower():o.hide_render=True
groups=[]
for row in look['objects']:
 if row['kind']!='building':continue
 objects=imp(ROOT+'/models/'+originals[row['ref']]+'.glb');lo,hi=bounds(objects)
 center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
 scale=row['scale']
 transform=Matrix.Translation(Vector((row['x'],-row['z'],row['y'])))@Matrix.Rotation(row['yaw'],4,'Z')@Matrix.Diagonal((scale,scale,scale,1))@Matrix.Translation(-center)
 for o in objects:
  if o.parent is None:o.matrix_world=transform@o.matrix_world
  o.name=row['ref']+'__'+o.name
 groups+=objects
 print('PLANTED',row['ref'],flush=True)
protos={}
for row in look['objects']:
 if row['kind']!='decor':continue
 ref=row['ref']
 if ref not in protos:
  objects=imp(OUT+'/decoded/'+ref+'.glb');lo,hi=bounds(objects);center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
  # Bake each imported object world transform once into prototype mesh coordinates.
  meshes=[]
  for o in objects:
   if o.type=='MESH':
    mesh=o.data.copy();mesh.transform(Matrix.Translation(-center)@o.matrix_world);meshes.append((mesh,o.name))
  for o in objects:bpy.data.objects.remove(o,do_unlink=True)
  protos[ref]=meshes
 scale=row['scale'];pose=Matrix.Translation(Vector((row['x'],-row['z'],row['y'])))@Matrix.Rotation(row['yaw'],4,'Z')@Matrix.Diagonal((scale,scale,scale,1))
 for mesh,name in protos[ref]:
  if 'attachment' in name.lower():continue
  o=bpy.data.objects.new(row['id']+'__'+name,mesh);sc.collection.objects.link(o);o.matrix_world=pose
  groups.append(o)
bpy.context.view_layer.update()
print('SCENE_READY',len(sc.objects),flush=True)
# Original materials and textures retained. Adjust only light and water presentation.
for mat in bpy.data.materials:
 if not mat.use_nodes:continue
 for node in mat.node_tree.nodes:
  if node.type=='BSDF_PRINCIPLED':
   if 'Emission Strength' in node.inputs and node.inputs['Emission Strength'].default_value>0:node.inputs['Emission Strength'].default_value=min(node.inputs['Emission Strength'].default_value,1.2)
world=bpy.data.worlds.new('Morning sky illumination');world.use_nodes=True;sc.world=world
bg=world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(0.64,0.78,1.0,1);bg.inputs['Strength'].default_value=.55
def area(name,loc,target,power,size,color):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);sc.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
sun_data=bpy.data.lights.new('Morning sun','SUN');sun_data.energy=2.2;sun_data.angle=math.radians(8);sun_data.color=(1,.86,.68)
sun=bpy.data.objects.new('Morning sun',sun_data);sc.collection.objects.link(sun);sun.rotation_euler=(math.radians(25),math.radians(-30),math.radians(-30))
area('Soft sky fill',(20,-70,65),(0,0,10),13000,85,(.70,.84,1))
area('Warm rim',(-65,25,80),(0,0,8),18000,65,(1,.90,.76))
camera_data=bpy.data.cameras.new('Banner hero camera');camera=bpy.data.objects.new('Banner hero camera',camera_data);sc.collection.objects.link(camera);sc.camera=camera
camera_data.type='ORTHO';theta=math.radians(-8);elev=math.radians(18);target=Vector((0,0,5));r=260
camera.location=target+Vector((math.sin(theta)*r,-math.cos(theta)*r,r*math.tan(elev)));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
sc.render.resolution_x=3000;sc.render.resolution_y=1000;sc.render.resolution_percentage=100
# Fit the complete subject; use a landscape camera with room for typography at left.
visible=[o for o in sc.objects if o.type=='MESH'and not o.hide_render]
pts=[o.matrix_world@Vector(v)for o in visible for v in o.bound_box]
rot=camera.rotation_euler.to_matrix();right=rot@Vector((1,0,0));up=rot@Vector((0,1,0))
xs=[(p-target).dot(right)for p in pts];ys=[(p-target).dot(up)for p in pts]
pw=max(xs)-min(xs);ph=max(ys)-min(ys);height=max(ph/.87,pw/(3*.49))
camera_data.ortho_scale=height*3
mid=target+right*((min(xs)+max(xs))/2)+up*((min(ys)+max(ys))/2)
# Subject centered at 74% width, 49% height.
frame_center=mid-right*(.24*height*3)+up*(.01*height)
camera.location+=frame_center-target
sc.render.engine='CYCLES';sc.cycles.device='CPU';sc.cycles.samples=24;sc.cycles.use_denoising=True;sc.cycles.max_bounces=5;sc.cycles.transparent_max_bounces=8
sc.render.threads_mode='FIXED';sc.render.threads=6
sc.render.film_transparent=True;sc.render.image_settings.file_format='PNG';sc.render.image_settings.color_mode='RGBA'
sc.view_settings.view_transform='AgX';sc.view_settings.look='AgX - Medium High Contrast';sc.view_settings.exposure=.3
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/corporator-banner-scene.blend')
sc.render.resolution_percentage=40
sc.render.filepath=OUT+'/island-render-draft.png'
print('RENDER_START',{'width':pw,'height':ph,'cameraSpan':height,'objects':len(visible)},flush=True)
bpy.ops.render.render(write_still=True)
