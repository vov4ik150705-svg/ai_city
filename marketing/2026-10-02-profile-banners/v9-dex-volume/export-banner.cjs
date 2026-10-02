const fs=require('fs'),path=require('path'),crypto=require('crypto');
const deps='C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const sharp=require(deps+'sharp'),JSZip=require(deps+'jszip'),out=__dirname,W=3000,H=1000;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const uri=p=>'data:image/png;base64,'+fs.readFileSync(p).toString('base64');
const cfg=JSON.parse(fs.readFileSync(out+'/title-layout.json','utf8'));
const dataImage=(p)=>'<image x="0" y="0" width="3000" height="1000" href="'+uri(p)+'"/>';
(async()=>{
fs.mkdirSync(out+'/layers',{recursive:true});
const sources=['scene-clean-generated.png','title-3d-generated.png'];
for(const p of sources){const m=await sharp(out+'/'+p).metadata();if(Math.abs(m.width/m.height-3)>.005)throw Error('Unexpected ratio: '+p);if(p.includes('title')&&!m.hasAlpha)throw Error('Title must have alpha');}
await sharp(out+'/'+sources[0]).resize({width:W}).png().toFile(out+'/scene-clean-3000x1000.png');
const titleWidth=1920,titleLeft=540,titleTop=430;
const titlePlate=await sharp(out+'/'+sources[1]).resize({width:titleWidth}).extract({left:0,top:0,width:titleWidth,height:H-titleTop}).png().toBuffer();
await sharp({create:{width:W,height:H,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:titlePlate,left:titleLeft,top:titleTop}]).png().toFile(out+'/layers/title-3d.png');
for(const p of ['scene-clean-3000x1000.png','layers/title-3d.png']){const m=await sharp(out+'/'+p).metadata();if(m.height!==H)throw Error('Uniform scaling height mismatch');}
await sharp(out+'/scene-clean-3000x1000.png').resize(1500,500).png().toFile(out+'/scene-clean-1500x500.png');
const master=out+'/dexscreener-3000x1000.png';
await sharp(out+'/scene-clean-3000x1000.png').composite([{input:out+'/layers/title-3d.png',left:0,top:0},{input:out+'/layers/foreground-clouds.png',left:0,top:0}]).flatten().png().toFile(master);
for(const [w,h,n] of [[1500,500,'1500x500'],[600,200,'preview-600x200'],[300,100,'preview-300x100']])await sharp(master).resize(w,h).png().toFile(out+'/dexscreener-'+n+'.png');
await sharp(master).resize(1500,500).jpeg({quality:95,chromaSubsampling:'4:4:4',mozjpeg:true}).toFile(out+'/dexscreener-1500x500.jpg');
const css='@font-face{font-family:CorporatorGame;src:url(data:font/ttf;base64,'+fs.readFileSync(out+'/fonts/TT-Octosquares-Trial-Condensed-Black.ttf').toString('base64')+');font-weight:900;}';
const group=(id,label,content,hidden=false)=>'<g id="'+id+'" inkscape:groupmode="layer" inkscape:label="'+label+'"'+(hidden?' style="display:none"':'')+'>'+content+'</g>';
let svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="3000" height="1000" viewBox="0 0 3000 1000"><title>Corporator — full panorama with dimensional game title</title><defs><style>'+css+'</style></defs>';
svg+=group('scene','01 · Generated full-width island and team',dataImage(out+'/scene-clean-3000x1000.png'));
svg+=group('title-3d','02 · Rendered 3D CORPORATOR — transparent asset',dataImage(out+'/layers/title-3d.png'));
svg+=group('foreground-clouds','03 · Foreground cloud wrap',dataImage(out+'/layers/foreground-clouds.png'));
svg+=group('font-source','03 · Hidden editable exact game-font source','<text x="'+cfg.x+'" y="'+cfg.y+'" font-family="CorporatorGame" font-size="'+cfg.size+'" font-weight="900" fill="#161e2b">CORPORATOR</text>',true);
svg+='</svg>';fs.writeFileSync(out+'/dexscreener-editable-master.svg',svg);
const layers=[{name:'01 · Full-width scene',p:out+'/scene-clean-3000x1000.png'},{name:'02 · Rendered 3D CORPORATOR',p:out+'/layers/title-3d.png'},{name:'03 · Foreground cloud wrap',p:out+'/layers/foreground-clouds.png'}],ora=new JSZip();ora.file('mimetype','image/openraster',{compression:'STORE'});let xml='';
for(let i=layers.length-1;i>=0;i--){ora.file('data/layer'+i+'.png',fs.readFileSync(layers[i].p));xml+='<layer name="'+layers[i].name+'" src="data/layer'+i+'.png" x="0" y="0" opacity="1" visibility="visible" composite-op="svg:src-over"/>';}
ora.file('stack.xml','<?xml version="1.0" encoding="UTF-8"?><image w="3000" h="1000" name="Corporator Dexscreener dimensional title"><stack>'+xml+'</stack></image>');ora.file('mergedimage.png',fs.readFileSync(master));ora.file('Thumbnails/thumbnail.png',await sharp(master).resize(256,85).png().toBuffer());
fs.writeFileSync(out+'/dexscreener-layered-master.ora',await ora.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
const raw=await sharp(out+'/layers/title-3d.png').ensureAlpha().raw().toBuffer();let visible=0,minX=W,minY=H,maxX=0,maxY=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(raw[(y*W+x)*4+3]>16){visible++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
const results={date:'2026-10-02',text:'CORPORATOR',promotionalSideText:false,brandToken:false,titleAlpha:true,titleTransform:{uniformWidth:titleWidth,left:titleLeft,top:titleTop},titleVisibleBounds:{minX,minY,maxX,maxY},titleVisiblePixels:visible,sceneSha256:hash(fs.readFileSync(out+'/scene-clean-3000x1000.png')),fontSource:cfg.font,oraLayers:3,sourceDimensions:[],exports:[]};
for(const p of sources){const m=await sharp(out+'/'+p).metadata();results.sourceDimensions.push({file:p,width:m.width,height:m.height,hasAlpha:m.hasAlpha});}
for(const p of ['dexscreener-3000x1000.png','dexscreener-1500x500.png','dexscreener-1500x500.jpg','dexscreener-preview-600x200.png','dexscreener-preview-300x100.png']){const m=await sharp(out+'/'+p).metadata();results.exports.push({file:p,width:m.width,height:m.height,bytes:fs.statSync(out+'/'+p).size});if(m.width/m.height!==3)throw Error('Export aspect mismatch');}
fs.writeFileSync(out+'/file-verification.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
