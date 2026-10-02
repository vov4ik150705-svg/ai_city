const fs=require('fs');const deps='C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';const sharp=require(deps+'sharp');const root='C:/Users/sk640/ai_city',out=__dirname;fs.mkdirSync(out+'/references',{recursive:true});
(async()=>{
 await sharp({create:{width:6144,height:4000,channels:4,background:'white'}}).composite([{input:root+'/marketing/2026-10-02-profile-banners/v3/references/building-originals-and-sheets.png',left:0,top:0},{input:root+'/media/kit/signs_all.png',left:4096,top:0}]).png().toFile(out+'/references/architecture-and-exact-signs.png');
 const roles=await sharp(root+'/marketing/2026-10-02-profile-banners/v3/references/role-originals.png').resize(4096,2048).toBuffer();await sharp({create:{width:4096,height:4528,channels:4,background:'white'}}).composite([{input:roles,left:0,top:0},{input:root+'/marketing/2026-10-02-profile-banners/v3/references/role-sheets.png',left:0,top:2048}]).png().toFile(out+'/references/five-role-originals-and-views.png');
 console.log('Object reference boards prepared; source artworks and prior banners are not scene components.');
})();
