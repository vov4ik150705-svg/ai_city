const fs=require('fs');const sharp=require('C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');const root='C:/Users/sk640/ai_city',out=__dirname+'/references';fs.mkdirSync(out,{recursive:true});
const groups=[
{file:'middle-building-originals.png',names:['Bank','Energy Plant','Robotics Lab','Data Center','Flagship Store','Agent Hub','clearing house','Drone Depot']},
{file:'front-building-originals.png',names:['Neon Residence','Fleet Yard','Exchange','Retail Complex','Logistics Hub','Power Node','Workshop']}
];
(async()=>{
for(const g of groups){const cellW=800,cellH=800,layers=[];for(let i=0;i<g.names.length;i++){const name=g.names[i],p=root+'/media/buildings/'+name+'.png';const b=await sharp(p).resize(760,730,{fit:'contain',background:'#cbd1d9'}).flatten({background:'#cbd1d9'}).png().toBuffer();layers.push({input:b,left:(i%4)*cellW+20,top:Math.floor(i/4)*cellH+55});const label=Buffer.from('<svg width="800" height="50"><text x="20" y="35" font-family="sans-serif" font-size="30" fill="#152231">'+name+'</text></svg>');layers.push({input:label,left:(i%4)*cellW,top:Math.floor(i/4)*cellH});}
await sharp({create:{width:3200,height:1600,channels:4,background:'#cbd1d9'}}).composite(layers).png().toFile(out+'/'+g.file);}
for(const group of [{file:'rear-building-sheets.png',ids:['fleet_yard','exchange','logistics_hub','workshop']},{file:'middle-building-sheets.png',ids:['agent_hub','energy_plant','retail_complex','clearing_house']}]){const layers=[];for(let i=0;i<group.ids.length;i++){const b=await sharp(root+'/media/kit/buildings/'+group.ids[i]+'.png').resize(2048,1390,{fit:'contain',background:'white'}).png().toBuffer();layers.push({input:b,left:(i%2)*2048,top:Math.floor(i/2)*1390});}await sharp({create:{width:4096,height:2780,channels:4,background:'white'}}).composite(layers).png().toFile(out+'/'+group.file);}
console.log('Original identity boards prepared without altering building shapes.');
})();
