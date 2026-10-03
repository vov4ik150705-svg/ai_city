// Export the approved mockup as individual UI sprite assets and an art plate.
// image_gen created the clean background; this script only assembles/export layers.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const deps = process.env.CORPORATOR_NODE_DEPS || 'C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sharp = require(path.join(deps, 'sharp'));
const root = path.resolve(__dirname, '../../../../..');
const out = __dirname;
const approved = path.join(out, '../generated-concepts-2026-10-03/08-manager-city-waiting-brand-v3.png');
const generated = 'C:/Users/sk640/.codex/generated_images/01a0f104-e1ce-7e10-bebb-bc470772ef2c/exec-35d860a4-7f8a-415e-90a6-97f4932bc02e.png';
const official = path.join(root, 'website/brand/robinhood-chain/robinhood-chain-brand-assets-v1/Robinhood Chain Brand Assets - V1/Robinhood Chain Logo/Robinhood_Chain_Logo_Black');
const W = 1672, H = 941;
const panel = {x:1050,y:95,w:600,h:780};
const outer = '1114,100 1597,101 1642,142 1648,807 1600,862 1107,864 1063,819 1057,471 1072,452 1072,142';
const parts = {
  'header-label': {x:1175,y:144,w:193,h:24,text:'CITY ACCESS'},
  'headline': {x:1116,y:224,w:489,h:189,text:'YOUR CITY IS WAITING'},
  'intro': {x:1118,y:429,w:439,h:57,text:'Welcome to Corporator.\nConnect your wallet. Your city awaits.'},
  'steps-idle': {x:1127,y:527,w:433,h:58,text:'01 CONNECT → 02 SIGN IN'},
  'connect-idle': {x:1099,y:593,w:518,h:140,text:'CONNECT WALLET'},
  'trust-note': {x:1111,y:744,w:281,h:79,text:'Sign a message.\nNo transaction.'},
  'demo-idle': {x:1396,y:744,w:219,h:82,text:'TRY DEMO'},
};
const svg = content => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${content}</svg>`);
const rect = r => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="black"/>`;
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
async function cropped(name,r) { await sharp(approved).extract({left:r.x,top:r.y,width:r.w,height:r.h}).png().toFile(path.join(out,'assets',name+'.png')); }
async function run() {
  for (const dir of ['assets','assets/brand','fonts','reference','previews']) fs.mkdirSync(path.join(out,dir), {recursive:true});
  fs.copyFileSync(approved, path.join(out,'reference/approved-desktop.png'));
  fs.copyFileSync(generated, path.join(out,'assets/art-clean-generated.png'));
  const cleanMeta = await sharp(generated).metadata();
  if (cleanMeta.width !== W || cleanMeta.height !== H) throw Error('Background geometry differs from approved canvas.');
  const maskRemove = [{x:35,y:15,w:331,h:90},{x:1378,y:21,w:264,h:73},{x:0,y:872,w:124,h:69},{x:1048,y:94,w:608,h:783}];
  const artMask = svg(`<defs><mask id="keep"><rect width="${W}" height="${H}" fill="white"/>${maskRemove.map(rect).join('')}</mask></defs><rect width="${W}" height="${H}" fill="white" mask="url(#keep)"/>`);
  const exactVisible = await sharp(approved).ensureAlpha().composite([{input:artMask,blend:'dest-in'}]).png().toBuffer();
  await sharp(exactVisible).png().toFile(path.join(out,'assets/art-visible-original.png'));
  await sharp(generated).composite([{input:exactVisible}]).png().toFile(path.join(out,'assets/art-desktop.png'));
  // Preserve the exact bevels, screws, header and inset; cut component apertures.
  const frameMask = svg(`<defs><mask id="frame"><polygon points="${outer}" fill="white"/>${Object.values(parts).map(rect).join('')}</mask></defs><rect width="${W}" height="${H}" fill="white" mask="url(#frame)"/>`);
  const frameFull = await sharp(approved).ensureAlpha().composite([{input:frameMask,blend:'dest-in'}]).png().toBuffer();
  await sharp(frameFull).extract({left:panel.x,top:panel.y,width:panel.w,height:panel.h}).png().toFile(path.join(out,'assets/panel-shell.png'));
  for (const [name,r] of Object.entries(parts)) await cropped(name,r);
  await cropped('brand-lockup-exact',{x:45,y:21,w:316,h:82});
  await cropped('robinhood-badge-exact',{x:1378,y:21,w:264,h:73});
  await cropped('back-link-exact',{x:0,y:872,w:124,h:69});
  // A code-native, editable shell for a fluid mobile layout and non-idle states.
  const shellSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="780" viewBox="1050 95 600 780"><defs><linearGradient id="ivory" x2=".5" y2="1"><stop stop-color="#fffdf8"/><stop offset="1" stop-color="#eee8e0"/></linearGradient><linearGradient id="inset" x2=".8" y2="1"><stop stop-color="#dcecff"/><stop offset="1" stop-color="#bcd7fb"/></linearGradient><linearGradient id="header" x2="1" y2="1"><stop stop-color="#18244b"/><stop offset="1" stop-color="#0d153b"/></linearGradient></defs><polygon points="${outer}" fill="url(#ivory)" stroke="#fffdfb" stroke-width="4"/><path d="M1097 508H1615L1630 523V817L1600 846H1106L1083 822V522Z" fill="url(#inset)" stroke="#9fbef2"/><path d="M1158 127H1563L1570 134V178L1563 185H1158L1151 178V134Z" fill="url(#header)" stroke="#57698b" stroke-width="2"/>${[[1122,134],[1598,141],[1104,533],[1610,534]].map(([x,y])=>`<path d="M${x-5} ${y-10}h10l6 6v10l-6 6h-10l-6-6v-10z" fill="#5b86c9" stroke="#234b97" stroke-width="2"/>`).join('')}</svg>`;
  fs.writeFileSync(path.join(out,'assets/panel-shell-editable.svg'),shellSvg);
  fs.copyFileSync(official+'.svg',path.join(out,'assets/brand/robinhood-chain-black.svg'));
  fs.copyFileSync(official+'.png',path.join(out,'assets/brand/robinhood-chain-black.png'));
  fs.copyFileSync(path.join(root,'media/corporator_logo/logo solo.png'),path.join(out,'assets/brand/corporator-original.png'));
  // Exact source monogram, with its light paper background removed per H8.
  const source = await sharp(path.join(root,'media/corporator_logo/logo solo.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let minX=1254,minY=1254,maxX=0,maxY=0;
  for(let y=0;y<Math.floor(source.info.height*.62);y++)for(let x=0;x<source.info.width;x++){
    const i=(y*source.info.width+x)*4;
    if(source.data[i]<175&&source.data[i+1]<175&&source.data[i+2]<175){minX=Math.min(x,minX);minY=Math.min(y,minY);maxX=Math.max(x,maxX);maxY=Math.max(y,maxY);}
  }
  for(let i=0;i<source.data.length;i+=4)if(source.data[i]>220&&source.data[i+1]>220&&source.data[i+2]>220)source.data[i+3]=0;
  await sharp(source.data,{raw:{width:source.info.width,height:source.info.height,channels:4}}).extract({left:minX-2,top:minY-2,width:maxX-minX+5,height:maxY-minY+5}).png().toFile(path.join(out,'assets/brand/corporator-mark.png'));
  fs.copyFileSync(path.join(root,'website/fonts/tt-octosquares/TT-Octosquares-Trial-Condensed-Black.ttf'),path.join(out,'fonts/TT-Octosquares-Trial-Condensed-Black.ttf'));
  fs.copyFileSync(path.join(root,'website/fonts/roboto/roboto-latin.woff2'),path.join(out,'fonts/roboto-latin.woff2'));
  fs.copyFileSync(path.join(root,'website/fonts/roboto/roboto-700-latin.woff2'),path.join(out,'fonts/roboto-700-latin.woff2'));
  const layout = {canvas:{width:W,height:H},panel,outerPolygon:outer,parts,brand:{x:45,y:21,w:316,h:82},chainBadge:{x:1378,y:21,w:264,h:73},back:{x:0,y:872,w:124,h:69},background:{generated:'assets/art-clean-generated.png',production:'assets/art-desktop.png',visibleOriginal:'assets/art-visible-original.png',restoredRegions:maskRemove},tokens:{ink:'#070d43',blue:'#0057ff',ivory:'#f7f4ed',inset:'#d4e5fc',muted:'#7986a6'},sourceSha256:hash(fs.readFileSync(approved)),note:'Initial English artwork is preserved as separate sprites. Semantic DOM is independent. Native typography mode is provided for localization; fonts cannot reconstruct generated letterforms exactly.'};
  fs.writeFileSync(path.join(out,'layout.json'),JSON.stringify(layout,null,2));
  fs.writeFileSync(path.join(out,'assets/provenance.json'),JSON.stringify({approvedMockup:approved,generatedBackground:generated,tool:'Built-in image_gen: UI removal only. Original artwork outside UI bounding boxes preserved without resampling. UI assets sliced from the owner-selected reference. Logos copied from originals.',robinhoodSource:official,corporatorSource:'media/corporator_logo/logo solo.png',mockupStatus:'Owner-selected page composition; not a new canonical building/role reference.',fontStatus:'TT Octosquares Trial in repository — verify commercial web embedding license before release.'},null,2));
  console.log(JSON.stringify({out,parts:Object.keys(parts),canvas:[W,H],referenceSha256:layout.sourceSha256}));
}
run().catch(e=>{console.error(e);process.exit(1);});
