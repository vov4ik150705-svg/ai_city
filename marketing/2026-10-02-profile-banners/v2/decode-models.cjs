const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const root='C:/Users/sk640/ai_city';
const runtime=path.join(root,'art/island_v3/runtime_terra19/buildings');
const out=path.join(__dirname,'decoded');fs.mkdirSync(out,{recursive:true});
const node='C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe';
const cli=path.join(root,'node_modules/@gltf-transform/cli/bin/cli.js');
const tasks=fs.readdirSync(runtime).filter(n=>n.endsWith('.glb')).map(n=>({src:path.join(runtime,n),out:path.join(out,n)}));
const look=JSON.parse(fs.readFileSync(path.join(root,'art/island_v3/maps/terra-look.json'),'utf8'));
for(const ref of new Set(look.objects.filter(o=>o.kind==='decor').map(o=>o.ref)))tasks.push({src:path.join(root,'decoration',ref+'.glb'),out:path.join(out,ref+'.glb')});
async function worker(){while(tasks.length){const t=tasks.shift();await new Promise((res,rej)=>{const p=spawn(node,[cli,'copy',t.src,t.out],{windowsHide:true});let s='';p.stderr.on('data',d=>s+=d);p.on('close',c=>c?rej(Error(s)):res());});console.log('decoded',path.basename(t.out));}}
Promise.all([worker(),worker(),worker()]).catch(e=>{console.error(e);process.exitCode=1;});
