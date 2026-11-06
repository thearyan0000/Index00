import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {checkMaterials} from './material-browser-checks.mjs';
import {checkReset} from './reset-browser-checks.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'index00-smoke-'));
const output=path.join(root,'test-results');await fs.mkdir(output,{recursive:true});
const children=[];let socket;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const launch=(exe,args,options={})=>{const child=spawn(exe,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],...options});children.push(child);return child;};
const react=process.argv.includes('--react');
const fallback=process.argv.includes('--fallback');
const server=launch(process.execPath,react?['frontend/node_modules/vite/bin/vite.js','frontend','--host','127.0.0.1','--port','5175']:['scripts/serve-preview.mjs']);
console.log('Starting preview and headless Chrome...');
server.stderr.on('data',d=>process.stderr.write(d));
try {
  const chrome=launch('C:/Program Files/Google/Chrome/Application/chrome.exe',[
    '--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader',`--user-data-dir=${profile}`,'about:blank'
  ]);
  const endpoint=await new Promise((resolve,reject)=>{
    let log='';const timer=setTimeout(()=>reject(new Error('Chrome startup timeout')),20000);
    chrome.stderr.on('data',d=>{log+=d;const m=log.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});
    chrome.on('error',reject);
  });
  const debugOrigin=endpoint.replace(/^ws:/,'http:').split('/devtools')[0];
  console.log('Chrome debug endpoint ready');
  const page=await (await fetch(debugOrigin+'/json/new?about:blank',{method:'PUT',signal:AbortSignal.timeout(5000)})).json();
  console.log('Debug target ready');
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
  let seq=0,dialogResponse;const pending=new Map(),errors=[];
  socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}
    else if(m.method==='Page.javascriptDialogOpening'&&dialogResponse!==undefined){const accept=dialogResponse;dialogResponse=undefined;void rpc('Page.handleJavaScriptDialog',{accept});}
    else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
    else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(x=>x.value||x.description).join(' '));};
  const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},15000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await rpc('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(100);}throw new Error('Timed out: '+expression);};
  await rpc('Runtime.enable');await rpc('Page.enable');
  if(fallback)await rpc('Page.addScriptToEvaluateOnNewDocument',{source:'window.Worker=undefined;'});
  await rpc('Page.addScriptToEvaluateOnNewDocument',{source:`{
    const draw=WebGLRenderingContext.prototype.drawArrays;
    WebGLRenderingContext.prototype.drawArrays=function(...args){
      draw.apply(this,args);
      if(window.__sampleFrame){
        const p=new Uint8Array(this.drawingBufferWidth*this.drawingBufferHeight*4);
        this.readPixels(0,0,this.drawingBufferWidth,this.drawingBufferHeight,this.RGBA,this.UNSIGNED_BYTE,p);
        let holes=0,signature=0;for(let i=3;i<p.length;i+=4)if(p[i]<200)holes++;
        for(let i=0;i<p.length;i+=97)signature=(Math.imul(signature,31)+p[i])|0;
        window.__frameSignature=signature;window.__frameHoles=holes;window.__sampleFrame=false;
      }
    };
  }`});
  await rpc('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await rpc('Page.navigate',{url:react?'http://127.0.0.1:5175':'http://127.0.0.1:4173'});
  console.log('Editor page loaded');
  await waitFor(`document.querySelector('#ld')?.classList.contains('off') && window.__index00Performance${fallback?'': '?.workerAvailable'}`);
  const dimensions=()=>evaluate(`(()=>{const r=document.querySelector('#c').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()`);
  const initial=await dimensions();assert.ok(Math.abs(initial.w/initial.h-16/9)<.005);assert.ok(initial.w>900);
  assert.equal(await evaluate(`!!document.querySelector('#canvasFocus')||!!document.querySelector('#frame')`),false);
  assert.equal(await evaluate(`document.querySelector('#blendMode').options.length`),27);
  console.log('Editor initialized',initial);
  assert.equal(errors.length,0,errors.join('\n'));
  if(process.argv.includes('--materials'))await checkMaterials({evaluate,rpc,root,output});
  await evaluate(`document.querySelector('#ratio').value='1:1';document.querySelector('#ratio').dispatchEvent(new Event('change'))`);
  let rect=await dimensions();assert.ok(Math.abs(rect.w/rect.h-1)<.005);
  await evaluate(`document.querySelector('#ratio').value='9:16';document.querySelector('#ratio').dispatchEvent(new Event('change'))`);
  rect=await dimensions();assert.ok(Math.abs(rect.w/rect.h-9/16)<.005);
  await evaluate(`document.querySelector('#ratio').value='16:9';document.querySelector('#ratio').dispatchEvent(new Event('change'));document.querySelector('#meshVisibility').click();document.querySelector('#clothSurface').value='1';document.querySelector('#clothSurface').dispatchEvent(new Event('change'));document.querySelector('[data-t="stitch"]').click();document.querySelector('#clothTension').value='100';document.querySelector('#clothTension').dispatchEvent(new Event('input'));document.querySelector('#clothTear').value='100';document.querySelector('#clothTear').dispatchEvent(new Event('input'));`);
  rect=await dimensions();
  const stroke=async(offset=0)=>{
    const x=rect.x+rect.w*.35,y=rect.y+rect.h*.45+offset;
    await rpc('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
    await rpc('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
    for(let i=1;i<=24;i++)await rpc('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+i*10,y:y+Math.sin(i*.3)*50,button:'left',buttons:1});
    await rpc('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+240,y:y+Math.sin(7.2)*50,button:'left',buttons:0,clickCount:1});
    await waitFor(`!window.__index00Performance.workerBusy`);await delay(300);
  };
  await stroke();
  console.log('Embroidery stroke applied');
  if(react){
    await evaluate(`(async()=>{window.testEngine=(await import('/src/store/useEditorStore.ts')).useEditorStore.getState().engine;window.testSaved=testEngine.checkpoint();})()`);
    const saved=await evaluate(`({count:testSaved.mesh.stitches.length,aspect:testSaved.canvasAspect,cloth:testSaved.clothSurface,visible:testSaved.meshVisible,tension:testSaved.mesh.stitches[0]?.tension})`);
    assert.ok(saved.count>5);assert.equal(saved.aspect,'16:9');assert.equal(saved.cloth,1);assert.equal(saved.visible,false);assert.equal(saved.tension,1);
    await evaluate(`window.__sampleFrame=true;testEngine.redraw()`);await waitFor('window.__sampleFrame===false');
    assert.ok(await evaluate('window.__frameHoles')>0,'Embroidery must pierce the actual rendered alpha channel');
    await evaluate(`(async()=>{document.querySelector('#clear').click();await testEngine.restoreCheckpoint(testSaved);})()`);
    assert.equal(await evaluate('testEngine.checkpoint().mesh.stitches.length'),saved.count);
    await evaluate(`(async()=>{
      for(const [id,value] of Object.entries({wrinkleAmount:62,wrinkleScale:72,wrinkleAngle:-40,wrinkleStyle:2,weaveScale:140,blendOpacity:68,blendMode:21})){
        const el=document.querySelector('#'+id);el.value=String(value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input'));
      }
      const s=testEngine.checkpoint();document.querySelector('#flattenCloth').click();await testEngine.restoreCheckpoint(s);
    })()`);
    const restoredMaterial=await evaluate(`({settings:testEngine.checkpoint().settings,blend:testEngine.checkpoint().blendModeId})`);
    assert.equal(restoredMaterial.settings.wrinkleAmount,'62');assert.equal(restoredMaterial.settings.wrinkleStyle,'2');assert.equal(restoredMaterial.settings.wrinkleAngle,'-40');assert.equal(restoredMaterial.settings.weaveScale,'140');assert.equal(restoredMaterial.settings.blendOpacity,'68');assert.equal(restoredMaterial.blend,'subtract');
    await evaluate(`for(const [id,value] of Object.entries({wrinkleAmount:35,wrinkleScale:40,wrinkleAngle:25,wrinkleStyle:0,weaveScale:100,blendOpacity:100,blendMode:0})){const el=document.querySelector('#'+id);el.value=String(value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input'));}`);
    // Verify actual imported-image and damage persistence, not just UI settings.
    await evaluate(`(()=>{const c=document.createElement('canvas');c.width=160;c.height=90;const g=c.getContext('2d');g.fillStyle='#d87a48';g.fillRect(0,0,160,90);g.fillStyle='#245b88';g.fillRect(0,0,80,90);return new Promise(resolve=>c.toBlob(async blob=>{const s=testEngine.checkpoint();s.image=blob;delete s.imageTransform;await testEngine.restoreCheckpoint(s);resolve();}));})()`);
    assert.equal(await evaluate('testEngine.getStatus().hasImage'),true);
    await evaluate(`(async()=>{document.querySelector('#ratio').value='1:1';document.querySelector('#ratio').dispatchEvent(new Event('change'));window.testSaved=testEngine.checkpoint();document.querySelector('#clear').click();await testEngine.restoreCheckpoint(testSaved);})()`);
    assert.equal(await evaluate('testEngine.checkpoint().mesh.stitches.length'),saved.count);
    assert.equal(await evaluate('testEngine.checkpoint().canvasAspect'),'1:1');
    await evaluate(`document.querySelector('#ratio').value='16:9';document.querySelector('#ratio').dispatchEvent(new Event('change'));document.querySelector('#repeatPattern').value='mandala';document.querySelector('#repeatPattern').dispatchEvent(new Event('change'));`);
    rect=await dimensions();await stroke(100);
    assert.ok(await evaluate('testEngine.checkpoint().mesh.stitches.length')>saved.count+100);
    console.log('React checkpoint, image, resize and 24-fold embroidery checks passed');
  }
  const performanceStats=await evaluate('window.__index00Performance');assert.ok(performanceStats.strokesApplied>0);assert.equal(performanceStats.workerErrors,0);
  if(react){
    await evaluate(`document.querySelector('#save').click();document.querySelector('#exportResolution').value='0';document.querySelector('#exportResolution').dispatchEvent(new Event('change'));document.querySelector('#exportStart').click();`);
    await waitFor(`!document.querySelector('#sv').hidden&&document.querySelector('#svi').complete&&document.querySelector('#svi').naturalWidth>0`);
    const exported=await evaluate(`({width:document.querySelector('#svi').naturalWidth,height:document.querySelector('#svi').naturalHeight})`);
    assert.ok(Math.abs(exported.width/exported.height-16/9)<.005);await evaluate(`document.querySelector('#svx').click()`);
    console.log('PNG export with cloth and embroidery passed');
  }
  await evaluate(`document.querySelector('#clothTension').value='40';document.querySelector('#clothTension').dispatchEvent(new Event('input'));document.querySelector('#clothTear').value='0';document.querySelector('#clothTear').dispatchEvent(new Event('input'));`);
  await rpc('Input.dispatchMouseEvent',{type:'mouseMoved',x:2,y:2});await delay(300);
  const image=await rpc('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,react?'image-embroidery.png':'cloth-embroidery.png'),Buffer.from(image.data,'base64'));
  await evaluate(`document.querySelector('#undo').click()`);await delay(500);
  await stroke(80);
  if(react&&process.argv.includes('--reset'))await checkReset({evaluate,waitFor,respondToDialog:accept=>{dialogResponse=accept;}});
  await evaluate(`document.querySelector('#clear').click();if(document.querySelector('#meshVisibility').getAttribute('aria-pressed')==='true')document.querySelector('#meshVisibility').click()`);await delay(500);
  if(react){await evaluate(`window.__sampleFrame=true;testEngine.redraw()`);await waitFor('window.__sampleFrame===false');assert.equal(await evaluate('window.__frameHoles'),0,'Unpick all must repair the holes');}
  assert.equal(await evaluate(`document.body.classList.contains('canvas-focus')`),false);
  assert.equal(await evaluate(`document.querySelector('#meshVisibility').getAttribute('aria-pressed')`),'false');
  await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await delay(500);
  const mobileLayout=await evaluate(`(()=>{const a=document.querySelector('#topL').getBoundingClientRect(),b=document.querySelector('#topR').getBoundingClientRect(),c=document.querySelector('#c').getBoundingClientRect();return {toolbarOverlap:a.bottom>b.top,ratio:c.width/c.height,right:c.right,bottom:c.bottom};})()`);
  assert.equal(mobileLayout.toolbarOverlap,false);assert.ok(Math.abs(mobileLayout.ratio-16/9)<.005);assert.ok(mobileLayout.right<=390&&mobileLayout.bottom<=844);
  assert.equal(errors.length,0,errors.join('\n'));
  await fs.writeFile(path.join(output,fallback?'fallback-smoke.json':react?'react-smoke.json':'browser-smoke.json'),JSON.stringify({initial,mobileLayout,performanceStats,errors,renderer:'Chrome headless / SwiftShader (functional verification, not hardware FPS)'},null,2));
  console.log(`Browser smoke passed (${fallback?'synchronous fallback':'raster worker'}): startup, WebGL, formats, mesh toggle, cloth embroidery, undo, clear and narrow-screen layout.`);
} finally {
  socket?.close();for(const child of children.reverse())child.kill();
  // Delete only the unique temporary profile this script created.
  if(path.dirname(profile)===os.tmpdir()&&path.basename(profile).startsWith('index00-smoke-')){
    await delay(500);await fs.rm(profile,{recursive:true,force:true,maxRetries:1}).catch(()=>{});
  }
}
