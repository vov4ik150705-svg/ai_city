const fs=require('fs'),path=require('path');
const deps='C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const sharp=require(deps+'sharp'),{createCanvas,loadImage}=require(deps+'@napi-rs/canvas');
const root='C:/Users/sk640/ai_city',out=__dirname;
fs.mkdirSync(path.join(out,'references'),{recursive:true});
const roles=[['Engineer','Engineer'],['Logistician','Logistician'],['Scientist','scientist'],['Manager','manager'],['Trader','trader']];
(async()=>{
 const c=createCanvas(3000,1500),cx=c.getContext('2d');cx.fillStyle='#dee5ed';cx.fillRect(0,0,c.width,c.height);
 for(let i=0;i<roles.length;i++){
  const [name,file]=roles[i],src=root+'/media/units/'+file+'.png';
  const im=await sharp(src).trim({background:'#00000000',threshold:5}).toBuffer();
  const resized=await sharp(im).resize({width:580,height:1350,fit:'inside'}).toBuffer();const image=await loadImage(resized);
  cx.drawImage(image,i*600+(600-image.width)/2,120);cx.font='bold 38px sans-serif';cx.fillStyle='#172434';cx.fillText(name,i*600+32,70);
 }
 fs.writeFileSync(out+'/references/role-originals.png',c.toBuffer('image/png'));
 const sheets=createCanvas(4096,2480),sx=sheets.getContext('2d');sx.fillStyle='white';sx.fillRect(0,0,4096,2480);
 for(let i=0;i<roles.length;i++){const src=root+'/media/kit/roles/'+roles[i][0].toLowerCase()+'.png';const im=await loadImage(src);sx.drawImage(im,(i%2)*2048,Math.floor(i/2)*826,2048,826);}
 fs.writeFileSync(out+'/references/role-sheets.png',sheets.toBuffer('image/png'));
 const names=[['City Hall','city_hall'],['Finance Tower','finance_tower'],['Cloud Campus','cloud_campus'],['AI Research Center','ai_research_center'],['Flagship Store','flagship_store'],['Bank','bank'],['Agent Hub','agent_hub'],['Neon Residence','neon_residence']];
 const bc=createCanvas(4096,4000),bx=bc.getContext('2d');bx.fillStyle='#dce3ea';bx.fillRect(0,0,4096,4000);
 for(let i=0;i<names.length;i++){
  const x=(i%2)*2048,y=Math.floor(i/2)*1000;
  const p=await sharp(root+'/media/buildings/'+names[i][0]+'.png').resize(590,900,{fit:'inside'}).toBuffer();const im=await loadImage(p);bx.drawImage(im,x+(640-im.width)/2,y+50);
  const sheet=await loadImage(root+'/media/kit/buildings/'+names[i][1]+'.png');bx.drawImage(sheet,x+640,y,1408,1000);
 }
 fs.writeFileSync(out+'/references/building-originals-and-sheets.png',bc.toBuffer('image/png'));
 console.log('Reference boards saved.');
})().catch(e=>{console.error(e);process.exit(1)});
