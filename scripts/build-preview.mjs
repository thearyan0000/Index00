// Generate the dependency-free preview from the same templates and engine as
// the React app so fixes do not drift between two handwritten implementations.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {build}=require('esbuild');
const source=path.join(root,'frontend/src'),output=path.join(root,'preview');
await fs.mkdir(output,{recursive:true});
await build({
  stdin:{contents:`import {mountStudio} from './engine/legacyEngine.ts'; mountStudio();`,resolveDir:source,loader:'ts'},
  bundle:true,format:'iife',target:'es2022',outfile:path.join(output,'studio.js'),
  plugins:[{name:'raw-assets',setup(b){
    b.onResolve({filter:/\?raw$/},args=>({path:path.resolve(args.resolveDir,args.path.slice(0,-4)),namespace:'raw'}));
    b.onLoad({filter:/.*/,namespace:'raw'},async args=>({contents:await fs.readFile(args.path,'utf8'),loader:'text'}));
  }}]
});
const templates=await Promise.all(['stage','header','panels','tools','dialogs','loader'].map(name=>fs.readFile(path.join(source,'templates',name+'.html'),'utf8')));
for(const name of ['studio.css','editorial-v2.css'])await fs.copyFile(path.join(source,'styles',name),path.join(output,name));
for(const name of ['cursor-symbol-white.png','loader-subject.webp'])await fs.copyFile(path.join(root,'frontend/public',name),path.join(output,name));
const shell=await fs.readFile(path.join(root,'frontend/index.html'),'utf8');
const html=shell.replace('</head>','<link rel="stylesheet" href="./studio.css"><link rel="stylesheet" href="./editorial-v2.css"></head>')
  .replace(/<body>[^]*?<\/body>/,`<body>${templates.join('\n')}<script src="./studio.js"></script></body>`);
await fs.writeFile(path.join(output,'index.html'),html);
console.log('Offline preview generated from the current editor source.');
