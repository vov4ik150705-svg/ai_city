const fs=require('fs'),path=require('path');
const JSZip=require('C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/jszip');
const out=__dirname;
(async()=>{
 const zip=new JSZip();
 const files=['REPORT.md','generation-prompts.json','layout.json','verification.json','qa-visible-details.png','scene-clean-3000x1000.png','scene-clean-1500x500.png','x-3000x1000.png','x-1500x500.png','dexscreener-3000x1000.png','dexscreener-1500x500.png','x-editable-master.svg','dexscreener-editable-master.svg','x-layered-master.ora','dexscreener-layered-master.ora','x-preview-600x200.png','dexscreener-preview-600x200.png'];
 for(const n of files)zip.file(n,fs.readFileSync(path.join(out,n)));
 for(const dir of ['fonts','layers'])for(const n of fs.readdirSync(path.join(out,dir)))zip.file(dir+'/'+n,fs.readFileSync(path.join(out,dir,n)));
 const name='corporator-profile-banners-2026-10-02.zip';fs.writeFileSync(path.join(out,name),await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
 console.log('Delivery archive:',name,'bytes:',fs.statSync(path.join(out,name)).size);
})();
