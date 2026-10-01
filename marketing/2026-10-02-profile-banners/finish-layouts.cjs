const fs=require('fs'),path=require('path');
const deps='C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const sharp=require(deps+'sharp');
const {createCanvas,GlobalFonts}=require(deps+'@napi-rs/canvas');
const JSZip=require(deps+'jszip');
const out=__dirname,L=path.join(out,'layers');
const W=3000,H=1000;
const fonts='C:/Users/sk640/.agents/skills/canvas-design/canvas-fonts/';
fs.mkdirSync(path.join(out,'fonts'),{recursive:true});
for(const n of ['Outfit-Bold.ttf','Outfit-Regular.ttf','Outfit-OFL.txt'])fs.copyFileSync(fonts+n,path.join(out,'fonts',n));
GlobalFonts.registerFromPath(fonts+'Outfit-Bold.ttf','Corporator Outfit Bold');
GlobalFonts.registerFromPath(fonts+'Outfit-Regular.ttf','Corporator Outfit Regular');
const fontEmbed=`@font-face{font-family:Outfit;src:url(data:font/ttf;base64,${fs.readFileSync(fonts+'Outfit-Regular.ttf').toString('base64')});font-weight:400;}@font-face{font-family:Outfit;src:url(data:font/ttf;base64,${fs.readFileSync(fonts+'Outfit-Bold.ttf').toString('base64')});font-weight:700;}`;
const uri=p=>'data:image/png;base64,'+fs.readFileSync(p).toString('base64');
const fullSvgGroup=(id,label,content)=>`<g id="${id}" inkscape:groupmode="layer" inkscape:label="${label}">${content}</g>`;
const imgSvg=(p,x,y,w,h)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="${uri(p)}"/>`;
function textLayer(text,size,x,baseline,bold){
  const c=createCanvas(W,H),ctx=c.getContext('2d');
  ctx.font=`${size}px "Corporator Outfit ${bold?'Bold':'Regular'}"`;ctx.fillStyle='#21282f';ctx.fillText(text,x,baseline);
  console.log(text,'width',ctx.measureText(text).width,'size',size);
  return c.toBuffer('image/png');
}
async function main(){
  await sharp(path.join(L,'brand-lockup.png')).extract({left:0,top:474,width:566,height:104}).png().toFile(path.join(L,'corp-wordmark.png'));
  for(const version of ['x','dexscreener']){
    const coin=version==='dexscreener';
    const title={text:'CORPORATOR',size:coin?148:164,x:coin?605:246,y:coin?465:490};
    const tagline={text:'A city worth running.',size:70,x:249,y:597};
    const icon=coin?{p:path.join(L,'token-original.png'),x:246,y:300,w:290,h:296}:{p:path.join(L,'brand-mark.png'),x:251,y:241,w:104,h:121};
    const word={p:path.join(L,'corp-wordmark.png'),x:610,y:523,w:333,h:61};
    const titleP=path.join(L,version+'-title.png');fs.writeFileSync(titleP,textLayer(title.text,title.size,title.x,title.y,true));
    const layers=[{name:'Sky — generated environment only',p:path.join(L,'sky.png'),x:0,y:0},{name:'Terra — original game capture, uniform scale 0.55',p:path.join(L,'island.png'),x:1880,y:40}];
    const iconP=path.join(L,version+'-brand.png');await sharp(icon.p).resize(icon.w,icon.h,{fit:'fill'}).png().toFile(iconP);
    layers.push({name:coin?'Token — exact original':'Corporator — original extracted mark',p:iconP,x:icon.x,y:icon.y});
    layers.push({name:'Title — CORPORATOR',p:titleP,x:0,y:0});
    if(coin){
      const wordP=path.join(L,'dexscreener-corp.png');await sharp(word.p).resize(word.w,word.h).png().toFile(wordP);layers.push({name:'$CORP — original wordmark',p:wordP,x:word.x,y:word.y});
    }else{
      const tagP=path.join(L,'x-tagline.png');fs.writeFileSync(tagP,textLayer(tagline.text,tagline.size,tagline.x,tagline.y,false));layers.push({name:'Tagline — A city worth running.',p:tagP,x:0,y:0});
    }
    const master=path.join(out,version+'-3000x1000.png');
    await sharp({create:{width:W,height:H,channels:4,background:'#80c7f3'}}).composite(layers.map(l=>({input:l.p,left:l.x,top:l.y}))).flatten({background:'#80c7f3'}).png().toFile(master);
    await sharp(master).resize(1500,500).png({compressionLevel:9}).toFile(path.join(out,version+'-1500x500.png'));
    await sharp(master).resize(600,200).png().toFile(path.join(out,version+'-preview-600x200.png'));
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="3000" height="1000" viewBox="0 0 3000 1000"><title>Corporator — City awaits its manager — ${version}</title><defs><style>${fontEmbed}</style></defs>`;
    svg+=fullSvgGroup('sky','01 · Sky',imgSvg(path.join(L,'sky.png'),0,0,W,H));
    svg+=fullSvgGroup('island','02 · Original Terra',imgSvg(path.join(L,'island.png'),1880,40,957,935));
    svg+=fullSvgGroup('brand','03 · Original brand',imgSvg(icon.p,icon.x,icon.y,icon.w,icon.h));
    svg+=fullSvgGroup('title','04 · Editable title',`<text x="${title.x}" y="${title.y}" font-family="Outfit" font-weight="700" font-size="${title.size}" fill="#21282f">CORPORATOR</text>`);
    if(coin)svg+=fullSvgGroup('corp','05 · Original $CORP wordmark',imgSvg(word.p,word.x,word.y,word.w,word.h));
    else svg+=fullSvgGroup('tagline','05 · Editable tagline',`<text x="${tagline.x}" y="${tagline.y}" font-family="Outfit" font-weight="400" font-size="${tagline.size}" fill="#21282f">A city worth running.</text>`);
    svg+='</svg>';fs.writeFileSync(path.join(out,version+'-editable-master.svg'),svg);
    const zip=new JSZip();zip.file('mimetype','image/openraster',{compression:'STORE'});
    const xml=[];
    for(let i=layers.length-1;i>=0;i--){const l=layers[i],n=`data/layer${i}.png`;zip.file(n,fs.readFileSync(l.p));xml.push(`<layer name="${l.name.replaceAll('&','&amp;')}" src="${n}" x="${l.x}" y="${l.y}" opacity="1.0" visibility="visible" composite-op="svg:src-over"/>`);}
    zip.file('stack.xml',`<?xml version="1.0" encoding="UTF-8"?><image w="3000" h="1000" name="Corporator ${version}"><stack>${xml.join('')}</stack></image>`);
    zip.file('mergedimage.png',fs.readFileSync(master));zip.file('Thumbnails/thumbnail.png',await sharp(master).resize(256,85).png().toBuffer());
    fs.writeFileSync(path.join(out,version+'-layered-master.ora'),await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
  }
  console.log('Two layouts, editable SVG masters, layered OpenRaster masters and small previews saved.');
}
main().catch(e=>{console.error(e);process.exit(1);});
