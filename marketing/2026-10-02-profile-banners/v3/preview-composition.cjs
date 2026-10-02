const fs=require('fs'),path=require('path');const deps='C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const sharp=require(deps+'sharp'),{createCanvas,GlobalFonts}=require(deps+'@napi-rs/canvas');const out=__dirname;
GlobalFonts.registerFromPath('C:/Users/sk640/.agents/skills/canvas-design/canvas-fonts/Outfit-Bold.ttf','Outfit Bold');
(async()=>{
 fs.mkdirSync(out+'/layers',{recursive:true});
 await sharp(out+'/sky-generated-original.png').resize(3000,1000).png().toFile(out+'/layers/sky.png');
 await sharp(out+'/team-generated-original.png').resize({width:1580}).png().toFile(out+'/layers/team.png');
 const island=await sharp(out+'/island-draft-refined.png').resize(3000,1000).toBuffer();
 const team=await sharp(out+'/layers/team.png').metadata();
 const title=createCanvas(3000,1000),ctx=title.getContext('2d');ctx.font='210px "Outfit Bold"';ctx.textAlign='center';ctx.shadowColor='rgba(7,22,44,.75)';ctx.shadowBlur=14;ctx.shadowOffsetY=8;ctx.fillStyle='#f8ead1';ctx.fillText('CORPORATOR',1510,950);
 await sharp(out+'/layers/sky.png').composite([{input:island,left:0,top:0},{input:out+'/layers/team.png',left:430,top:345},{input:title.toBuffer('image/png'),left:0,top:0}]).png().toFile(out+'/composition-draft.png');
 console.log({teamWidth:team.width,teamHeight:team.height});
})();
