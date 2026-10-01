const fs=require('fs'),path=require('path'),assert=require('assert');
const deps='C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const sharp=require(deps+'sharp'),JSZip=require(deps+'jszip');
const out=__dirname;
(async()=>{
 const result={buildingPreservation:JSON.parse(fs.readFileSync(path.join(out,'building-preservation-check.json'))),pngs:{},masters:{}};
 assert(result.buildingPreservation.unchanged&&result.buildingPreservation.buildingCount===19);
 for(const n of ['scene-clean','x','dexscreener'])for(const size of [[3000,1000],[1500,500]]){
  const name=n+'-'+size[0]+'x'+size[1]+'.png',meta=await sharp(path.join(out,name)).metadata();
  assert(meta.width===size[0]&&meta.height===size[1]);result.pngs[name]={width:meta.width,height:meta.height,bytes:fs.statSync(path.join(out,name)).size};
 }
 for(const n of ['x','dexscreener']){
  const svg=fs.readFileSync(path.join(out,n+'-editable-master.svg'),'utf8');
  assert(svg.includes('>CORPORATOR</text>')&&svg.includes('data:font/ttf;base64,'));
  if(n==='x')assert(svg.includes('>A city worth running.</text>'));
  const ora=await JSZip.loadAsync(fs.readFileSync(path.join(out,n+'-layered-master.ora')));
  assert(await ora.file('mimetype').async('string')==='image/openraster');
  const stack=await ora.file('stack.xml').async('string');assert((stack.match(/<layer /g)||[]).length===5);
  result.masters[n]={editableText:true,embeddedFonts:true,layerCount:5,openRasterValid:true};
 }
 const render=path.join(out,'island-render-3000x1000.png');
 await sharp(render).extract({left:1715,top:155,width:230,height:305}).resize(460,610).png().toFile(path.join(out,'qa-finance-tower.png'));
 await sharp(render).extract({left:2020,top:75,width:190,height:410}).resize(285,615).png().toFile(path.join(out,'qa-city-hall.png'));
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(result,null,2));
 const zip=new JSZip();
 const files=['REPORT.md','sky-generation-prompt.txt','verification.json','building-preservation-check.json','render-geometry-inventory.json','qa-finance-tower.png','qa-city-hall.png','scene-clean-3000x1000.png','scene-clean-1500x500.png','x-3000x1000.png','x-1500x500.png','dexscreener-3000x1000.png','dexscreener-1500x500.png','x-editable-master.svg','dexscreener-editable-master.svg','x-layered-master.ora','dexscreener-layered-master.ora','x-preview-600x200.png','dexscreener-preview-600x200.png','corporator-banner-render-master.blend'];
 for(const n of files)zip.file(n,fs.readFileSync(path.join(out,n)));
 for(const dir of ['fonts','layers'])for(const n of fs.readdirSync(path.join(out,dir)))zip.file(dir+'/'+n,fs.readFileSync(path.join(out,dir,n)));
 const name='corporator-profile-banners-v2-2026-10-02.zip';fs.writeFileSync(path.join(out,name),await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
 console.log(JSON.stringify({checks:'passed',buildings:19,masters:result.masters,archive:name,bytes:fs.statSync(path.join(out,name)).size}));
})().catch(e=>{console.error(e);process.exit(1);});
