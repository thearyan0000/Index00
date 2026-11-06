import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../preview');
// Explicit allowlist prevents path traversal while letting the offline UI load its
// actual stylesheet and loader artwork (the previous server returned 404 for all assets).
const routes = new Map([
  ['/', ['index.html','text/html; charset=utf-8']],
  ['/index.html', ['index.html','text/html; charset=utf-8']],
  ['/editorial-v2.css', ['editorial-v2.css','text/css; charset=utf-8']],
  ['/studio.css', ['studio.css','text/css; charset=utf-8']],
  ['/studio.js', ['studio.js','text/javascript; charset=utf-8']],
  ['/loader-subject.webp', ['loader-subject.webp','image/webp']],
  ['/cursor-symbol-white.png', ['cursor-symbol-white.png','image/png']]
]);
createServer(async(req,res)=>{
  const pathname=(req.url||'/').split('?')[0];
  const route=routes.get(pathname);
  if(!route){res.writeHead(404);res.end('Not found');return;}
  try{
    const content=await readFile(path.join(dir,route[0]));
    res.writeHead(200,{'content-type':route[1],'cache-control':'no-store'});
    res.end(content);
  }catch(e){res.writeHead(500);res.end('Unable to load preview asset');}
}).listen(4173,'127.0.0.1',()=>console.log('Index 00 offline preview http://localhost:4173'));
