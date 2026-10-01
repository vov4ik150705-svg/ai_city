const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = 'C:/Users/sk640/ai_city';
const out = __dirname;
(async () => {
  const names = ['media/buildings/City Hall.png','media/buildings/Finance Tower.png','media/kit/buildings/city_hall.png','media/kit/buildings/finance_tower.png'];
  const layers = [];
  for (let i=0;i<names.length;i++) layers.push({input:await sharp(path.join(root,names[i])).resize(1024,900,{fit:'contain',background:'#e1e5ea'}).png().toBuffer(),left:(i%2)*1024,top:Math.floor(i/2)*900});
  await sharp({create:{width:2048,height:1800,channels:3,background:'#e1e5ea'}}).composite(layers).png().toFile(path.join(out,'architecture-reference-board.png'));
  console.log('Reference board saved.');
})();
