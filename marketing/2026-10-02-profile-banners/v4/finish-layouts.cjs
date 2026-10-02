const fs=require('fs'),path=require('path');
const deps='C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const sharp=require(deps+'sharp'),JSZip=require(deps+'jszip'),{createCanvas,GlobalFonts}=require(deps+'@napi-rs/canvas');
const out=__dirname,L=out+'/layers',W=3000,H=1000;
const cfg=JSON.parse(fs.readFileSync(out+'/layout.json','utf8'));
const fonts='C:/Users/sk640/.agents/skills/canvas-design/canvas-fonts/';
fs.mkdirSync(L,{recursive:true});fs.mkdirSync(out+'/fonts',{recursive:true});
for(const n of ['Outfit-Bold.ttf','Outfit-Regular.ttf','Outfit-OFL.txt'])fs.copyFileSync(fonts+n,out+'/fonts/'+n);
GlobalFonts.registerFromPath(fonts+'Outfit-Bold.ttf','Corporator Bold');GlobalFonts.registerFromPath(fonts+'Outfit-Regular.ttf','Corporator Regular');
const css=`@font-face{font-family:Outfit;src:url(data:font/ttf;base64,${fs.readFileSync(fonts+'Outfit-Bold.ttf').toString('base64')});font-weight:700;}@font-face{font-family:Outfit;src:url(data:font/ttf;base64,${fs.readFileSync(fonts+'Outfit-Regular.ttf').toString('base64')});font-weight:400;}`;
const uri=p=>'data:image/png;base64,'+fs.readFileSync(p).toString('base64');
const img=(p,x,y,w,h)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="${uri(p)}"/>`;
const group=(id,label,body)=>`<g id="${id}" inkscape:groupmode="layer" inkscape:label="${label}">${body}</g>`;
const title=cfg.title;
function titleCanvas(){const c=createCanvas(W,H),ctx=c.getContext('2d');ctx.font=`700 ${title.size}px "Corporator Bold"`;ctx.textAlign='center';
 ctx.shadowColor='rgba(12,27,47,.38)';ctx.shadowBlur=12;ctx.shadowOffsetY=7;ctx.fillStyle='#243746';ctx.fillText('CORPORATOR',title.x+4,title.y+title.depth);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 for(let d=title.depth;d>0;d--){ctx.fillStyle=d>9?'#be9a5c':d>4?'#665e52':'#aaa28f';ctx.fillText('CORPORATOR',title.x+d*.28,title.y+d);}
 const g=ctx.createLinearGradient(0,title.y-title.size*.76,0,title.y);g.addColorStop(0,'#fff9e9');g.addColorStop(.48,'#f1e9d6');g.addColorStop(1,'#d6c9ae');ctx.fillStyle=g;ctx.fillText('CORPORATOR',title.x,title.y);return c.toBuffer('image/png');}
function titleSVG(){let s='';for(let d=title.depth;d>0;d--)s+=`<use href="#title-glyphs" transform="translate(${d*.28} ${d})" fill="${d>9?'#be9a5c':d>4?'#665e52':'#aaa28f'}"/>`;return s+`<use href="#title-glyphs" fill="url(#title-face)"/>`;}
async function resized(source,width,name){const p=L+'/'+name,m=await sharp(source).metadata();const h=Math.round(width*m.height/m.width);await sharp(source).resize(width,h).png().toFile(p);return {p,w:width,h};}
(async()=>{
 const source=out+'/'+cfg.sceneSource,metadata=await sharp(source).metadata();
 if(Math.abs(metadata.width/metadata.height-3)>.005)throw Error('Scene must have native 3:1 framing before export.');
 await sharp(source).resize({width:W}).png().toFile(L+'/scene-unified.png');
 const sceneMeta=await sharp(L+'/scene-unified.png').metadata();if(sceneMeta.height!==H)throw Error('Uniform resize did not give 3000 x 1000.');
 for(const n of ['brand-mark.png','token-original.png','corp-wordmark.png'])fs.copyFileSync(out+'/../v3/layers/'+n,L+'/'+n);
 const mark=await resized(L+'/brand-mark.png',cfg.x.brandWidth,'x-brand-mark.png');const token=await resized(L+'/token-original.png',cfg.dexscreener.brandWidth,'dexscreener-token.png');const corp=await resized(L+'/corp-wordmark.png',cfg.dexscreener.wordWidth,'dexscreener-corp-wordmark.png');
 fs.writeFileSync(L+'/title-dimensional.png',titleCanvas());
 const tag=createCanvas(W,H),tx=tag.getContext('2d');tx.font=`${cfg.x.tagSize}px "Corporator Regular"`;tx.textAlign='center';tx.fillStyle=cfg.x.tagColor;tx.shadowColor='rgba(9,28,51,.65)';tx.shadowBlur=6;tx.shadowOffsetY=2;tx.fillText('A city worth running.',title.x,cfg.x.tagY);fs.writeFileSync(L+'/x-tagline.png',tag.toBuffer('image/png'));
 const clean=out+'/scene-clean-3000x1000.png';await sharp(L+'/scene-unified.png').composite([{input:L+'/signage-corrections.png',left:0,top:0}]).png().toFile(clean);await sharp(clean).resize(1500,500).png().toFile(out+'/scene-clean-1500x500.png');
 for(const version of ['x','dexscreener']){
  const dex=version==='dexscreener',v=cfg[version];const brand=dex?{...token,x:v.brandX,y:v.brandY}:{...mark,x:v.brandX,y:v.brandY};const word={...corp,x:cfg.dexscreener.wordX,y:cfg.dexscreener.wordY};
  const layers=[{name:'01 · Unified generated city and five-role scene',p:L+'/scene-unified.png',x:0,y:0},{name:'02 · In-world exact signage typography',p:L+'/signage-corrections.png',x:0,y:0},{name:'03 · CORPORATOR lettering',p:L+'/title-dimensional.png',x:0,y:0},{name:dex?'04 · Exact original token':'04 · Exact original Corporator mark',p:brand.p,x:brand.x,y:brand.y}];
  if(dex)layers.push({name:'05 · Exact original $CORP wordmark',p:word.p,x:word.x,y:word.y});else layers.push({name:'05 · A city worth running.',p:L+'/x-tagline.png',x:0,y:0});
  const master=out+'/'+version+'-3000x1000.png';await sharp(L+'/scene-unified.png').composite(layers.slice(1).map(l=>({input:l.p,left:l.x,top:l.y}))).flatten().png().toFile(master);
  await sharp(master).resize(1500,500).png({compressionLevel:9}).toFile(out+'/'+version+'-1500x500.png');
  await sharp(master).resize(1500,500).jpeg({quality:94,chromaSubsampling:'4:4:4',mozjpeg:true}).toFile(out+'/'+version+'-1500x500.jpg');
  await sharp(master).resize(600,200).png().toFile(out+'/'+version+'-preview-600x200.png');
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="3000" height="1000" viewBox="0 0 3000 1000"><title>Corporator — unified generated advertising art — ${version}</title><defs><style>${css}</style><linearGradient id="title-face" x1="0" y1="${title.y-title.size*.76}" x2="0" y2="${title.y}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff9e9"/><stop offset=".48" stop-color="#f1e9d6"/><stop offset="1" stop-color="#d6c9ae"/></linearGradient><text id="title-glyphs" x="${title.x}" y="${title.y}" text-anchor="middle" font-family="Outfit" font-weight="700" font-size="${title.size}">CORPORATOR</text><filter id="soft-shadow" x="-.2" y="-.4" width="1.4" height="2"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#091c33" flood-opacity=".55"/></filter></defs>`;
  svg+=group('unified-scene','01 · Unified art, all subjects generated together',img(L+'/scene-unified.png',0,0,W,H));svg+=group('signage','02 · Exact in-world signage',img(L+'/signage-corrections.png',0,0,W,H));svg+=group('title','03 · Editable CORPORATOR',`<g filter="url(#soft-shadow)">${titleSVG()}</g>`);svg+=group('brand','04 · Exact original brand',img(brand.p,brand.x,brand.y,brand.w,brand.h));
  svg+=dex?group('corp','05 · Original $CORP',img(word.p,word.x,word.y,word.w,word.h)):group('tagline','05 · Editable tagline',`<text x="${title.x}" y="${v.tagY}" text-anchor="middle" font-family="Outfit" font-weight="400" font-size="${v.tagSize}" fill="${v.tagColor}" filter="url(#soft-shadow)">A city worth running.</text>`);svg+='</svg>';fs.writeFileSync(out+'/'+version+'-editable-master.svg',svg);
  const ora=new JSZip();ora.file('mimetype','image/openraster',{compression:'STORE'});const xml=[];
  for(let i=layers.length-1;i>=0;i--){const l=layers[i],p='data/layer'+i+'.png';ora.file(p,fs.readFileSync(l.p));xml.push(`<layer name="${l.name}" src="${p}" x="${l.x}" y="${l.y}" opacity="1" visibility="visible" composite-op="svg:src-over"/>`);}
  ora.file('stack.xml',`<?xml version="1.0" encoding="UTF-8"?><image w="3000" h="1000" name="Corporator ${version}"><stack>${xml.join('')}</stack></image>`);ora.file('mergedimage.png',fs.readFileSync(master));ora.file('Thumbnails/thumbnail.png',await sharp(master).resize(256,85).png().toBuffer());fs.writeFileSync(out+'/'+version+'-layered-master.ora',await ora.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
 }
 console.log('Unified scene, two layouts, PNG and JPEG exports, editable SVG and five-layer ORA masters saved.');
})().catch(e=>{console.error(e);process.exit(1)});
