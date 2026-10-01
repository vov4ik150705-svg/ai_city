from pathlib import Path
import hashlib,json,zipfile
from PIL import Image
root=Path(r"C:\Users\sk640\ai_city\docs\public\docs-design\book-reference")
folders=sorted(p for p in root.glob("*-ready") if p.is_dir())
assert len(folders)==11,len(folders)
checks=[]
for folder in folders:
    m=json.loads((folder/"manifest.json").read_text(encoding="utf-8"))
    data=(folder/"art.png").read_bytes()
    digest=hashlib.sha256(data).hexdigest().upper()
    assert digest==m["hash"],folder
    with Image.open(folder/"art.png") as img:
        assert img.size==(m["w"],m["h"]),(folder,img.size)
        assert img.mode=="RGBA",(folder,img.mode)
        alpha=img.getchannel("A").getextrema()
        assert alpha==(0,255),(folder,alpha)
    with Image.open(folder/"mockup.png") as img:
        assert img.size==(1672,941),(folder,img.size)
    with Image.open(folder/"mockup-mobile.png") as img:
        assert img.size==(375,812),(folder,img.size)
    with Image.open(folder/"mockup-mobile-full.png") as img:
        assert img.size[0]==375 and img.size[1]>=812,(folder,img.size)
    zpath=root/(folder.name+"-v1.zip")
    assert zpath.exists(),zpath
    with zipfile.ZipFile(zpath) as z:
        artname=next(n for n in z.namelist() if n.replace("\\","/")==folder.name+"/art.png")
        assert hashlib.sha256(z.read(artname)).hexdigest().upper()==digest,zpath
        manifestname=next(n for n in z.namelist() if n.replace("\\","/")==folder.name+"/manifest.json")
        assert z.read(manifestname)==(folder/"manifest.json").read_bytes(),zpath
        assert z.testzip() is None,zpath
    checks.append({"n":m["n"],"dir":folder.name,"sha256":digest,"rgba":True,"alphaRange":list(alpha),"desktop":[1672,941],"mobile":[375,812],"individualZipMatches":True})
assert [c["n"] for c in checks]==list(range(1,12))
validation=json.loads((root/"VALIDATION.json").read_text(encoding="utf-8"))
validation["packages"]=checks
validation["styleCheckpoints"]=[4,8]
validation["aggregateContents"]="11 final ready folders, index.html, gallery.html, README.md, AGENT_HANDOFF.md, VALIDATION.json and original ethalons; no rejected variants or generation archive"
(root/"VALIDATION.json").write_text(json.dumps(validation,indent=2,ensure_ascii=False),encoding="utf-8")
readme=(root/"README.md").read_text(encoding="utf-8")
readme=readme.replace("The aggregate ZIP contains only final ready folders, opening pages and handoff/readme.","The aggregate ZIP contains final ready folders, opening pages, handoff/readme, validation and the two original style anchors.")
readme+="\n## Final validation\n\nAll eleven art PNG hashes match manifests and individual ZIPs; RGBA alpha0–255 verified. Desktop1672×941 and mobile viewport375×812 dimensions verified. Whole-book Next sequence, dots, keyboard Previous, direct page hash, Handbook return, zoom/Escape, synthetic pinch resize and prose swipe passed; final mobile CTA rows do not overlap. See VALIDATION.json.\n"
(root/"README.md").write_text(readme,encoding="utf-8")
files=[]
for folder in folders:
    files.extend(p for p in folder.rglob("*") if p.is_file())
files.extend(p for p in (root/"ethalons").rglob("*") if p.is_file())
files.extend(root/name for name in ["index.html","gallery.html","README.md","AGENT_HANDOFF.md","VALIDATION.json"])
aggregate=root/"CORPORATOR-GAME-BOOK-ready-v1.zip"
with zipfile.ZipFile(aggregate,"w",zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for path in files:
        z.write(path,path.relative_to(root).as_posix())
with zipfile.ZipFile(aggregate) as z:
    assert z.testzip() is None,"Aggregate CRC mismatch"
    for path in files:
        assert z.read(path.relative_to(root).as_posix())==path.read_bytes(),path
print(json.dumps({"pages":len(checks),"allAssetsMatch":True,"archive":str(aggregate),"archiveMB":round(aggregate.stat().st_size/1024/1024,1),"files":len(files),"archiveSha256":hashlib.sha256(aggregate.read_bytes()).hexdigest().upper()},indent=2))
