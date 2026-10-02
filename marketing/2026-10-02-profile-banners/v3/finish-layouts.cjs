const fs=require('fs'),path=require('path');
const deps='C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const sharp=require(deps+'sharp'),JSZip=require(deps+'jszip'),{createCanvas,GlobalFonts}=require(deps+'@napi-rs/canvas');
const out=__dirname,L=out+'/layers',W=3000,H=1000;
const fonts='C:/Users/sk640/.agents/skills/canvas-design/canvas-fonts/';
fs.mkdirSync(L,{recursive:true});fs.mkdirSync(out+'/fonts',{recursive:true});
for(const n of ['Outfit-Bold.ttf','Outfit-Regular.ttf','Outfit-OFL.txt'])fs.copyFileSync(fonts+n,out+'/fonts/'+n);
GlobalFonts.registerFromPath(fonts+'Outfit-Bold.ttf','Corporator Bold');GlobalFonts.registerFromPath(fonts+'Outfit-Regular.ttf','Corporator Regular');
const css=`@font-face{font-family:Outfit;src:url(data:font/ttf;base64,${fs.readFileSync(fonts+'Outfit-Bold.ttf').toString('base64')});font-weight:700;}@font-face{font-family:Outfit;src:url(data:font/ttf;base64,${fs.readFileSync(fonts+'Outfit-Regular.ttf').toString('base64')});font-weight:400;}`;
const uri=p=>'data:image/png;base64,'+fs.readFileSync(p).toString('base64');
const img=(p,x,y,w,h)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="${uri(p)}"/>`;
const group=(id,label,body)=>`<g id="${id}" inkscape:groupmode="layer" inkscape:label="${label}">${body}</g>`;
const title={x:1400,y:945,size:220,text:'CORPORATOR',depth:12};
function titleCanvas(){const c=createCanvas(W,H),ctx=c.getContext('2d');ctx.font=`700 ${title.size}px "Corporator Bold"`;ctx.textAlign='center';
 ctx.shadowColor='rgba(12,27,47,.38)';ctx.shadowBlur=12;ctx.shadowOffsetY=7;ctx.fillStyle='#243746';ctx.fillText(title.text,title.x+4,title.y+title.depth);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 for(let d=title.depth;d>0;d--){ctx.fillStyle=d>9?'#be9a5c':d>4?'#665e52':'#aaa28f';ctx.fillText(title.text,title.x+d*.28,title.y+d);}
 const g=ctx.createLinearGradient(0,title.y-168,0,title.y);g.addColorStop(0,'#fff9e9');g.addColorStop(.48,'#f1e9d6');g.addColorStop(1,'#d6c9ae');ctx.fillStyle=g;ctx.fillText(title.text,title.x,title.y);return c.toBuffer('image/png');}
function titleSVG(){let s='';for(let d=title.depth;d>0;d--)s+=`<use href="#title-glyphs" transform="translate(${d*.28} ${d})" fill="${d>9?'#be9a5c':d>4?'#665e52':'#aaa28f'}"/>`;return s+`<use href="#title-glyphs" fill="url(#title-face)"/>`;}
async function resized(source,width,name){const p=L+'/'+name,m=await sharp(source).metadata();const h=Math.round(width*m.height/m.width);await sharp(source).resize(width,h).png().toFile(p);return {p,w:width,h};}
(async()=>{
 await sharp(out+'/sky-generated-original.png').resize(W,H).png().toFile(L+'/sky.png');
 fs.copyFileSync(out+'/island-render-3000x1000.png',L+'/terra-render.png');
 const teamSource=await sharp(out+'/team-generated-original.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 // This is an atmospheric foreground mask at the upper-thigh crop; faces, hands and role objects are untouched.
 const {data,info}=teamSource;
 for(let y=0;y<info.height;y++){const fade=Math.max(0,Math.min(1,(info.height-1-y)/65));if(fade>=1)continue;for(let x=0;x<info.width;x++){const i=(y*info.width+x)*4+3;data[i]=Math.round(data[i]*fade);}}
 await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).resize({width:1580}).png().toFile(L+'/team-foreground.png');
 const teamMeta=await sharp(L+'/team-foreground.png').metadata();const team={p:L+'/team-foreground.png',x:430,y:250,w:teamMeta.width,h:teamMeta.height};
 for(const n of ['brand-mark.png','token-original.png','corp-wordmark.png'])fs.copyFileSync(out+'/../v2/layers/'+n,L+'/'+n);
 const mark=await resized(L+'/brand-mark.png',92,'x-brand-mark.png');const token=await resized(L+'/token-original.png',175,'dexscreener-token.png');const corp=await resized(L+'/corp-wordmark.png',326,'dexscreener-corp-wordmark.png');
 fs.writeFileSync(L+'/title-dimensional.png',titleCanvas());
 const tag=createCanvas(W,H),tx=tag.getContext('2d');tx.font='44px "Corporator Regular"';tx.textAlign='center';tx.fillStyle='#f7f2e7';tx.shadowColor='rgba(9,28,51,.9)';tx.shadowBlur=8;tx.shadowOffsetY=2;tx.fillText('A city worth running.',title.x,987);fs.writeFileSync(L+'/x-tagline.png',tag.toBuffer('image/png'));
 const sceneLayers=[{name:'01 · Sky and layered clouds',p:L+'/sky.png',x:0,y:0},{name:'02 · Canonical Terra — original 3D geometry',p:L+'/terra-render.png',x:0,y:0},{name:'03 · Five roles — foreground',p:team.p,x:team.x,y:team.y}];
 const clean=out+'/scene-clean-3000x1000.png';await sharp(L+'/sky.png').composite(sceneLayers.slice(1).map(l=>({input:l.p,left:l.x,top:l.y}))).png().toFile(clean);await sharp(clean).resize(1500,500).png().toFile(out+'/scene-clean-1500x500.png');
 const layouts={title,team:{...team,p:'layers/team-foreground.png'},sky:'layers/sky.png',terra:'layers/terra-render.png',versions:{}};
 for(const version of ['x','dexscreener']){
  const dex=version==='dexscreener';const brand=dex?{...token,x:2700,y:110}:{...mark,x:160,y:110};const word={...corp,x:2610,y:320};
  const layers=[...sceneLayers,{name:'04 · CORPORATOR — dimensional editable lettering',p:L+'/title-dimensional.png',x:0,y:0},{name:dex?'05 · Original token':'05 · Original Corporator mark',p:brand.p,x:brand.x,y:brand.y}];
  if(dex)layers.push({name:'06 · Original $CORP wordmark',p:word.p,x:word.x,y:word.y});else layers.push({name:'06 · A city worth running.',p:L+'/x-tagline.png',x:0,y:0});
  const master=out+'/'+version+'-3000x1000.png';await sharp(L+'/sky.png').composite(layers.slice(1).map(l=>({input:l.p,left:l.x,top:l.y}))).flatten().png().toFile(master);
  for(const width of [1500,600])await sharp(master).resize(width,width/3).png({compressionLevel:9}).toFile(out+'/'+version+(width===600?'-preview-600x200.png':'-1500x500.png'));
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="3000" height="1000" viewBox="0 0 3000 1000"><title>Corporator — canonical Terra and five-role team — ${version}</title><defs><style>${css}</style><linearGradient id="title-face" x1="0" y1="${title.y-168}" x2="0" y2="${title.y}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff9e9"/><stop offset=".48" stop-color="#f1e9d6"/><stop offset="1" stop-color="#d6c9ae"/></linearGradient><text id="title-glyphs" x="${title.x}" y="${title.y}" text-anchor="middle" font-family="Outfit" font-weight="700" font-size="${title.size}">CORPORATOR</text><filter id="soft-shadow" x="-.2" y="-.4" width="1.4" height="2"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#091c33" flood-opacity=".7"/></filter></defs>`;
  svg+=group('sky','01 · Sky',img(L+'/sky.png',0,0,W,H));svg+=group('terra','02 · Original 3D Terra',img(L+'/terra-render.png',0,0,W,H));svg+=group('team','03 · Five-role foreground',img(team.p,team.x,team.y,team.w,team.h));svg+=group('title','04 · Editable CORPORATOR',`<g filter="url(#soft-shadow)">${titleSVG()}</g>`);svg+=group('brand','05 · Exact original brand',img(brand.p,brand.x,brand.y,brand.w,brand.h));
  svg+=dex?group('corp','06 · Original $CORP',img(word.p,word.x,word.y,word.w,word.h)):group('tagline','06 · Editable tagline',`<text x="${title.x}" y="987" text-anchor="middle" font-family="Outfit" font-weight="400" font-size="44" fill="#f7f2e7" filter="url(#soft-shadow)">A city worth running.</text>`);svg+='</svg>';fs.writeFileSync(out+'/'+version+'-editable-master.svg',svg);
  const ora=new JSZip();ora.file('mimetype','image/openraster',{compression:'STORE'});const xml=[];
  for(let i=layers.length-1;i>=0;i--){const l=layers[i],p='data/layer'+i+'.png';ora.file(p,fs.readFileSync(l.p));xml.push(`<layer name="${l.name}" src="${p}" x="${l.x}" y="${l.y}" opacity="1" visibility="visible" composite-op="svg:src-over"/>`);}
  ora.file('stack.xml',`<?xml version="1.0" encoding="UTF-8"?><image w="3000" h="1000" name="Corporator ${version}"><stack>${xml.join('')}</stack></image>`);ora.file('mergedimage.png',fs.readFileSync(master));ora.file('Thumbnails/thumbnail.png',await sharp(master).resize(256,85).png().toBuffer());fs.writeFileSync(out+'/'+version+'-layered-master.ora',await ora.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
  layouts.versions[version]={brand:{x:brand.x,y:brand.y,w:brand.w,h:brand.h},originalCorp:dex?{x:word.x,y:word.y,w:word.w,h:word.h}:null,tagline:dex?null:'A city worth running.'};
 }
 fs.writeFileSync(out+'/layout.json',JSON.stringify(layouts,null,2));console.log('Clean scene, two PNG layouts, editable SVG masters and six-layer ORA masters saved.');
})().catch(e=>{console.error(e);process.exit(1)});
