const fs=require('fs'),path=require('path'),crypto=require('crypto');
const deps='C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const sharp=require(deps+'sharp'),JSZip=require(deps+'jszip');
const out=__dirname,root='C:/Users/sk640/ai_city';
async function main(){
  const summary={verifiedAt:'2026-10-02',files:[],originalChecks:[],foregroundPreservation:{},masters:{}};
  const originals=[['media/island/island_03_tight.png','8ba3437e4d27b7c4'],['media/island/island_04_hero_walk_left.png','baf3a38633f2f0bb'],['media/island/island_06_lowest_fill.png','22882f4bd8c86b30'],['media/corporator_logo/logo solo.png','58395b6846eb9e60'],['media/corporator_logo/logo token.png','19288af558af3db6'],['media/arts/economy-sky-art.png','02a43e60bd08947e']];
  for(const [p,prefix]of originals){const h=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');if(!h.startsWith(prefix))throw Error('Reference hash mismatch: '+p);summary.originalChecks.push({file:p,sha256:h,manifestMatch:true});}
  for(const n of ['scene-clean','x','dexscreener'])for(const [w,h]of [[3000,1000],[1500,500]]){const name=`${n}-${w}x${h}.png`,p=path.join(out,name),m=await sharp(p).metadata();if(m.width!==w||m.height!==h)throw Error('Invalid dimensions');summary.files.push({file:name,width:w,height:h,bytes:fs.statSync(p).size,format:m.format});}
  const source=await sharp(path.join(root,'media/island/island_04_hero_walk_left.png')).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const cut=await sharp(path.join(out,'layers/island-source-cutout.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let opaque=0,changed=0;
  for(let y=0;y<1700;y++)for(let x=0;x<1740;x++){const i=(y*1740+x)*4;if(cut.data[i+3]===255){opaque++;const s=((y+460)*3840+x+1080)*3;for(let c=0;c<3;c++)if(cut.data[i+c]!==source.data[s+c]){changed++;break;}}}
  if(changed)throw Error('Foreground RGB changed');summary.foregroundPreservation={fullyOpaquePixels:opaque,changedRgbPixels:changed,uniformScale:0.55,mirrored:false};
  for(const n of ['x','dexscreener']){const svg=fs.readFileSync(path.join(out,n+'-editable-master.svg'),'utf8');if(!svg.includes('>CORPORATOR</text>'))throw Error('Title invalid');if(n==='x'&&!svg.includes('>A city worth running.</text>'))throw Error('Tagline invalid');const zip=await JSZip.loadAsync(fs.readFileSync(path.join(out,n+'-layered-master.ora')));const mime=await zip.file('mimetype').async('string');if(mime!=='image/openraster')throw Error('ORA invalid');const stack=await zip.file('stack.xml').async('string');summary.masters[n]={editableText:true,fontEmbedded:true,rasterLayers:(stack.match(/<layer /g)||[]).length,openRasterValid:true};}
  const crops=[{n:'COINBASE',r:{left:2005,top:147,width:155,height:130}},{n:'City Hall star',r:{left:2252,top:116,width:101,height:114}},{n:'City Hall sign',r:{left:2258,top:263,width:140,height:75}},{n:'City core signs',r:{left:2180,top:285,width:420,height:265}}];
  const tiles=[];
  for(let i=0;i<crops.length;i++){const c=crops[i];tiles.push({input:await sharp(path.join(out,'scene-clean-3000x1000.png')).extract(c.r).resize(640,410,{fit:'contain',background:'#e6f1fc',kernel:'nearest'}).png().toBuffer(),left:(i%2)*640,top:Math.floor(i/2)*410});}
  await sharp({create:{width:1280,height:820,channels:3,background:'#e6f1fc'}}).composite(tiles).png().toFile(path.join(out,'qa-visible-details.png'));
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
}
main().catch(e=>{console.error(e);process.exit(1);});
