import bpy,json,hashlib,struct,os
OUT='C:/Users/sk640/ai_city/marketing/2026-10-02-profile-banners/v2'
ROOT='C:/Users/sk640/ai_city'
slugs=set(o['ref']for o in json.load(open(ROOT+'/art/island_v3/maps/terra-look.json'))['objects']if o['kind']=='building')
def fingerprint(o):
 h=hashlib.sha256()
 for v in o.data.vertices:h.update(struct.pack('<fff',*v.co))
 for poly in o.data.polygons:
  h.update(struct.pack('<I',len(poly.vertices)))
  for i in poly.vertices:h.update(struct.pack('<I',i))
 for uv in o.data.uv_layers:
  for p in uv.data:h.update(struct.pack('<ff',*p.uv))
 for row in o.matrix_world:
  for val in row:h.update(struct.pack('<f',val))
 return h.hexdigest()
def records():
 d={}
 for o in bpy.context.scene.objects:
  if o.type=='MESH'and o.name.split('__')[0]in slugs:d[o.name]=fingerprint(o)
 return d
bpy.ops.wm.open_mainfile(filepath=OUT+'/corporator-banner-scene.blend');before=records()
bpy.ops.wm.open_mainfile(filepath=OUT+'/corporator-banner-render-master.blend');after=records()
changed=[k for k in before if k not in after or before[k]!=after[k]]
counts={s:len([k for k in after if k.startswith(s+'__')])for s in sorted(slugs)}
result={'buildingCount':len(slugs),'buildingMeshCount':len(after),'changedVertexTopologyUVOrWorldTransform':changed,'all19Present':all(v>0 for v in counts.values()),'meshesByBuilding':counts,'unchanged':not changed and len(before)==len(after),'note':'Compares exact vertex coordinates, topology, UVs and world transforms before vs after owner-authorized rock/water changes. Building textures are original GLB embedded images.'}
open(OUT+'/building-preservation-check.json','w').write(json.dumps(result,indent=2))
inv=json.load(open(OUT+'/render-geometry-inventory.json'))
inv['buildings']={}
for o in bpy.context.scene.objects:
 prefix=o.name.split('__')[0]
 if o.type=='MESH'and prefix in slugs:
  d=inv['buildings'].setdefault(prefix,{'objects':0,'vertices':0,'polygons':0})
  d['objects']+=1;d['vertices']+=len(o.data.vertices);d['polygons']+=len(o.data.polygons)
open(OUT+'/render-geometry-inventory.json','w').write(json.dumps(inv,indent=2))
if not result['unchanged']or not result['all19Present']:raise RuntimeError('Building preservation failed')
print('VERIFIED_BUILDINGS',json.dumps(result),flush=True)
