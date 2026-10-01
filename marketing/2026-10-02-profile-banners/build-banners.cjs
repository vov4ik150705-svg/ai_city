const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = 'C:/Users/sk640/ai_city';
const out = __dirname;
const layerDir = path.join(out,'layers');
fs.mkdirSync(layerDir,{recursive:true});
const W=3000,H=1000;
async function main(){
  fs.copyFileSync('C:/Users/sk640/.codex/generated_images/01a0f97d-f601-7a90-aa04-789c7cf65984/exec-0cad99ca-3b5c-4861-b1db-de860dc6e8ba.png',path.join(out,'sky-generated-original.png'));
  await sharp(path.join(out,'sky-generated-original.png')).resize(W,H,{fit:'cover'}).png().toFile(path.join(layerDir,'sky.png'));
  const {data,info}=await sharp(path.join(root,'media/island/island_04_hero_walk_left.png')).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const cut={left:1080,top:460,width:1740,height:1700};
  const rgba=Buffer.alloc(cut.width*cut.height*4);
  const skyRows=[];
  for(let y=0;y<info.height;y++) {
    const v=[0,0,0];
    for(let x=0;x<20;x++) for(let c=0;c<3;c++)v[c]+=data[(y*info.width+x)*3+c]/20;
    skyRows.push(v);
  }
  for(let y=0;y<cut.height;y++)for(let x=0;x<cut.width;x++) {
    const sy=y+cut.top,sx=x+cut.left,s=(sy*info.width+sx)*3,d=(y*cut.width+x)*4;
    const color=[data[s],data[s+1],data[s+2]],bg=skyRows[sy];
    const delta=Math.max(...color.map((v,c)=>Math.abs(v-bg[c])));
    let a=Math.max(0,Math.min(1,(delta-2.5)/6));
    // Only the original bottom cloud bed feathers into the generated background.
    if(sy>2060 && color[0]>180 && color[1]>190 && color[2]>200) a*=Math.max(0,(2160-sy)/100);
    for(let c=0;c<3;c++)rgba[d+c]=color[c];
    rgba[d+3]=Math.round(255*a);
  }
  const rawPng=await sharp(rgba,{raw:{width:cut.width,height:cut.height,channels:4}}).png().toBuffer();
  await sharp(rawPng).png().toFile(path.join(layerDir,'island-source-cutout.png'));
  const sw=957,sh=935; // exact 0.55 uniform scale: 1740 × .55, 1700 × .55
  await sharp(rawPng).resize(sw,sh,{kernel:'lanczos3'}).png().toFile(path.join(layerDir,'island.png'));
  const islandPos={x:1880,y:40,width:sw,height:sh};
  await sharp(path.join(layerDir,'sky.png')).composite([{input:path.join(layerDir,'island.png'),left:islandPos.x,top:islandPos.y}]).png().toFile(path.join(out,'scene-clean-3000x1000.png'));
  await sharp(path.join(out,'scene-clean-3000x1000.png')).resize(1500,500).png().toFile(path.join(out,'scene-clean-1500x500.png'));
  // The logo lockup is extracted from the supplied original, never redrawn.
  const lr=await sharp(path.join(root,'media/corporator_logo/logo solo.png')).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const lrgba=Buffer.alloc(lr.info.width*lr.info.height*4);
  for(let i=0;i<lr.info.width*lr.info.height;i++){
    const r=lr.data[i*3],g=lr.data[i*3+1],b=lr.data[i*3+2];
    const a=Math.max(0,Math.min(1,(245-Math.min(r,g,b))/35));
    lrgba[i*4]=r;lrgba[i*4+1]=g;lrgba[i*4+2]=b;lrgba[i*4+3]=Math.round(255*a);
  }
  await sharp(lrgba,{raw:{width:lr.info.width,height:lr.info.height,channels:4}}).extract({left:344,top:324,width:566,height:578}).png().toFile(path.join(layerDir,'brand-lockup.png'));
  await sharp(lrgba,{raw:{width:lr.info.width,height:lr.info.height,channels:4}}).extract({left:441,top:324,width:374,height:434}).png().toFile(path.join(layerDir,'brand-mark.png'));
  await sharp(path.join(root,'media/corporator_logo/logo token.png')).trim().png().toFile(path.join(layerDir,'token-original.png'));
  const metadata={canvas:{width:W,height:H},islandSource:'media/island/island_04_hero_walk_left.png',sourceCrop:cut,islandScale:0.55,islandPosition:islandPos,typography:{title:'CORPORATOR',tagline:'A city worth running.',titleFont:'Outfit Bold',taglineFont:'Outfit Regular'},note:'Island architecture and signs copied from original game capture; generated pixels belong to sky/clouds only.'};
  fs.writeFileSync(path.join(out,'layout.json'),JSON.stringify(metadata,null,2));
  console.log('Scene and separate source layers saved.');
}
main().catch(e=>{console.error(e);process.exit(1);});
