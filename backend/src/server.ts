
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const app=express();
app.disable('x-powered-by');
app.use(cors({origin:['http://localhost:5173','http://127.0.0.1:5173']}));
app.use(express.json({limit:'1mb'}));
app.get('/api/health',(_req,res)=>res.json({ok:true,app:'Index 00',storage:'IndexedDB (browser)',engine:'WebGL'}));
app.get('/api/version',(_req,res)=>res.json({name:'Index 00',version:'1.0.0',backend:'Express'}));
// Browser artwork is intentionally not uploaded to the server.
// When frontend/dist exists, this same server can host the production site.
const here=path.dirname(fileURLToPath(import.meta.url));
const dist=path.resolve(here,'../../frontend/dist');
if(fs.existsSync(dist)){
  app.use(express.static(dist));
  app.get('/{*any}',(req,res)=>{
    if(req.path.startsWith('/api/'))return res.status(404).json({error:'Not found'});
    res.sendFile(path.join(dist,'index.html'));
  });
}
const port=Number(process.env.PORT||3001);
app.listen(port,()=>console.log(`Index 00 API running at http://localhost:${port}`));
