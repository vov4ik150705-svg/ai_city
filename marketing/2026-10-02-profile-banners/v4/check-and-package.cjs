const fs=require('fs'),path=require('path'),crypto=require('crypto');const deps='C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';const sharp=require(deps+'sharp'),JSZip=require(deps+'jszip');const out=__dirname;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const result={date:'2026-10-02',mode:'Built-in image_gen, unified scene followed by separate typography and exact original brand overlays',sceneHash:hash(fs.readFileSync(out+'/scene-clean-3000x1000.png')),exports:[],masters:[]};
 for(const v of ['x','dexscreener']){
  for(const size of ['3000x1000.png','1500x500.png','1500x500.jpg']){const name=v+'-'+size,p=out+'/'+name,m=await sharp(p).metadata();if(m.width/m.height!==3)throw Error('Invalid ratio '+name);result.exports.push({file:name,width:m.width,height:m.height,bytes:fs.statSync(p).size});}
  const svg=fs.readFileSync(out+'/'+v+'-editable-master.svg','utf8');if(!svg.includes('>CORPORATOR</text>'))throw Error('Headline misspelled');if(v==='x'&&!svg.includes('>A city worth running.</text>'))throw Error('Tagline misspelled');
  const ora=await JSZip.loadAsync(fs.readFileSync(out+'/'+v+'-layered-master.ora'));if((await ora.file('mimetype').async('string'))!=='image/openraster')throw Error('Invalid ORA');const stack=await ora.file('stack.xml').async('string');if((stack.match(/<layer /g)||[]).length!==4)throw Error('Expected four layers');
  const plate=await ora.file('data/layer0.png').async('nodebuffer');if(hash(plate)!==result.sceneHash)throw Error('Versions do not share the same clean scene');const merged=await ora.file('mergedimage.png').async('nodebuffer');if(hash(merged)!==hash(fs.readFileSync(out+'/'+v+'-3000x1000.png')))throw Error('ORA merged image mismatch');
  result.masters.push({version:v,svgHeadline:'CORPORATOR',tagline:v==='x'?'A city worth running.':null,oraLayers:4,unifiedSceneIdentical:true});
 }
 fs.writeFileSync(out+'/file-verification.json',JSON.stringify(result,null,2));
 const zip=new JSZip();const files=['README.md','verification-report.md','generation-prompt.txt','correction-prompt.txt','layout.json','reference-manifest.json','file-verification.json','scene-clean-3000x1000.png','scene-clean-1500x500.png','scene-generated-01.png','scene-generated-02.png',JSON.parse(fs.readFileSync(out+'/layout.json','utf8')).sceneSource];
 if(fs.existsSync(out+'/final-correction-prompt.txt'))files.push('final-correction-prompt.txt');
 for(const v of ['x','dexscreener'])for(const n of ['3000x1000.png','1500x500.png','1500x500.jpg','editable-master.svg','layered-master.ora','preview-600x200.png'])files.push(v+'-'+n);
 for(const n of ['Outfit-Bold.ttf','Outfit-Regular.ttf','Outfit-OFL.txt'])files.push('fonts/'+n);
 for(const p of [...new Set(files)])zip.file('Corporator V4/'+p,fs.readFileSync(out+'/'+p));
 const archive=path.resolve(out,'..','corporator-unified-banners-v4-2026-10-02.zip');fs.writeFileSync(archive,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));console.log(JSON.stringify({exports:result.exports,masters:result.masters,archive,archiveBytes:fs.statSync(archive).size},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
