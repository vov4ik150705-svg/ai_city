import bpy,json
OUT='C:/Users/sk640/ai_city/marketing/2026-10-02-profile-banners/v3'
bpy.ops.wm.open_mainfile(filepath=OUT+'/terra-original-geometry.blend')
sc=bpy.context.scene;sc.render.resolution_percentage=100;sc.cycles.samples=128
sc.cycles.adaptive_threshold=.012;sc.cycles.use_denoising=True
sc.render.filepath=OUT+'/island-render-3000x1000.png';bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/corporator-terra-render-master.blend')
settings={'renderEngine':'Blender Cycles CPU','samples':128,'resolution':[3000,1000],'cameraElevation':12,'cameraAzimuth':-13,'subjectCenterFraction':.67,'buildingSources':'models/*.glb','massSource':'art/island_v3/runtime_terra19/island_mass.glb','mapSource':'art/island_v3/maps/terra-look.json','buildingCount':19,'geometryModified':False,'waterfallsShortened':False}
open(OUT+'/scene-settings.json','w').write(json.dumps(settings,indent=2))
print('FINAL_RENDER_START',flush=True);bpy.ops.render.render(write_still=True)
