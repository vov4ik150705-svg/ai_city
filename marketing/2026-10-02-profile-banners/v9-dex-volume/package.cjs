const fs=require('fs'),path=require('path'),crypto=require('crypto');
const deps='C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const JSZip=require(deps+'jszip'),out=__dirname;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
  const svg=fs.readFileSync(out+'/dexscreener-editable-master.svg','utf8');
  if(!svg.includes('>CORPORATOR</text>')||!svg.includes('data:font/ttf;base64,'))throw Error('Source font/text missing');
  for(const s of ['HIRE AGENTS.','UPGRADE BUILDINGS.','RUN THE ECONOMY.'])if(svg.includes(s))throw Error('Old action column remains');
  const ora=await JSZip.loadAsync(fs.readFileSync(out+'/dexscreener-layered-master.ora'));
  if(await ora.file('mimetype').async('string')!=='image/openraster')throw Error('ORA mimetype');
  if(((await ora.file('stack.xml').async('string')).match(/<layer /g)||[]).length!==3)throw Error('Three layers expected');
  if(hash(await ora.file('data/layer0.png').async('nodebuffer'))!==hash(fs.readFileSync(out+'/scene-clean-3000x1000.png')))throw Error('Clean scene mismatch');
  if(hash(await ora.file('mergedimage.png').async('nodebuffer'))!==hash(fs.readFileSync(out+'/dexscreener-3000x1000.png')))throw Error('Merged master mismatch');
  const files=['README.md','verification-report.md','file-verification.json','scene-clean-generated.png','scene-clean-3000x1000.png','scene-clean-1500x500.png','title-3d-generated.png','title-font-guide.png','title-font-mask.png','title-layout.json','scene-generation-prompt.txt','scene-team-adjustment-prompt.txt','scene-spire-repair-prompt.txt','scene-sign-repair-prompt.txt','scene-final-team-prompt.txt','title-generation-prompt.txt','fonts/TT-Octosquares-Trial-Condensed-Black.ttf','dexscreener-editable-master.svg','dexscreener-layered-master.ora','dexscreener-3000x1000.png','dexscreener-1500x500.png','dexscreener-1500x500.jpg','dexscreener-preview-600x200.png','dexscreener-preview-300x100.png','layers/title-3d.png','layers/foreground-clouds.png'];
  const zip=new JSZip();for(const p of files)zip.file('Corporator Dexscreener V9/'+p,fs.readFileSync(out+'/'+p));
  const archive=path.resolve(out,'..','corporator-dexscreener-v9-volume-2026-10-02.zip');
  fs.writeFileSync(archive,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
  console.log(JSON.stringify({archive,bytes:fs.statSync(archive).size,files:files.length,verifiedOraLayers:3,sceneAndMergedHashesMatch:true},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
