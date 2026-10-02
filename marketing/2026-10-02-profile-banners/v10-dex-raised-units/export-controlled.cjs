const fs=require('fs'),path=require('path'),crypto=require('crypto');
const deps='C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const sharp=require(deps+'sharp'),JSZip=require(deps+'jszip'),{createCanvas,loadImage}=require(deps+'@napi-rs/canvas');
const out=__dirname,W=3000,H=1000,hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const settings={teamWidth:1680,teamLeft:660,teamTop:405,fadeStart:780,fadeEnd:885};
const cfg=JSON.parse(fs.readFileSync(out+'/title-layout.json','utf8'));
(async()=>{
  const bg=await sharp(out+'/background-generated.png').metadata();if(bg.width/bg.height!==3)throw Error('Background ratio');
  await sharp(out+'/background-generated.png').resize({width:W}).png().toFile(out+'/background-3000x1000.png');
  const meta=await sharp(out+'/team-generated.png').metadata();if(!meta.hasAlpha)throw Error('Team alpha required');
  const raw=await sharp(out+'/team-generated.png').ensureAlpha().raw().toBuffer();let minX=meta.width,minY=meta.height,maxX=-1,maxY=-1;
  for(let y=0;y<meta.height;y++)for(let x=0;x<meta.width;x++){if(raw[(y*meta.width+x)*4+3]>32){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
  const left=Math.max(0,minX-10),top=Math.max(0,minY-10),right=Math.min(meta.width,maxX+11),bottom=Math.min(meta.height,maxY+11);
  const crop={left,top,width:right-left,height:bottom-top};
  await sharp(out+'/team-generated.png').extract(crop).resize({width:settings.teamWidth}).png().toFile(out+'/layers/team-cropped.png');
  const c=createCanvas(W,H),ctx=c.getContext('2d');ctx.drawImage(await loadImage(out+'/layers/team-cropped.png'),settings.teamLeft,settings.teamTop);
  ctx.globalCompositeOperation='destination-in';const mask=ctx.createLinearGradient(0,settings.fadeStart,0,settings.fadeEnd);mask.addColorStop(0,'rgba(0,0,0,1)');mask.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=mask;ctx.fillRect(0,0,W,H);
  fs.writeFileSync(out+'/layers/team-raised.png',c.toBuffer('image/png'));
  await sharp(out+'/background-3000x1000.png').composite([{input:out+'/layers/team-raised.png',left:0,top:0}]).png().toFile(out+'/scene-clean-3000x1000.png');
  await sharp(out+'/scene-clean-3000x1000.png').resize(1500,500).png().toFile(out+'/scene-clean-1500x500.png');
  const layers=[{name:'01 · Generated island background',p:'background-3000x1000.png'},{name:'02 · Raised five-agent team',p:'layers/team-raised.png'},{name:'03 · Original V9 3D title',p:'layers/title-3d.png'},{name:'04 · Foreground clouds',p:'layers/foreground-clouds.png'}];
  const master=out+'/dexscreener-3000x1000.png';await sharp(out+'/background-3000x1000.png').composite(layers.slice(1).map(l=>({input:out+'/'+l.p,left:0,top:0}))).flatten().png().toFile(master);
  for(const [w,h,n] of [[1500,500,'1500x500'],[600,200,'preview-600x200'],[300,100,'preview-300x100']])await sharp(master).resize(w,h).png().toFile(out+'/dexscreener-'+n+'.png');
  await sharp(master).resize(1500,500).jpeg({quality:95,chromaSubsampling:'4:4:4',mozjpeg:true}).toFile(out+'/dexscreener-1500x500.jpg');
  const css='@font-face{font-family:CorporatorGame;src:url(data:font/ttf;base64,'+fs.readFileSync(out+'/fonts/TT-Octosquares-Trial-Condensed-Black.ttf').toString('base64')+');font-weight:900;}';
  let svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="3000" height="1000" viewBox="0 0 3000 1000"><title>Corporator — raised agents</title><defs><style>'+css+'</style></defs>';
  for(let i=0;i<layers.length;i++)svg+='<g id="layer-'+i+'" inkscape:groupmode="layer" inkscape:label="'+layers[i].name+'"><image x="0" y="0" width="3000" height="1000" href="data:image/png;base64,'+fs.readFileSync(out+'/'+layers[i].p).toString('base64')+'"/></g>';
  svg+='<g id="editable-font-source" inkscape:groupmode="layer" inkscape:label="Hidden original game-font text" style="display:none"><text x="'+cfg.x+'" y="'+cfg.y+'" font-family="CorporatorGame" font-weight="900" font-size="'+cfg.size+'">CORPORATOR</text></g></svg>';fs.writeFileSync(out+'/dexscreener-editable-master.svg',svg);
  const ora=new JSZip();ora.file('mimetype','image/openraster',{compression:'STORE'});let xml='';for(let i=layers.length-1;i>=0;i--){ora.file('data/layer'+i+'.png',fs.readFileSync(out+'/'+layers[i].p));xml+='<layer name="'+layers[i].name+'" src="data/layer'+i+'.png" x="0" y="0" opacity="1" visibility="visible" composite-op="svg:src-over"/>';}
  ora.file('stack.xml','<?xml version="1.0" encoding="UTF-8"?><image w="3000" h="1000" name="Corporator raised units"><stack>'+xml+'</stack></image>');ora.file('mergedimage.png',fs.readFileSync(master));ora.file('Thumbnails/thumbnail.png',await sharp(master).resize(256,85).png().toBuffer());fs.writeFileSync(out+'/dexscreener-layered-master.ora',await ora.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
  const titleHash=hash(fs.readFileSync(out+'/layers/title-3d.png')),oldTitleHash=hash(fs.readFileSync(out+'/../v9-dex-volume/layers/title-3d.png'));if(titleHash!==oldTitleHash)throw Error('Title changed');
  const result={date:'2026-10-02',teamLayout:settings,teamSourceCrop:crop,titleUnchangedFromV9:true,titleSha256:titleHash,oraLayers:layers.length,sources:{background:{width:bg.width,height:bg.height},team:{width:meta.width,height:meta.height,hasAlpha:meta.hasAlpha}},exports:[]};
  for(const p of ['dexscreener-3000x1000.png','dexscreener-1500x500.png','dexscreener-1500x500.jpg','dexscreener-preview-600x200.png','dexscreener-preview-300x100.png']){const m=await sharp(out+'/'+p).metadata();if(m.width/m.height!==3)throw Error('Export aspect ratio');result.exports.push({file:p,width:m.width,height:m.height,bytes:fs.statSync(out+'/'+p).size});}
  fs.writeFileSync(out+'/layout.json',JSON.stringify(settings,null,2));fs.writeFileSync(out+'/file-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
