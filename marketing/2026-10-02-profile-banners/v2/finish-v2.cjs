const fs=require('fs'),path=require('path');
const out=__dirname,parent=path.dirname(out);
const deps='C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const sharp=require(deps+'sharp');
async function main(){
 fs.mkdirSync(path.join(out,'layers'),{recursive:true});
 for(const n of ['brand-lockup.png','brand-mark.png','token-original.png'])fs.copyFileSync(path.join(parent,'layers',n),path.join(out,'layers',n));
 fs.copyFileSync('C:/Users/sk640/.codex/generated_images/01a0f97d-f601-7a90-aa04-789c7cf65984/exec-3d871d3a-c1cd-48d0-ad0c-ff049a581f0d.png',path.join(out,'sky-generated-original.png'));
 await sharp(path.join(out,'sky-generated-original.png')).resize(3000,1000).png().toFile(path.join(out,'layers/sky.png'));
 fs.copyFileSync(path.join(out,'island-render-3000x1000.png'),path.join(out,'layers/island.png'));
 await sharp(path.join(out,'layers/sky.png')).composite([{input:path.join(out,'layers/island.png')}]).png().toFile(path.join(out,'scene-clean-3000x1000.png'));
 await sharp(path.join(out,'scene-clean-3000x1000.png')).resize(1500,500).png().toFile(path.join(out,'scene-clean-1500x500.png'));
 let s=fs.readFileSync(path.join(parent,'finish-layouts.cjs'),'utf8');
 s=s.replace("size:coin?148:164,x:coin?605:246,y:coin?465:490","size:coin?128:148,x:coin?435:176,y:coin?470:480");
 s=s.replace("size:70,x:249,y:597","size:66,x:181,y:589");
 s=s.replace("x:246,y:300,w:290,h:296","x:170,y:310,w:214,h:219");
 s=s.replace("x:251,y:241,w:104,h:121","x:181,y:233,w:91,h:106");
 s=s.replace("x:610,y:523,w:333,h:61","x:439,y:527,w:274,h:50");
 s=s.replace("Terra — original game capture, uniform scale 0.55","Terra — Cycles render from original 19 building models");
 s=s.replace("p:path.join(L,'island.png'),x:1880,y:40","p:path.join(L,'island.png'),x:0,y:0");
 s=s.replace("imgSvg(path.join(L,'island.png'),1880,40,957,935)","imgSvg(path.join(L,'island.png'),0,0,W,H)");
 fs.writeFileSync(path.join(out,'finish-layouts.cjs'),s);
 require(path.join(out,'finish-layouts.cjs'));
}
main().catch(e=>{console.error(e);process.exit(1);});
