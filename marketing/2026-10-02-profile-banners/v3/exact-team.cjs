const fs=require('fs'),path=require('path');const deps='C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const sharp=require(deps+'sharp');const root='C:/Users/sk640/ai_city',out=__dirname;
const roles=[{id:'engineer',src:'Engineer',crop:1080,w:350,x:430,y:275},{id:'logistician',src:'Logistician',crop:1040,w:325,x:735,y:330},{id:'scientist',src:'scientist',crop:1080,w:285,x:1030,y:290},{id:'manager',src:'manager',crop:960,w:330,x:1265,y:250},{id:'trader',src:'trader',crop:740,w:330,x:1560,y:335}];
(async()=>{
 const layers=[];
 for(const r of roles){
  const src=root+'/media/units/'+r.src+'.png';let {data,info}=await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // Remove original studio aura from the alpha only; opaque source body pixels stay unchanged.
  for(let i=3;i<data.length;i+=4)data[i]=data[i]<175?0:Math.round((data[i]-175)/80*255);
  let img=sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).extract({left:0,top:0,width:info.width,height:r.crop});
  const cut=await img.png().toBuffer();const trimmed=await sharp(cut).trim({background:'#00000000',threshold:1}).toBuffer();
  const dest=out+'/layers/role-'+r.id+'.png';await sharp(trimmed).resize({width:r.w}).png().toFile(dest);const m=await sharp(dest).metadata();
  layers.push({input:dest,left:r.x,top:r.y});r.h=m.height;r.file='layers/role-'+r.id+'.png';r.alphaOnlyCleanup=true;
 }
 fs.writeFileSync(out+'/exact-team-layout.json',JSON.stringify(roles,null,2));
 await sharp({create:{width:3000,height:1000,channels:4,background:'#00000000'}}).composite(layers).png().toFile(out+'/layers/team-exact-originals.png');
 const island=await sharp(out+'/island-draft-refined.png').resize(3000,1000).toBuffer();
 await sharp(out+'/layers/sky.png').composite([{input:island,left:0,top:0},{input:out+'/layers/team-exact-originals.png',left:0,top:0}]).png().toFile(out+'/composition-exact-team-draft.png');console.log(JSON.stringify(roles));
})();
