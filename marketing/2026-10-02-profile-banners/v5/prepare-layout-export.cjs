const fs=require('fs');const out=__dirname,previous=out+'/../v4';
let source=fs.readFileSync(previous+'/finish-layouts.cjs','utf8');
function change(before,after){if(!source.includes(before))throw Error('Layout exporter has changed: '+before.slice(0,80));source=source.replace(before,after);}
change("await sharp(L+'/scene-unified.png').composite([{input:L+'/signage-corrections.png',left:0,top:0}]).png().toFile(clean)","fs.copyFileSync(L+'/scene-unified.png',clean)");
change(",{name:'02 · In-world exact signage typography',p:L+'/signage-corrections.png',x:0,y:0}",'');
change("svg+=group('signage','02 · Exact in-world signage',img(L+'/signage-corrections.png',0,0,W,H));",'');
source=source.replaceAll('03 · CORPORATOR','02 · CORPORATOR').replaceAll('03 · Editable CORPORATOR','02 · Editable CORPORATOR').replaceAll('04 · Exact original','03 · Exact original').replaceAll('04 · Exact original brand','03 · Exact original brand').replaceAll('05 · Exact original','04 · Exact original').replaceAll('05 · A city','04 · A city').replaceAll('05 · Original $CORP','04 · Original $CORP').replaceAll('05 · Editable tagline','04 · Editable tagline').replace('five-layer ORA','four-layer ORA');
fs.writeFileSync(out+'/finish-layouts.cjs',source);
const layout=JSON.parse(fs.readFileSync(previous+'/layout.json','utf8'));layout.sceneSource='scene-towers-corrected-generated.png';fs.writeFileSync(out+'/layout.json',JSON.stringify(layout,null,2));
console.log('Existing approved typography and original brand positions prepared for the corrected scene.');
