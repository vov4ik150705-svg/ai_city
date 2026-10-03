// Read-only local server for this design prototype and its original repository assets.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../..');
const mime = {'.html':'text/html; charset=utf-8','.png':'image/png','.woff2':'font/woff2','.md':'text/plain; charset=utf-8'};
const server = http.createServer((req,res)=>{
  let urlPath;
  try {urlPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);} catch {res.writeHead(400).end();return;}
  if(urlPath==='/')urlPath='/website/reference/mockups/entry/index.html';
  const target=path.resolve(root,'.'+urlPath);
  if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.stat(target,(error,info)=>{
    if(error||!info.isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});
    fs.createReadStream(target).pipe(res);
  });
});
server.listen(5187,'127.0.0.1',()=>process.stdout.write('Entry design preview: http://127.0.0.1:5187/\n'));
