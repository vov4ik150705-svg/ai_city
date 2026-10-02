import bpy,math,json,os
from mathutils import Vector
ROOT='C:/Users/sk640/ai_city'
OUT=ROOT+'/marketing/2026-10-02-profile-banners/v3'
# Scene built from original GLBs and the accepted terra-look map. No compacted V2 geometry.
bpy.ops.wm.open_mainfile(filepath=ROOT+'/marketing/2026-10-02-profile-banners/v2/corporator-banner-scene.blend')
sc=bpy.context.scene;cam=sc.camera
target=Vector((0,0,5));r=280;theta=math.radians(-13);elev=math.radians(25)
cam.location=target+Vector((math.sin(theta)*r,-math.cos(theta)*r,r*math.tan(elev)))
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.context.view_layer.update()
visible=[o for o in sc.objects if o.type=='MESH'and not o.hide_render]
pts=[o.matrix_world@Vector(v)for o in visible for v in o.bound_box]
rot=cam.rotation_euler.to_matrix();right=rot@Vector((1,0,0));up=rot@Vector((0,1,0))
xs=[(p-target).dot(right)for p in pts];ys=[(p-target).dot(up)for p in pts]
pw=max(xs)-min(xs);span=pw/.82;height=span/3;cam.data.ortho_scale=span
cx=(min(xs)+max(xs))/2;cy=max(ys)+height*.045-height/2
cam.location+=right*cx+up*cy
# Lighting is adjusted; geometry and original texture maps are untouched.
sun=bpy.data.objects.get('Morning sun');sun.data.energy=2.7;sun.data.angle=math.radians(6);sun.data.color=(1,.91,.78)
sun.rotation_euler=(math.radians(30),math.radians(-36),math.radians(-32))
bpy.data.objects.get('Soft sky fill').data.energy=23000
bpy.data.objects.get('Warm rim').data.energy=26000
sc.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.65
sc.view_settings.look='AgX - Medium High Contrast';sc.view_settings.exposure=.4
sc.cycles.samples=24;sc.cycles.adaptive_threshold=.03;sc.cycles.use_denoising=True
sc.render.resolution_x=3000;sc.render.resolution_y=1000;sc.render.resolution_percentage=40
sc.render.filepath=OUT+'/island-draft.png';sc.render.use_compositing=False
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=OUT+'/terra-original-geometry.blend')
open(OUT+'/scene-settings.json','w').write(json.dumps({'cameraElevation':25,'cameraAzimuth':-13,'geometry':'unmodified original island/buildings/water','map':'art/island_v3/maps/terra-look.json','subjectWidthFraction':.82,'originalFullWaterfallsInScene':True},indent=2))
print('RENDER_START',{'width':pw,'frameHeight':height,'worldProjectedTop':max(ys),'worldProjectedBottom':min(ys)},flush=True)
bpy.ops.render.render(write_still=True)
