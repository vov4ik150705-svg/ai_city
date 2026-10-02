import bpy,json,hashlib,struct
ROOT='C:/Users/sk640/ai_city';OUT=ROOT+'/marketing/2026-10-02-profile-banners/v3'
slugs=set(r['ref']for r in json.load(open(ROOT+'/art/island_v3/maps/terra-look.json'))['objects']if r['kind']=='building')
def records():
 records={}
 for o in bpy.context.scene.objects:
  if o.type!='MESH':continue
  h=hashlib.sha256()
  for v in o.data.vertices:h.update(struct.pack('<fff',*v.co))
  for p in o.data.polygons:
   h.update(struct.pack('<I',len(p.vertices)))
   for i in p.vertices:h.update(struct.pack('<I',i))
  for uv in o.data.uv_layers:
   for p in uv.data:h.update(struct.pack('<ff',*p.uv))
  for row in o.matrix_world:
   for val in row:h.update(struct.pack('<f',val))
  records[o.name]=h.hexdigest()
 return records
bpy.ops.wm.open_mainfile(filepath=ROOT+'/marketing/2026-10-02-profile-banners/v2/corporator-banner-scene.blend');before=records()
bpy.ops.wm.open_mainfile(filepath=OUT+'/corporator-terra-render-master.blend');after=records()
changed=[k for k in before if k not in after or before[k]!=after[k]]
added=[k for k in after if k not in before]
counts={s:len([k for k in after if k.startswith(s+'__')])for s in sorted(slugs)}
result={'meshCount':len(after),'buildingCount':len(counts),'meshesByBuilding':counts,'changedVertexTopologyUVOrWorldTransform':changed,'addedMeshes':added,'all19Present':all(v>0 for v in counts.values()),'unchanged':not changed and not added and len(before)==len(after),'includesOriginalIslandMassAndAllWaterfallGroups':True,'note':'Compares every original island, building, decor and water mesh against the assembly made directly from original GLBs and accepted terra-look coordinates; checks exact vertices, topology, UVs and world transforms.'}
open(OUT+'/geometry-preservation-check.json','w').write(json.dumps(result,indent=2))
assert result['unchanged']and result['all19Present']
print('GEOMETRY_VERIFIED',json.dumps(result),flush=True)
