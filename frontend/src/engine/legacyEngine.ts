// @ts-nocheck
// Ported from the latest Index 00 studio. The shader source lives in separate GLSL files.
// This transitional engine retains tested DOM interactions while React owns the shell.
import vertexShader from '../shaders/material.vert.glsl?raw';
import fragmentShader from '../shaders/material.frag.glsl?raw';
import rasterWorkerSource from './rasterWorker.js?raw';
import stampIndexSource from './stampIndex.js?raw';
import { StampIndex } from './stampIndex.js';
import blendingShader from '../shaders/blending.glsl?raw';
import fabricShader from '../shaders/fabric.glsl?raw';
import { blendModes, restoreBlendIndex } from './blendModes.js';
import { FabricTextures, fabrics } from './fabricMaps.js';
import { ClothDamage } from './clothDamage.js';
import type { EditorSnapshot, StudioEngine } from './types';

export function mountStudio(): StudioEngine {

      const $ = s => document.querySelector(s), cv = $('#c'), IV = '226,214,210';
      const mobileDevice = matchMedia('(pointer: coarse)').matches || matchMedia('(max-width: 720px)').matches;
      let W, H, D, A = 6.5, NV, vx0, vy0, vx, vy, vc, cells, edges, bgc, maxD = 0, GB = 48, gs, gi, gw, gh, dr = { full: 1 }, ft, bl = 0, hv = 0, mp = { x: 0, y: 0 }, picots = [], stains = [], snags = [], stack = [];
      let tool = 'cord', mode = 'free', meshMode = 'square', stitchStyle = 0, R = 44, framed = false, media = null, stream = null, snd = false, drawing = false, last = null, acc = 0, bloomAcc = 0, snagAcc = 0, stitchAcc = 0, side = 1, mouse = null, dirty = true, ac = null, lastTick = 0;
      let stitches = [];
      let meshVisible=true, clothSurface=1, clothTension=.4, geometryRevision=0;
      let clothTear=0,wrinkleAmount=.35,wrinkleScale=.4,wrinkleAngle=25,wrinkleStyle=0,weaveScale=1,blendOpacity=1;
      const clothDamage=new ClothDamage();
      const stampIndexes={picots:new StampIndex(),stains:new StampIndex(),snags:new StampIndex(),stitches:new StampIndex()};
      const st = t => { $('#st').textContent = t };
      const storage = {
        get(key){ try { return globalThis.localStorage ? localStorage.getItem(key) : null; } catch(e){ return null; } },
        set(key, value){ try { if(globalThis.localStorage) localStorage.setItem(key, value); } catch(e){} }
      };
      let uiTheme = storage.get('afterimage-ui-theme') || 'light';
      function applyUITheme(theme){
        uiTheme = theme;
        document.body.dataset.uiTheme = theme;
        const btn = $('#themeToggle');
        if(btn){
          btn.classList.toggle('on', theme === 'dark');
          btn.textContent = theme === 'dark' ? 'light mode' : 'dark mode';
          btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
        }
        const metaTheme = document.querySelector('meta[name=\"theme-color\"]');
        if(metaTheme) metaTheme.setAttribute('content', theme === 'dark' ? '#111111' : '#ffffff');
        storage.set('afterimage-ui-theme', theme);
      }
      let countryChoice=storage.get('afterimage-country') || 'auto';
      function localeCountry(){
        // Country cannot be reliably recovered from browser language: English (US)
        // is often selected on PCs physically located in India. Prefer timezone,
        // with an explicit editable override; never claim this is GPS location.
        const override=countryChoice;
        if(override !== 'auto')return override;
        const tz=Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        const byZone={
          'Asia/Kolkata':'India','Asia/Calcutta':'India','Asia/Singapore':'Singapore',
          'Asia/Dubai':'United Arab Emirates','Asia/Tokyo':'Japan','Asia/Seoul':'South Korea',
          'Europe/London':'United Kingdom','Europe/Paris':'France','Europe/Berlin':'Germany',
          'Australia/Sydney':'Australia','Australia/Melbourne':'Australia',
          'America/New_York':'United States','America/Chicago':'United States','America/Los_Angeles':'United States',
          'America/Toronto':'Canada','America/Vancouver':'Canada','America/Sao_Paulo':'Brazil'
        };
        if(byZone[tz])return byZone[tz];
        // Unknown timezone: show a neutral label rather than a misleading country.
        return 'SET COUNTRY';
      }
      function updateMetaClock(){
        const now = new Date();
        const timeEl = $('#liveTime'), countryEl = $('#liveCountry'), zoneEl = $('#liveZone');
        if(timeEl) timeEl.textContent = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
        if(countryEl) countryEl.textContent = String(localeCountry()).toUpperCase();
        if(zoneEl) {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
          zoneEl.textContent = tz.replace(/_/g,' ').toUpperCase();
        }
      }

      function initCountryPicker(){
        const picker=$('#studioCountry'),custom=$('#studioCountryCustom');
        if(!picker || !custom) return;
        const saved=countryChoice;
        const existing=[...picker.options].some(o=>o.value===saved);
        picker.value=existing?saved:(saved==='auto'?'auto':'custom');
        custom.hidden=picker.value!=='custom';
        if(!existing)custom.value=saved;
        picker.addEventListener('change',()=>{
          custom.hidden=picker.value!=='custom';
          if(picker.value==='custom'){
            if(!custom.value.trim())return custom.focus();
            countryChoice=custom.value.trim();storage.set('afterimage-country',countryChoice);
          }else {countryChoice=picker.value;storage.set('afterimage-country',countryChoice);}
          updateMetaClock();
        });
        custom.addEventListener('input',()=>{
          if(custom.value.trim()){countryChoice=custom.value.trim();storage.set('afterimage-country',countryChoice);updateMetaClock();}
        });
      }
      initCountryPicker();

      // Index geometry by ORIGINAL vertex positions. Dirty redraws search nearby
      // grid buckets, inflated by maxD to account for moved vertices.
      // Full redraws intentionally bypass the index (no duplicate geometry).
      let meshCellBins=[], meshEdgeBins=[], allCellIds=[], allEdgeIds=[];
      let indexedVX=new Float32Array(0),indexedVY=new Float32Array(0), meshIndexShift=0;
      let seenCells=new Uint32Array(0), seenEdges=new Uint32Array(0), meshQueryToken=0;
      function indexMeshGeometry(){
        geometryRevision++;
        meshCellBins=Array.from({length:gw*gh},()=>[]);
        meshEdgeBins=Array.from({length:gw*gh},()=>[]);
        allCellIds=new Array(cells.length);
        allEdgeIds=new Array(edges.length/2);
        seenCells=new Uint32Array(cells.length);
        seenEdges=new Uint32Array(edges.length/2);
        meshQueryToken=0;
        indexedVX=vx.slice();indexedVY=vy.slice();meshIndexShift=0;
        const lo=(v,max)=>Math.max(0,Math.min(max-1,Math.floor((v+GB)/GB)));
        const add=(bins,id,minX,minY,maxX,maxY)=>{
          const x0=lo(minX,gw), x1=lo(maxX,gw);
          const y0=lo(minY,gh), y1=lo(maxY,gh);
          for(let by=y0;by<=y1;by++)for(let bx=x0;bx<=x1;bx++)bins[by*gw+bx].push(id);
        };
        for(let i=0;i<cells.length;i++){
          allCellIds[i]=i;
          const c=cells[i];let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
          for(let j=0;j<c.length;j++){const v=c[j],x=vx[v],y=vy[v];
            x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
          add(meshCellBins,i,x0,y0,x1,y1);
        }
        for(let i=0;i<edges.length;i+=2){
          const index=i/2,a=edges[i],b=edges[i+1];allEdgeIds[index]=index;
          add(meshEdgeBins,index,Math.min(vx[a],vx[b]),Math.min(vy[a],vy[b]),
            Math.max(vx[a],vx[b]),Math.max(vy[a],vy[b]));
        }
      }
      function geometryNear(bins, seen, bounds){
        // Index reflects the ACTUAL deformed mesh after each completed stroke.
        // Inflate only by motion since that index, not accumulated lifetime deformation.
        const pad=Math.min(Math.max(0,meshIndexShift),Math.max(W,H));
        const x0=Math.max(0,Math.floor((bounds.x0-pad+GB)/GB)),
              y0=Math.max(0,Math.floor((bounds.y0-pad+GB)/GB)),
              x1=Math.min(gw-1,Math.floor((bounds.x1+pad+GB)/GB)),
              y1=Math.min(gh-1,Math.floor((bounds.y1+pad+GB)/GB));
        if(++meshQueryToken===0xffffffff){seenCells.fill(0);seenEdges.fill(0);meshQueryToken=1;}
        const token=meshQueryToken, result=[];
        for(let by=y0;by<=y1;by++)for(let bx=x0;bx<=x1;bx++){
          const list=bins[by*gw+bx];
          for(let i=0;i<list.length;i++){
            const id=list[i];if(seen[id]===token)continue;
            seen[id]=token;result.push(id);
          }
        }
        return result;
      }
      // Brush hit-testing uses a CURRENT-position vertex grid. Rebuild once
      // after each completed gesture, rather than expanding every query by the
      // lifetime maximum deformation (which eventually scans the whole mesh).
      function reindexBrushGrid(){
        if(!gs||!gi||!NV)return;
        gs.fill(0);
        const bucket=i=>Math.min(gh-1,Math.max(0,Math.floor((vy[i]+GB)/GB)))*gw +
                        Math.min(gw-1,Math.max(0,Math.floor((vx[i]+GB)/GB)));
        for(let i=0;i<NV;i++)gs[bucket(i)+1]++;
        for(let k=0;k<gw*gh;k++)gs[k+1]+=gs[k];
        const cursor=gs.slice(0,gw*gh);
        for(let i=0;i<NV;i++)gi[cursor[bucket(i)]++]=i;
      }
      function build() {
        const s = Math.sqrt(3) * A, m = new Map(), px = [], py = [], E = new Set(); cells = []; edges = [];
        const vid = (X, Y) => {
          const key = Math.round(X * 2) + ',' + Math.round(Y * 2); let id = m.get(key);
          if (id === undefined) { id = px.length; m.set(key, id); px.push(X); py.push(Y) }
          return id;
        };
        const addCell = points => {
          const cell = points.map(p => vid(p[0], p[1])); cells.push(cell);
          for (let k = 0; k < cell.length; k++) {
            const a = cell[k], b = cell[(k + 1) % cell.length], edge = a < b ? a * 1e6 + b : b * 1e6 + a;
            if (!E.has(edge)) { E.add(edge); edges.push(a, b) }
          }
        };
        if (meshMode === 'hex') {
          for (let j = -1; j < H / (1.5 * A) + 2; j++) for (let i = -1; i < W / s + 2; i++) {
            const cx = i * s + (j & 1 ? s / 2 : 0), cy = j * 1.5 * A, points = [];
            for (let k = 0; k < 6; k++) { const angle = Math.PI / 180 * (30 + 60 * k); points.push([cx + A * Math.cos(angle), cy + A * Math.sin(angle)]) }
            addCell(points);
          }
        } else if (meshMode === 'square') {
          const side = A * 1.55;
          for (let j = -1; j < H / side + 2; j++) for (let i = -1; i < W / side + 2; i++) {
            const x = i * side, y = j * side, r = side / 2;
            addCell([[x-r,y-r],[x+r,y-r],[x+r,y+r],[x-r,y+r]]);
          }
        } else if (meshMode === 'diamond') {
          const r = A * 1.45, rows = Math.ceil(H / r) + 4, cols = Math.ceil(W / (2 * r)) + 4;
          for (let row = -2; row < rows; row++) for (let col = -2; col < cols; col++) {
            const cx = (col * 2 + (row & 1)) * r, cy = row * r;
            addCell([[cx,cy-r],[cx+r,cy],[cx,cy+r],[cx-r,cy]]);
          }
        } else if (meshMode === 'triangle') {
          const side = A * 1.8, h = side * Math.sqrt(3) / 2, rows = Math.ceil(H / h) + 4, cols = Math.ceil(W / side) + 4;
          for (let row = -2; row < rows; row++) {
            const y0 = row * h, y1 = (row + 1) * h, off0 = (row & 1) ? side / 2 : 0, off1 = ((row + 1) & 1) ? side / 2 : 0;
            for (let col = -2; col < cols; col++) {
              const x0 = col * side + off0, x1 = col * side + off1;
              addCell([[x0,y0],[x0+side,y0],[x1,y1]]);
              addCell([[x0+side,y0],[x1+side,y1],[x1,y1]]);
            }
          }
        }
        NV = px.length; vx0 = Float32Array.from(px); vy0 = Float32Array.from(py); vx = vx0.slice(); vy = vy0.slice(); vc = new Float32Array(NV); picots = []; stains = []; snags = []; stack = []; maxD = 0;
        stitches = [];
        gw = Math.ceil(W / GB) + 3; gh = Math.ceil(H / GB) + 3; gs = new Int32Array(gw * gh + 1); gi = new Int32Array(NV);
        const bk = i => Math.min(gh - 1, Math.max(0, Math.floor((vy0[i] + GB) / GB))) * gw + Math.min(gw - 1, Math.max(0, Math.floor((vx0[i] + GB) / GB)));
        for (let i = 0; i < NV; i++)gs[bk(i) + 1]++; for (let b = 0; b < gw * gh; b++)gs[b + 1] += gs[b];
        const ps = gs.slice(0, gw * gh); for (let i = 0; i < NV; i++)gi[ps[bk(i)]++] = i;
        indexMeshGeometry();reindexBrushGrid();
        updateWorkerGeometry();
      }
      // Prefer the discrete/high-performance GPU for the WebGL renderer.
      // WebGL is GPU-accelerated when browser/driver settings permit it; JavaScript
      // mesh editing and the 2D height-map/particle layers still run on the CPU.
      const gl = cv.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
      });
      const hc = document.createElement('canvas'), hg = hc.getContext('2d', { willReadFrequently: true }), pc = document.createElement('canvas'), pg = pc.getContext('2d'), ring = $('#ring');
      let imageTransform={x:0,y:0,scale:1,angle:0,flipX:false,flipY:false}, imagePreset='fit', transformActive=false, transformLastPointer=null, imageTextureSource=null;
      let HS = 1, pd = 1, only = false, light = { x: 0, y: 0 }, lightX = .3, lightY = .2, lightPower = 1.1, lightSoft = .55, shadowStrength = .7, lightPreset = 0, textureMode = 0, paletteMode = 1, labMode = false, fxMode = 3, fxStrength = .82, fxGrain = .48, fxBleed = .56, fxWear = .38, fxExposure = 0, fxContrast = .5, fxSoft = .25, fxBorder = 0, fxSeed = 3.1, fxBefore = 0, bgFit = 'contain'; const tx = [], U = {};
      const VS = vertexShader;
      const FS = fragmentShader.replace('void main(){',blendingShader+'\n'+fabricShader+'\nvoid main(){');
      if (gl) {
        // WebGL renders the full-frame material/lighting and darkroom effects on the GPU.
        // The context requests a high-performance adapter and avoids unused framebuffer buffers.
        const mk = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o };
        const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const al = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
        ['uFabricColor','uFabricDetail','uWrinkleAmount','uWrinkleScale','uWrinkleAngle','uWrinkleStyle','uWeaveScale','uBlendOpacity','uDamage', 'uCloth', 'uH', 'uP', 'uC', 'uI', 'uImg', 'uBl', 'uM', 'uS', 'uT', 'uRes', 'uL', 'uOnly', 'uK', 'uTex', 'uPal', 'uLab', 'uFx', 'uFxStrength', 'uFxGrain', 'uFxBleed', 'uFxWear', 'uFxExposure', 'uFxContrast', 'uFxSoft', 'uFxBorder', 'uFxSeed', 'uFxBefore', 'uFxMaskActive', 'uMask', 'uLightPower', 'uLightSoft', 'uShadow', 'uLightType', 'uImageCenter', 'uImageSize', 'uImageScale', 'uImageAngle', 'uImageFlip'].forEach(n => U[n] = gl.getUniformLocation(pr, n));
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        [0, 1].forEach(i => {
          const t = gl.createTexture(); tx.push(t); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
          [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(a => gl.texParameteri(gl.TEXTURE_2D, a[0], a[1]));
          gl.uniform1i(U[i ? 'uP' : 'uH'], i)
        });
      } else {
        st('WebGL unavailable — enable hardware acceleration in your browser');
        console.error('WebGL could not be initialized. Check browser hardware acceleration and GPU drivers.');
      }

      // Show which graphics path the browser selected when the status chip is clicked.
      // Renderer strings may be hidden by browser privacy settings.
      cv.addEventListener('webglcontextlost', e => {
        e.preventDefault();
        st('GPU context lost — reload to restore rendering');
      });
      cv.addEventListener('webglcontextrestored', () => {
        st('GPU context restored — reload if the scene stays blank');
      });
      const fabricTextures=new FabricTextures(gl);
      if(gl){gl.uniform1i(U.uFabricColor,6);gl.uniform1i(U.uFabricDetail,7);}
      function cement() {
        const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 60; i++) { const px = Math.random() * 512, py = Math.random() * 512, r = 30 + Math.random() * 120, v = Math.random() < .5 ? '255,255,255' : '0,0,0'; for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) { const q = g.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r); q.addColorStop(0, `rgba(${v},.09)`); q.addColorStop(1, `rgba(${v},0)`); g.fillStyle = q; g.fillRect(px + ox - r, py + oy - r, r * 2, r * 2) } }
        for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < .5 ? `rgba(255,255,255,${Math.random() * .1})` : `rgba(0,0,0,${Math.random() * .16})`; const z = Math.random() * 2.4 + .5; g.fillRect(Math.random() * 512, Math.random() * 512, z, z) }
        return c
      }
      if (gl) {
        const t = gl.createTexture(); tx[2] = t; gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, t);
        [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT]].forEach(a => gl.texParameteri(gl.TEXTURE_2D, a[0], a[1]));
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cement()); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.uniform1i(U.uC, 2)
      }
      if (gl) {
        const t = gl.createTexture(); tx[3] = t; gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, t);
        [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(a => gl.texParameteri(gl.TEXTURE_2D, a[0], a[1]));
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])); gl.uniform1i(U.uI, 3)
      }
      // A fifth GPU texture stores a paintable, non-destructive process mask.
      const maskCanvas = document.createElement('canvas'), maskCtx = maskCanvas.getContext('2d', {willReadFrequently:true});
      let brushMode='full', maskTouched=false, maskDirty=true, maskDrawing=false, maskPrevious=null;
      const maskHistory=[];
      if (gl) {
        tx[4]=gl.createTexture(); gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,tx[4]);
        [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]].forEach(a=>gl.texParameteri(gl.TEXTURE_2D,a[0],a[1]));
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
        gl.uniform1i(U.uMask,4);
      }
      if(gl){
        tx[5]=gl.createTexture();gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,tx[5]);
        [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]].forEach(a=>gl.texParameteri(gl.TEXTURE_2D,a[0],a[1]));
        gl.uniform1i(U.uDamage,5);
      }
      function resizeMask(w,h){
        const old=document.createElement('canvas');old.width=maskCanvas.width;old.height=maskCanvas.height;
        if(old.width&&old.height)old.getContext('2d').drawImage(maskCanvas,0,0);
        maskCanvas.width=Math.max(1,Math.round(w));maskCanvas.height=Math.max(1,Math.round(h));
        maskCtx.fillStyle=maskTouched?'#000':'#fff';maskCtx.fillRect(0,0,maskCanvas.width,maskCanvas.height);
        if(old.width&&old.height)maskCtx.drawImage(old,0,0,maskCanvas.width,maskCanvas.height);
        maskHistory.length=0;maskDirty=true;
      }
      function uploadMask(){
        if(!maskDirty||!gl)return;
        gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,tx[4]);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,maskCanvas);
        maskDirty=false;
      }
      function fillMask(white){maskCtx.fillStyle=white?'#fff':'#000';maskCtx.fillRect(0,0,maskCanvas.width,maskCanvas.height);maskDirty=true;go()}
      function saveMaskUndo(){try{maskHistory.push(maskCtx.getImageData(0,0,maskCanvas.width,maskCanvas.height));if(maskHistory.length>12)maskHistory.shift()}catch(e){}}
      function drawMaskDot(p){
        const radius=Number($('#labBrushSize').value), soft=Number($('#labBrushSoft').value)/100;
        const inner=Math.min(radius-.01,Math.max(0,1.-soft)*radius);
        const rgb=brushMode==='paint'?'255,255,255':'0,0,0';
        const g=maskCtx.createRadialGradient(p.x,p.y,inner,p.x,p.y,radius);
        g.addColorStop(0,`rgba(${rgb},1)`);g.addColorStop(1,`rgba(${rgb},0)`);
        maskCtx.fillStyle=g;maskCtx.fillRect(p.x-radius-1,p.y-radius-1,2*radius+2,2*radius+2);
        maskDirty=true;go();
      }
      function maskStroke(a,b){const d=Math.hypot(b.x-a.x,b.y-a.y),step=Math.max(2,Number($('#labBrushSize').value)*.18),count=Math.max(1,Math.ceil(d/step));for(let j=1;j<=count;j++)drawMaskDot({x:a.x+(b.x-a.x)*j/count,y:a.y+(b.y-a.y)*j/count});}

      function upload(i, c) {
        if (!gl || !tx[i]) return;
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, tx[i]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      }

      // Native file pickers can emit blur/focus and resize events without changing the
      // artwork. Earlier versions called build() on EVERY resize, wiping the mesh,
      // stitches, stains, snags and undo stack. Only rebuild for a real size change.
      let filePickerActive = false, filePickerEndTimer = 0;
      function openImagePicker(input) {
        filePickerActive = true;
        clearTimeout(filePickerEndTimer);
        try { input.click(); } catch (error) { filePickerActive = false; throw error; }
      }
      function endImagePicker() {
        clearTimeout(filePickerEndTimer);
        filePickerEndTimer = setTimeout(() => {
          filePickerActive = false;
          requestAnimationFrame(size); // ignores no-op resize; keeps edits on real changes
        }, 250);
      }
      ['file', 'imp_f', 'camera_f'].forEach(id => {
        $('#' + id).addEventListener('change', endImagePicker);
        $('#' + id).addEventListener('cancel', endImagePicker);
      });
      addEventListener('focus', () => { if (filePickerActive) endImagePicker(); });
      addEventListener('pageshow', () => { if (!filePickerActive) requestAnimationFrame(size); });

      // Preserve all artwork across an actual canvas format/viewport change.
      // The new mesh can have a different vertex count. Reproject deformation and
      // coverage using a small spatial neighborhood of the ORIGINAL mesh vertices.
      // The same projection keeps undo snapshots compatible with the new geometry.
      function preserveMeshSnapshot() {
        if (!vx0 || !vy0 || !vx || !vy || !NV || !W || !H) return null;
        return {
          width: W, height: H, originalX: vx0, originalY: vy0,
          current: {vx, vy, vc, pk: picots, stains, snags, stitches},
          undo: stack
        };
      }
      function restoreResizedMesh(saved) {
        if (!saved || !NV) return;
        const sx = W / saved.width, sy = H / saved.height;
        const scalar = Math.sqrt(sx * sy);
        const ox = saved.originalX, oy = saved.originalY;
        const bucketSize = Math.max(14, A * 2.6);
        const spatial = new Map();
        const key = (ix, iy) => ix + ':' + iy;
        for (let i = 0; i < ox.length; i++) {
          const k = key(Math.floor(ox[i] / bucketSize), Math.floor(oy[i] / bucketSize));
          let bucket = spatial.get(k);
          if (!bucket) { bucket = []; spatial.set(k, bucket); }
          bucket.push(i);
        }
        // Map each new vertex to at most four nearby old vertices; do it only once
        // and reuse for the live mesh and each undo step (no heavy redraw per frame).
        const match = new Array(NV);
        for (let i = 0; i < NV; i++) {
          const x = vx0[i] / sx, y = vy0[i] / sy;
          const cx = Math.floor(x / bucketSize), cy = Math.floor(y / bucketSize);
          const nearest = [];
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            const ids = spatial.get(key(cx + dx, cy + dy));
            if (!ids) continue;
            for (const j of ids) {
              const d2 = (ox[j] - x) ** 2 + (oy[j] - y) ** 2;
              if (nearest.length === 4 && d2 >= nearest[3].d2) continue;
              nearest.push({j, d2});
              nearest.sort((a, b) => a.d2 - b.d2);
              if (nearest.length > 4) nearest.pop();
            }
          }
          if (!nearest.length) { match[i] = []; continue; }
          if (nearest[0].d2 < 0.0001) { match[i] = [[nearest[0].j, 1]]; continue; }
          const weighted = nearest.map(it => [it.j, 1 / (it.d2 + 4)]);
          const total = weighted.reduce((sum, it) => sum + it[1], 0);
          match[i] = weighted.map(it => [it[0], it[1] / total]);
        }
        const moveExtras = values => (values || []).map(obj => {
          const result = {...obj};
          if ('x' in result) result.x *= sx;
          if ('y' in result) result.y *= sy;
          if ('r' in result) result.r *= scalar;
          if ('len' in result) result.len *= scalar;
          return result;
        });
        const project = old => {
          const nx = new Float32Array(NV), ny = new Float32Array(NV), nc = new Float32Array(NV);
          for (let i = 0; i < NV; i++) {
            let dx = 0, dy = 0, coverage = 0;
            for (const [j, weight] of match[i]) {
              dx += (old.vx[j] - ox[j]) * weight;
              dy += (old.vy[j] - oy[j]) * weight;
              coverage += old.vc[j] * weight;
            }
            nx[i] = vx0[i] + dx * sx;
            ny[i] = vy0[i] + dy * sy;
            nc[i] = coverage;
          }
          return {
            vx: nx, vy: ny, vc: nc,
            pk: moveExtras(old.pk), stains: moveExtras(old.stains),
            snags: moveExtras(old.snags), stitches: moveExtras(old.stitches)
          };
        };
        const current = project(saved.current);
        vx = current.vx; vy = current.vy; vc = current.vc;
        picots = current.pk; stains = current.stains;
        snags = current.snags; stitches = current.stitches;
        stack = saved.undo.map(project);
        recalcMax();indexMeshGeometry();reindexBrushGrid();
      }
      function size() {
        if (filePickerActive || document.hidden) return;
        const r = cv.getBoundingClientRect();
        const nextW = Math.max(1, Math.round(r.width));
        const nextH = Math.max(1, Math.round(r.height));
        const stageDims = $('#stageDimensions');
        if(stageDims) stageDims.textContent = `${nextW} × ${nextH} PX`;
        const stageRatio = $('#stageRatio');
        if(stageRatio) stageRatio.textContent = 'FORMAT / '+canvasAspect;
        // A file chooser returning focus should NEVER cause a destructive rebuild.
        if (W && H && nextW === W && nextH === H) {
          syncTransformUI();
          return;
        }
        const saved = preserveMeshSnapshot();
        const oldStageW = W, oldStageH = H;
        W = nextW; H = nextH;
        if (bgImg && oldStageW && oldStageH) {
          if (imagePreset === 'fit' || imagePreset === 'fill') applyImagePreset(imagePreset, false);
          else {
            imageTransform.x *= W / oldStageW;
            imageTransform.y *= H / oldStageH;
            imageTransform.scale *= Math.min(W / oldStageW, H / oldStageH);
          }
        }
        D = Math.min(devicePixelRatio || 1, mobileDevice ? 1 : 1.25);
        const renderBudget = mobileDevice ? 0.8e6 : 1.5e6;
        if (W * H * D * D > renderBudget) D = Math.sqrt(renderBudget / (W * H));
        cv.width = Math.round(W * D); cv.height = Math.round(H * D);
        A = W < 700 ? 6.2 : 7.8;
        build();
        restoreResizedMesh(saved);
        resizeMask(W, H);
        light = {x: W * lightX * D, y: H * (1 - lightY) * D};
        pd = 1; dr = {full: 1}; go(); initFl(); uploadBg(); syncTransformUI();
      }
      let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(size, 200) });
      if(window.visualViewport){
        let lastViewportHeight=visualViewport.height;
        visualViewport.addEventListener('resize',()=>{
          const diff=Math.abs(visualViewport.height-lastViewportHeight);
          if(diff>35){lastViewportHeight=visualViewport.height;clearTimeout(rt);rt=setTimeout(size,250);}
        });
      }
      // Keep the chosen format fitted within the standard workspace.
      let verticalFormat=false, canvasAspect='16:9';
      document.body.dataset.format='landscape';
      const ratioControl=$('#ratio');
      function setAspect(value){
        if(![...ratioControl.options].some(o=>o.value===value))value='16:9';
        canvasAspect=value;ratioControl.value=value;verticalFormat=value==='9:16'||value==='3:4';
        const [w,h]=value.split(':').map(Number);
        document.body.style.setProperty('--canvas-aspect',String(w/h));
        size();go();
      }
      ratioControl.addEventListener('change',()=>setAspect(ratioControl.value));
      applyUITheme(uiTheme);
      $('#themeToggle').onclick = () => applyUITheme(uiTheme === 'dark' ? 'light' : 'dark');
      updateMetaClock();
      setInterval(updateMetaClock, 1000);
      function insideStage(p) { return p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H }
      function clampStage(p) { return { x: Math.max(0, Math.min(W, p.x)), y: Math.max(0, Math.min(H, p.y)) } }
      function frameRect() { const w = Math.min(W * .44, H * .6 * .8), h = w * 1.25; return { x: (W - w) / 2, y: (H - h) / 2 - 12, w, h } }

      // lace -> height map (white = high). rounded profiles come from nested strokes under 'lighten'
      // Radial patterns mark SEPARATE regions: a global bounding rectangle
      // turns six tiny Doily strokes into a near full-frame repaint.
      // Merge only intersecting rects and rasterize independent patches.
      function mark(a,b,c,d){
        if(dr?.full)return;
        const rect={x0:Math.max(0,a),y0:Math.max(0,b),x1:Math.min(W,c),y1:Math.min(H,d)};
        if(rect.x1<=rect.x0||rect.y1<=rect.y0)return;
        if(!dr)dr={rects:[]};
        const rs=dr.rects;
        // Merge transitive overlaps; this also collects sequential brush steps.
        for(let i=0;i<rs.length;){
          const q=rs[i],gap=2;
          if(rect.x0<=q.x1+gap&&rect.x1+gap>=q.x0&&rect.y0<=q.y1+gap&&rect.y1+gap>=q.y0){
            rect.x0=Math.min(rect.x0,q.x0);rect.y0=Math.min(rect.y0,q.y0);
            rect.x1=Math.max(rect.x1,q.x1);rect.y1=Math.max(rect.y1,q.y1);
            rs.splice(i,1);i=0;
          }else i++;
        }
        rs.push(rect);
        // Worst-case cap: a full upload costs less than dozens of small ones.
        if(rs.length>24||rs.reduce((sum,r)=>sum+(r.x1-r.x0)*(r.y1-r.y0),0)>W*H*.72)
          dr={full:1};
      }
      function markAll() { dr = { full: 1 } }
      function recalcMax() { let m = 0; for (let i = 0; i < NV; i++) { const ex = vx[i] - vx0[i], ey = vy[i] - vy0[i], d = ex * ex + ey * ey; if (d > m) m = d } maxD = Math.sqrt(m) }
      // Scratch canvas copies the changed region; WebGL uploads canvas pixels
      // without the synchronous CanvasRenderingContext2D.getImageData readback.
      const heightPatch=document.createElement('canvas');
      const heightPatchCtx=heightPatch.getContext('2d',{alpha:false});
      const renderStats={draws:0, fullDraws:0, partialDraws:0, lastDrawMs:0,
        averageDrawMs:0, lastCells:0, lastEdges:0, meshVertices:0,
        pixelReadbacks:0, pointerMoves:0, strokesApplied:0,
        lastPatchCount:0,lastBrushMs:0,averageBrushMs:0,
        appliedPoints:0,workerJobs:0,workerDraws:0,workerLastMs:0,
        workerAvailable:false,workerBusy:false,workerErrors:0};
      window.__index00Performance=renderStats;
      // redraw only the touched rectangle of the height map, upload only that rectangle
      function drawH(r) {
        const renderStart=performance.now();
        HS = W * H < 7e5 ? Math.min(D, 1.25) : 1; const w = Math.round(W * HS), h = Math.round(H * HS); let full = r.full;
        if (hc.width !== w || hc.height !== h) { hc.width = w; hc.height = h; full = 1 }
        let x0 = 0, y0 = 0, x1 = W, y1 = H;
        if (!full) { x0 = Math.max(0, Math.floor(r.x0)); y0 = Math.max(0, Math.floor(r.y0)); x1 = Math.min(W, Math.ceil(r.x1)); y1 = Math.min(H, Math.ceil(r.y1)); if (x1 <= x0 || y1 <= y0) return }
        const g = hg; g.setTransform(HS, 0, 0, HS, 0, 0); g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
        g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.globalCompositeOperation = 'lighten'; g.lineCap = 'round'; g.lineJoin = 'round';
        const M = 14, a0 = x0 - M, b0 = y0 - M, a1 = x1 + M, b1 = y1 + M, ins = i => vx[i] >= a0 && vx[i] <= a1 && vy[i] >= b0 && vy[i] <= b1;
        const L = [new Path2D, new Path2D, new Path2D, new Path2D], gray = ['#6b6b6b', '#808080', '#8f8f8f', '#999'];
        const queryArea={x0:a0,y0:b0,x1:a1,y1:b1};
        const selectedCells=!meshVisible?[]:full?allCellIds:geometryNear(meshCellBins,seenCells,queryArea);
        const selectedEdges=!meshVisible?[]:full?allEdgeIds:geometryNear(meshEdgeBins,seenEdges,queryArea);
        for (const n of selectedCells) {
          const c = cells[n]; if (!full && !c.some(ins)) continue; let t = 0; for (let k = 0; k < c.length; k++)t += vc[c[k]]; t /= c.length; if (t < .04) continue;
          const p = L[t < .25 ? 0 : t < .5 ? 1 : t < .8 ? 2 : 3]; p.moveTo(vx[c[0]], vy[c[0]]); for (let k = 1; k < c.length; k++)p.lineTo(vx[c[k]], vy[c[k]]); p.closePath()
        }
        renderStats.lastCells=selectedCells.length;
        renderStats.lastEdges=selectedEdges.length;
        renderStats.meshVertices=NV;
        L.forEach((p, i) => { g.fillStyle = gray[i]; g.fill(p) });
        const P = [new Path2D, new Path2D, new Path2D];
        for (const id of selectedEdges) {
          const i=id*2,a = edges[i], b = edges[i + 1]; if (!full && !ins(a) && !ins(b)) continue;
          const dx = vx[b] - vx[a], dy = vy[b] - vy[a], l = Math.max(.0001,Math.hypot(dx, dy)), q = A / (l + .05), p = P[q < .9 ? 0 : q < 1.5 ? 1 : 2];
          const bend = Math.sin(a * 12.9898 + b * 78.233) * Math.min(2.4, l * .18);
          p.moveTo(vx[a], vy[a]); p.quadraticCurveTo((vx[a] + vx[b]) * .5 - dy / l * bend, (vy[a] + vy[b]) * .5 + dx / l * bend, vx[b], vy[b]);
        }
        const S = (p, a) => a.forEach(z => { g.lineWidth = z[0]; g.strokeStyle = z[1]; g.stroke(p) });
        S(P[0], [[1.3, '#4a4a4a'], [.6, '#707070']]);
        S(P[1], [[2.1, '#666'], [1.3, '#999'], [.6, '#c4c4c4']]);
        S(P[2], [[4.8, '#808080'], [3.2, '#b3b3b3'], [1.9, '#ececec'], [.8, '#fff']]);
        for (const q of stampIndexes.stains.query(stains,full,a0,b0,a1,b1)) {
          if (!full && (q.x < a0 - q.r || q.x > a1 + q.r || q.y < b0 - q.r || q.y > b1 + q.r)) continue;
          const blob = new Path2D();
          for (let k = 0; k < 28; k++) { const an = k * Math.PI * 2 / 28, wob = .72 + .18 * Math.sin(an * 3 + q.seed) + .1 * Math.sin(an * 7 - q.seed * 1.7), x = q.x + Math.cos(an) * q.r * wob, y = q.y + Math.sin(an) * q.r * wob; if (!k) blob.moveTo(x, y); else blob.lineTo(x, y) }
          blob.closePath();
          const wash = g.createRadialGradient(q.x, q.y, q.r * .08, q.x, q.y, q.r * 1.15);
          wash.addColorStop(0, 'rgba(210,210,210,.48)'); wash.addColorStop(.54, 'rgba(150,150,150,.32)'); wash.addColorStop(1, 'rgba(80,80,80,0)');
          g.fillStyle = wash; g.fill(blob); g.strokeStyle = 'rgba(220,220,220,.48)'; g.lineWidth = 1.2; g.stroke(blob);
          for (let k = 0; k < 5; k++) { const an = q.seed + k * 2.399, rr = q.r * (.72 + .22 * Math.sin(k * 7 + q.seed)); g.fillStyle = 'rgba(225,225,225,.34)'; g.beginPath(); g.arc(q.x + Math.cos(an) * rr, q.y + Math.sin(an) * rr, 1 + (k % 2), 0, Math.PI * 2); g.fill() }
        }
        if (snags.length) {
          const thread = new Path2D(), fray = new Path2D();
          for (const q of stampIndexes.snags.query(snags,full,a0,b0,a1,b1)) {
            if (!full && (q.x < a0 - q.len || q.x > a1 + q.len || q.y < b0 - q.len || q.y > b1 + q.len)) continue;
            const ux = Math.cos(q.a), uy = Math.sin(q.a), nx = -uy, ny = ux, steps = 7;
            for (let k = 0; k <= steps; k++) { const t = k / steps - .5, jag = Math.sin(q.seed + k * 9.31) * q.r, x = q.x + ux * t * q.len + nx * jag, y = q.y + uy * t * q.len + ny * jag; if (!k) thread.moveTo(x, y); else thread.lineTo(x, y) }
            for (let k = 0; k < 4; k++) { const t = Math.sin(q.seed * 1.7 + k * 12.4) * .42, side = k % 2 ? 1 : -1, x = q.x + ux * t * q.len, y = q.y + uy * t * q.len; fray.moveTo(x, y); fray.quadraticCurveTo(x + nx * side * q.len * .28, y + ny * side * q.len * .28, x - ux * side * q.r * 2, y - uy * side * q.r * 2) }
          }
          g.lineCap = 'round'; g.strokeStyle = 'rgba(72,72,72,.9)'; g.lineWidth = 2.6; g.stroke(thread); g.strokeStyle = 'rgba(235,235,235,.82)'; g.lineWidth = 1.1; g.stroke(thread); g.strokeStyle = 'rgba(210,210,210,.72)'; g.lineWidth = .8; g.stroke(fray);
        }
        if (picots.length) {
          const pp = new Path2D, cp = new Path2D; for (const q of stampIndexes.picots.query(picots,full,a0,b0,a1,b1)) {
            if (!full && (q.x < a0 || q.x > a1 || q.y < b0 || q.y > b1)) continue; const pr = q.r * .5;
            for (let k = 0; k < 5; k++) { const an = q.a + k * 1.2566, cx = q.x + Math.cos(an) * q.r * .62, cy = q.y + Math.sin(an) * q.r * .62; pp.moveTo(cx + pr, cy); pp.arc(cx, cy, pr, 0, 6.283) }
            cp.moveTo(q.x + q.r * .2, q.y); cp.arc(q.x, q.y, q.r * .2, 0, 6.283)
          }
          g.fillStyle = '#8c8c8c'; g.fill(pp); S(pp, [[2.4, '#707070'], [1.3, '#cfcfcf']]); g.fillStyle = '#f4f4f4'; g.fill(cp)
        }
        if (stitches.length) {
          for (const q of stampIndexes.stitches.query(stitches,full,a0,b0,a1,b1)) {
            if (!full && (q.x < a0 - q.r * 2 || q.x > a1 + q.r * 2 || q.y < b0 - q.r * 2 || q.y > b1 + q.r * 2)) continue;
            const r = q.r, p = new Path2D();
            if (q.style === 0) { p.moveTo(-r, 0); p.lineTo(r, 0) }
            else if (q.style === 1) { p.moveTo(0,-r); p.bezierCurveTo(r*1.35,-r*.85,r*1.35,r*.85,0,r); p.bezierCurveTo(-r*1.35,r*.85,-r*1.35,-r*.85,0,-r) }
            else if (q.style === 2) { p.moveTo(-r,-r); p.lineTo(r,r); p.moveTo(r,-r); p.lineTo(-r,r) }
            else if (q.style === 3) { p.moveTo(-r,0); p.quadraticCurveTo(0,-r*1.3,r,0); p.quadraticCurveTo(0,r*1.3,-r,0); p.closePath() }
            else if (q.style === 4) { p.arc(0,0,r*.72,0,Math.PI*2) }
            else { p.moveTo(-r,0); p.lineTo(r,0); for (let k=0;k<4;k++) { const x=-r*.55+k*r*.36, side=k%2?-1:1; p.moveTo(x,0); p.quadraticCurveTo(x+r*.1,side*r*.75,x+r*.45,side*r*.92) } }
            g.save(); g.translate(q.x,q.y); g.rotate(q.a); g.lineCap='round'; g.lineJoin='round';
            if (q.style === 3) { g.fillStyle='#a0a0a0'; g.fill(p) }
            if (q.style === 4) { g.fillStyle='#a2a2a2'; g.beginPath(); g.arc(0,0,r*.72,0,Math.PI*2); g.fill() }
            g.strokeStyle='#454545'; g.lineWidth=Math.max(2.2,r*.42); g.stroke(p);
            g.strokeStyle='#a4a4a4'; g.lineWidth=Math.max(1.35,r*.26); g.stroke(p);
            g.strokeStyle='#f3f3f3'; g.lineWidth=Math.max(.65,r*.1); g.translate(-r*.08,-r*.1); g.stroke(p);
            if (q.style === 4) { g.fillStyle='#f4f4f4'; g.beginPath(); g.arc(-r*.18,-r*.22,r*.16,0,Math.PI*2); g.fill() }
            g.restore();
          }
        }
        g.restore();
        if (full) {upload(0, hc);renderStats.fullDraws++;}
        else {
          const sx = Math.floor(x0 * HS), sy = Math.floor(y0 * HS),
                sw = Math.min(hc.width - sx, Math.ceil((x1 - x0) * HS) + 1),
                sh = Math.min(hc.height - sy, Math.ceil((y1 - y0) * HS) + 1);
          if(sw>0&&sh>0){
            if(heightPatch.width!==sw)heightPatch.width=sw;
            if(heightPatch.height!==sh)heightPatch.height=sh;
            heightPatchCtx.setTransform(1,0,0,1,0,0);
            heightPatchCtx.drawImage(hc,sx,sy,sw,sh,0,0,sw,sh);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D,tx[0]);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
            gl.texSubImage2D(gl.TEXTURE_2D,0,sx,hc.height-sy-sh,gl.RGBA,gl.UNSIGNED_BYTE,heightPatch);
          }
          renderStats.partialDraws++;
        }
        renderStats.draws++;
        renderStats.lastDrawMs=performance.now()-renderStart;
        renderStats.averageDrawMs+= (renderStats.lastDrawMs-renderStats.averageDrawMs)*.1;
      }
      // Dedicated raster Worker. It owns its OffscreenCanvas and heavy Path2D
      // height-map rendering; the UI thread retains brush math and WebGL.
      // A single in-flight job + merged pending damage avoids worker queue buildup.
      let rasterWorker=null,rasterWorkerURL=null,rasterReady=false,rasterBusy=false;
      let rasterVersion=0,rasterSeq=0,rasterPending=null;
      let sentGeometryRevision=-1, sentMarks={};
      function stampUpdates(){
        const updates={};
        for(const [key,records] of Object.entries({picots,stains,snags,stitches})){
          const previous=sentMarks[key];
          const append=previous?.records===records&&previous.count<=records.length;
          updates[key]={append,items:records.slice(append?previous.count:0)};
          sentMarks[key]={records,count:records.length};
        }
        return updates;
      }
      function mergeDamage(a,b){
        if(a?.full||b?.full)return {full:true};
        const rects=[...(a?.rects||[])];
        for(const patch of b?.rects||[]){
          const rect={...patch};
          for(let i=0;i<rects.length;){
            const q=rects[i];
            if(rect.x0<=q.x1+2&&rect.x1+2>=q.x0&&rect.y0<=q.y1+2&&rect.y1+2>=q.y0){
              rect.x0=Math.min(rect.x0,q.x0);rect.y0=Math.min(rect.y0,q.y0);
              rect.x1=Math.max(rect.x1,q.x1);rect.y1=Math.max(rect.y1,q.y1);
              rects.splice(i,1);i=0;
            }else i++;
          }
          rects.push(rect);
        }
        const area=rects.reduce((sum,r)=>sum+(r.x1-r.x0)*(r.y1-r.y0),0);
        return rects.length>24||area>W*H*.72?{full:true}:{rects};
      }
      function resetRasterWorker(reason){
        try{rasterWorker?.terminate();}catch(_){}
        if(rasterWorkerURL)URL.revokeObjectURL(rasterWorkerURL);
        rasterWorker=null;rasterWorkerURL=null;rasterReady=false;rasterBusy=false;rasterPending=null;
        renderStats.workerAvailable=false;renderStats.workerBusy=false;
        if(reason){renderStats.workerErrors++;console.warn('Index 00 raster worker fallback:',reason);markAll();go();}
      }
      function createRasterWorker(){
        if(!gl||typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||
           typeof createImageBitmap==='undefined')return false;
        if(rasterWorker)return true;
        try{
          rasterWorkerURL=URL.createObjectURL(new Blob([stampIndexSource.replace('export class','class'), '\n', rasterWorkerSource],{type:'text/javascript'}));
          rasterWorker=new Worker(rasterWorkerURL);
          rasterWorker.onerror=e=>resetRasterWorker(e.message||'Worker unavailable');
          rasterWorker.onmessage=e=>{
            const d=e.data;
            if(d.version!==rasterVersion){
              if(d.outputs)for(const p of d.outputs)p.bitmap?.close();
              return;
            }
            if(d.type==='ready'){
              rasterReady=true;renderStats.workerAvailable=true;
              sendRasterJob();return;
            }
            if(d.type==='error'){resetRasterWorker(d.message);return;}
            if(d.type!=='rendered')return;
            try{
              gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tx[0]);
              gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
              for(const patch of d.outputs){
                if(patch.full)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,patch.bitmap);
                else gl.texSubImage2D(gl.TEXTURE_2D,0,patch.sx,
                    Math.round(H*(W*H<7e5?Math.min(D,1.25):1))-patch.sy-patch.sh,
                    gl.RGBA,gl.UNSIGNED_BYTE,patch.bitmap);
                patch.bitmap.close();
              }
              renderStats.workerDraws++;
              renderStats.workerLastMs=d.elapsedMs;
            }catch(error){resetRasterWorker(String(error));return;}
            rasterBusy=false;renderStats.workerBusy=false;
            go();sendRasterJob();
          };
          return true;
        }catch(error){resetRasterWorker(String(error));return false;}
      }
      function updateWorkerGeometry(){
        if(!W||!H||!NV||!createRasterWorker())return;
        rasterVersion++;rasterReady=false;rasterBusy=false;rasterPending=null;
        sentGeometryRevision=-1;sentMarks={};
        // Mesh connectivity changes only on mesh/format/size changes.
        rasterWorker.postMessage({type:'geometry',version:rasterVersion,
          W,H,D,A,NV,cells,edges,vx0,vy0,vx,vy,vc});
      }
      function sendRasterJob(){
        if(!rasterWorker||!rasterReady||rasterBusy||!rasterPending)return;
        const damage=rasterPending;rasterPending=null;
        rasterBusy=true;renderStats.workerBusy=true;renderStats.workerJobs++;
        const changed=sentGeometryRevision!==geometryRevision;
        const workerVX=changed?vx.slice():null,workerVY=changed?vy.slice():null,workerVC=changed?vc.slice():null;
        sentGeometryRevision=geometryRevision;
        rasterWorker.postMessage({type:'render',version:rasterVersion,sequence:++rasterSeq,
          D,damage,geometryRevision,meshVisible,vx:workerVX,vy:workerVY,vc:workerVC,
          marks:stampUpdates()},changed?[workerVX.buffer,workerVY.buffer,workerVC.buffer]:[]);
      }
      function queueRasterDamage(damage){
        if(!rasterWorker||!rasterReady)return false;
        rasterPending=mergeDamage(rasterPending,damage);
        sendRasterJob();return true;
      }
      // PNG/JPEG exports must contain the final stroke, not the last bitmap
      // that happened to arrive from the worker. Wait before resizing the GL
      // drawing buffer for high-resolution output.
      async function settleRasterBeforeExport(){
        flushPendingStroke();
        if(dr){
          const damage=dr;dr=null;
          if(!queueRasterDamage(damage)){
            if(damage.full)drawH(damage);
            else for(const patch of damage.rects)drawH(patch);
          }
        }
        const deadline=performance.now()+6000;
        while(rasterBusy||rasterPending){
          if(performance.now()>deadline){
            resetRasterWorker('raster timed out during export');
            dr=null;drawH({full:true});
            break;
          }
          await new Promise(resolve=>setTimeout(resolve,20));
        }
      }

      function drawP() { // photo layer at half resolution
        pc.width = W >> 1; pc.height = H >> 1; pg.setTransform(.5, 0, 0, .5, 0, 0); if (!framed) return;
        const f = frameRect(); pg.save(); pg.beginPath(); pg.rect(f.x, f.y, f.w, f.h); pg.clip();
        const mw = media && (media.videoWidth || media.naturalWidth), mh = media && (media.videoHeight || media.naturalHeight);
        if (mw) { const s = Math.max(f.w / mw, f.h / mh); pg.drawImage(media, f.x + (f.w - mw * s) / 2, f.y + (f.h - mh * s) / 2, mw * s, mh * s) }
        else { const q = pg.createLinearGradient(f.x, f.y, f.x + f.w, f.y + f.h); q.addColorStop(0, '#3a3833'); q.addColorStop(1, '#26251f'); pg.fillStyle = q; pg.fillRect(f.x, f.y, f.w, f.h) }
        pg.restore(); pg.strokeStyle = 'rgba(226,214,210,.25)'; pg.strokeRect(f.x + .5, f.y + .5, f.w - 1, f.h - 1);
      }
      function draw() {
        if (!gl || !vx) return; dirty = false;
        flushPendingStroke();
        const vid = !labMode && media && media.tagName === 'VIDEO';
        const tm = performance.now() / 1000;
        if (mouse && hv < .02) { mp.x = mouse.x; mp.y = mouse.y }
        hv += ((mouse ? 1 : 0) - hv) * .12; if (!mouse && hv < .01) hv = 0;
        if (mouse) { mp.x += (mouse.x - mp.x) * .35; mp.y += (mouse.y - mp.y) * .35 }
        if (Math.abs((mouse?1:0)-hv)>.01 || (mouse && Math.hypot(mouse.x-mp.x,mouse.y-mp.y)>.2)) dirty = true;
        if (!labMode) { if (dr) { const r = dr; dr = null;
            renderStats.lastPatchCount=r.full?1:r.rects.length;
            if(!queueRasterDamage(r)){
              if(r.full)drawH(r);else for(const rect of r.rects)drawH(rect);
            }
          }
          if (pd || vid) { drawP(); upload(1, pc); pd = 0 }
        }
        clothDamage.sync(W,H,stitches,{tension:clothTension,tear:clothTear,material:clothSurface});clothDamage.upload(gl,tx[5]);
        fabricTextures.select(clothSurface);
        gl.uniform1f(U.uWrinkleAmount,wrinkleAmount);gl.uniform1f(U.uWrinkleScale,wrinkleScale);gl.uniform1f(U.uWrinkleAngle,wrinkleAngle*Math.PI/180);gl.uniform1f(U.uWrinkleStyle,wrinkleStyle);gl.uniform1f(U.uWeaveScale,weaveScale);gl.uniform1f(U.uBlendOpacity,blendOpacity);
        gl.uniform1f(U.uCloth,clothSurface);
        if (labMode) uploadMask();
        gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform2f(U.uL,lightX*cv.width,(1-lightY)*cv.height); gl.uniform1f(U.uLightPower, lightPower); gl.uniform1f(U.uLightSoft, lightSoft); gl.uniform1f(U.uShadow, shadowStrength); gl.uniform1f(U.uLightType, lightPreset); gl.uniform1f(U.uOnly, only ? 1 : 0); gl.uniform1f(U.uK, cv.width / W); gl.uniform2f(U.uM, mp.x * cv.width / W, (H - mp.y) * cv.height / H); gl.uniform1f(U.uS, only ? 0 : hv); gl.uniform1f(U.uT, tm); gl.uniform1f(U.uImg, bgImg ? 1 : 0); gl.uniform1f(U.uBl, bm); gl.uniform1f(U.uTex, textureMode); gl.uniform1f(U.uPal, paletteMode); gl.uniform1f(U.uLab, labMode ? 1 : 0); gl.uniform1f(U.uFx, fxMode); gl.uniform1f(U.uFxStrength, fxStrength); gl.uniform1f(U.uFxGrain, fxGrain); gl.uniform1f(U.uFxBleed, fxBleed); gl.uniform1f(U.uFxWear, fxWear); gl.uniform1f(U.uFxExposure, fxExposure); gl.uniform1f(U.uFxContrast, fxContrast); gl.uniform1f(U.uFxSoft, fxSoft); gl.uniform1f(U.uFxBorder, fxBorder); gl.uniform1f(U.uFxSeed, fxSeed); gl.uniform1f(U.uFxBefore, fxBefore); gl.uniform1f(U.uFxMaskActive, brushMode==='full'?0:1);
        if(bgImg){
          const frameD = cv.width / Math.max(1,W);
          gl.uniform2f(U.uImageCenter, imageTransform.x/Math.max(W,1),1-imageTransform.y/Math.max(H,1));
          gl.uniform2f(U.uImageSize,bgImg.naturalWidth,bgImg.naturalHeight);
          gl.uniform1f(U.uImageScale,imageTransform.scale*frameD);
          gl.uniform1f(U.uImageAngle,imageTransform.angle*Math.PI/180);
          gl.uniform2f(U.uImageFlip,imageTransform.flipX?-1:1,imageTransform.flipY?-1:1);
        }
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        ring.style.display = labMode || !mouse || only ? 'none' : 'block'; if (mouse && !labMode) { const cr = cv.getBoundingClientRect(); const cursorSize = 34; const screenLightX = light.x / Math.max(D,1); const screenLightY = H - (light.y / Math.max(D,1)); const dx = mouse.x - screenLightX; const dy = mouse.y - screenLightY; const len = Math.max(1, Math.hypot(dx, dy)); const nx = dx / len; const ny = dy / len; const shadowDist = Math.min(7.5, Math.max(1.8, len * 0.022)); const s1x = (nx * shadowDist).toFixed(2); const s1y = (ny * shadowDist).toFixed(2); const s2x = (nx * shadowDist * 1.8).toFixed(2); const s2y = (ny * shadowDist * 1.8).toFixed(2); const glow = Math.max(0, 1 - Math.min(1, len / Math.max(W, H))); const alpha1 = (0.28 + glow * 0.1).toFixed(3); const alpha2 = (0.13 + glow * 0.08).toFixed(3); ring.style.width = ring.style.height = cursorSize + 'px'; ring.style.transform = `translate(${cr.left + mouse.x - cursorSize / 2}px,${cr.top + mouse.y - cursorSize / 2}px)`; ring.style.filter = `drop-shadow(${s1x}px ${s1y}px 1.3px rgba(0,0,0,${alpha1})) drop-shadow(${s2x}px ${s2y}px 4px rgba(0,0,0,${alpha2}))`; ring.style.opacity = String(0.92 + glow * 0.08); }
        if (vid) dirty = true;
      }
      function go() { dirty = true }
      let lg = 0; (function loop(t) { if (document.hidden) { requestAnimationFrame(loop); return; } if (((textureMode === 1 || textureMode === 2) && t - lg > 110)) { lg = t; dirty = true } if (dirty) draw(); requestAnimationFrame(loop) })(0);

      // symmetry
      function pts(p) {
        if (mode === 'free') return [p];
        if (mode === 'mirror') return [p, { x: W - p.x, y: p.y }];
        const cx=W/2,cy=H/2,dx=p.x-cx,dy=p.y-cy,theta=Math.atan2(dy,dx),o=[];
        if (mode === 'doily' || mode === 'radial8' || mode === 'radial12' || mode === 'rose5' || mode === 'rose8' || mode === 'mandala' || mode === 'spiral') {
          const n=mode==='doily'?6:mode==='radial8'||mode==='rose8'?8:mode==='radial12'||mode==='mandala'?12:mode==='rose5'?5:10;
          const petals=mode==='rose5'?5:mode==='rose8'?8:0;
          const roseScale=petals ? .68+.32*(.5+.5*Math.cos(petals*theta)) : 1;
          const spin=mode==='spiral';
          for(let k=0;k<n;k++){
            const t=spin?k/(n-1):0,angle=k*Math.PI*2/n+(spin?t*Math.PI*1.5:0),scale=roseScale*(spin ? .42+.58*t : 1),c=Math.cos(angle),s=Math.sin(angle);
            o.push({x:cx+(dx*c-dy*s)*scale,y:cy+(dx*s+dy*c)*scale});
            if(mode==='mandala')o.push({x:cx+(dx*c+dy*s)*scale,y:cy+(dx*s-dy*c)*scale});
          }
          return o;
        }
        const per = mode === 'edging' ? W / 5 : Math.max(W, H) / 5, bx = ((p.x % per) + per) % per, by = ((p.y % per) + per) % per, gridPts = [];
        for (let X = bx; X < W + per; X += per) { if (mode === 'edging') gridPts.push({ x: X, y: p.y }); else for (let Y = by; Y < H + per; Y += per)gridPts.push({ x: X, y: Y }) }
        return gridPts;
      }
      function opAt(p, ang) {
        const R2 = R * R, x0 = p.x - R, x1 = p.x + R, y0 = p.y - R, y1 = p.y + R, pad = R * 1.5 + 26; mark(p.x - pad, p.y - pad, p.x + pad, p.y + pad);
        if (tool === 'esprit') { picots.push({ x: p.x + Math.cos(ang + side * 1.57) * 7, y: p.y + Math.sin(ang + side * 1.57) * 7, r: 5 + Math.random() * 3, a: Math.random() * 6.28 }); return }
        if (tool === 'unpick') {
          picots = picots.filter(q => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 > R2 * .45);
          stains = stains.filter(q => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 > (R + q.r) ** 2);
          snags = snags.filter(q => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 > (R + q.len * .5) ** 2);
          stitches = stitches.filter(q => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 > (R + q.r * 2) ** 2);
        }
        if(tool!=='bloom'&&tool!=='esprit')geometryRevision++;
        const rr = R + meshIndexShift, bx0 = Math.max(0, Math.floor((p.x - rr + GB) / GB)), bx1 = Math.min(gw - 1, Math.floor((p.x + rr + GB) / GB)), by0 = Math.max(0, Math.floor((p.y - rr + GB) / GB)), by1 = Math.min(gh - 1, Math.floor((p.y + rr + GB) / GB));
        for (let by = by0; by <= by1; by++)for (let bx = bx0; bx <= bx1; bx++)for (let q = gs[by * gw + bx], qe = gs[by * gw + bx + 1]; q < qe; q++) {
          const i = gi[q], X = vx[i], Y = vy[i]; if (X < x0 || X > x1 || Y < y0 || Y > y1) continue; const dx = X - p.x, dy = Y - p.y, d2 = dx * dx + dy * dy; if (d2 > R2) continue;
          const d = Math.sqrt(d2); let w = 1 - d / R; w *= w;
          if (tool === 'cord') { const k = .2 * w; vx[i] -= dx * k; vy[i] -= dy * k; const ex = vx[i] - vx0[i], ey = vy[i] - vy0[i], dd = ex * ex + ey * ey; if (dd > maxD * maxD) maxD = Math.sqrt(dd) }
          else if (tool === 'snag') { const k = .7 * w; vx[i] += Math.cos(ang) * k * 11 - dy / (d + 1) * k * 3; vy[i] += Math.sin(ang) * k * 11 + dx / (d + 1) * k * 3; const ex = vx[i] - vx0[i], ey = vy[i] - vy0[i], dd = ex * ex + ey * ey; if (dd > maxD * maxD) maxD = Math.sqrt(dd) }
          else if (tool === 'toile') { const q = 1 - d / (R * .75); if (q > 0) vc[i] = Math.min(1, vc[i] + .55 * q) }
          else if (tool === 'veil') { vc[i] = Math.min(.72, vc[i] + .2 * w) }
          else if (tool === 'bloom') { /* stains are added as distinct chemical marks along the stroke */ }
          else { const k = .6 * w; vx[i] += (vx0[i] - X) * k; vy[i] += (vy0[i] - Y) * k; vc[i] *= 1 - .75 * w }
          // Track the maximum shift since the last spatial index refresh.
          if(indexedVX.length===NV){
            const shift=Math.hypot(vx[i]-indexedVX[i],vy[i]-indexedVY[i]);
            if(shift>meshIndexShift)meshIndexShift=shift;
          }
        }
      }
      function apply(a, b) {
        const brushStart=performance.now();
        const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / (R * .25))), ang = Math.atan2(b.y - a.y, b.x - a.x);
        for (let i = 1; i <= n; i++) {
          const p = { x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }, step = d / n;
          if (tool === 'esprit') { acc += step; if (acc < 14 && !(d === 0)) continue; acc = 0; side = -side }
          if (tool === 'stitch') {
            stitchAcc += step;
            if (stitchAcc >= Math.max(9, R * .38) || d === 0) { stitchAcc = 0; pts(p).forEach(q => { const r = Math.max(3.5, Math.min(16, R * .14)); stitches.push({ x:q.x, y:q.y, a:ang, r, style:stitchStyle, tension:clothTension }); mark(q.x-r*2,q.y-r*2,q.x+r*2,q.y+r*2) }) }
          } else pts(p).forEach(q => opAt(q, ang));
          if (tool === 'bloom') { bloomAcc += step; if (bloomAcc >= 27 || d === 0) { bloomAcc = 0; pts(p).forEach(q => { const r = 19 + Math.random() * R * .38; stains.push({ x: q.x, y: q.y, r, seed: Math.random() * 6.28 }); mark(q.x - r * 1.3, q.y - r * 1.3, q.x + r * 1.3, q.y + r * 1.3) }) } }
          if (tool === 'snag') { snagAcc += step; if (snagAcc >= 18 || d === 0) { snagAcc = 0; pts(p).forEach(q => snags.push({ x: q.x, y: q.y, a: ang, len: 18 + Math.random() * 20, r: 1.2 + Math.random() * 1.4, seed: Math.random() * 6.28 })) } }
          if (tool === 'cord') { bl += step; if (bl > 70) { bl = 0; pts(p).forEach(q => picots.push({ x: q.x, y: q.y, r: 9 + Math.random() * 4, a: Math.random() * 6.28 })) } }
        }
        renderStats.lastBrushMs=performance.now()-brushStart;
        renderStats.averageBrushMs+=(renderStats.lastBrushMs-renderStats.averageBrushMs)*.1;
        renderStats.appliedPoints+=n;
        if (snd) tick(); go();
      }
      // Browsers may send hundreds of pointer events per second. Complex radial
      // tools perform 6–24 copies of each stroke. Consume at most one new point
      // per display frame, while apply() still interpolates a continuous path.
      let pendingStroke=null,pendingStrokeFrame=0;
      function flushPendingStroke(){
        if(pendingStrokeFrame){cancelAnimationFrame(pendingStrokeFrame);pendingStrokeFrame=0;}
        const pending=pendingStroke;pendingStroke=null;
        if(!pending)return;
        if(pending.mask && maskDrawing){maskStroke(maskPrevious,pending.point);maskPrevious=pending.point;}
        else if(!pending.mask && drawing){apply(last,pending.point);last=pending.point;renderStats.strokesApplied++;}
      }
      function queueStroke(point,mask){
        renderStats.pointerMoves++;
        pendingStroke={point,mask};
        if(!pendingStrokeFrame)pendingStrokeFrame=requestAnimationFrame(flushPendingStroke);
      }
      function pt(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
      let activePaintPointer=null;
      cv.addEventListener('pointerdown', e => { if(transformActive){e.preventDefault();return;} if(activePaintPointer!==null)return; const p = pt(e); if(labMode){
        if(!insideStage(p)||brushMode==='full')return;
        e.preventDefault();activePaintPointer=e.pointerId;cv.setPointerCapture(e.pointerId);maskDrawing=true;
        saveMaskUndo();maskPrevious=p;drawMaskDot(p);return;
      } if (!insideStage(p)) return; e.preventDefault(); activePaintPointer=e.pointerId; clearTimeout(ft); cv.setPointerCapture(e.pointerId); drawing = true; last = p; mouse = p; acc = 99; bl = 71; bloomAcc = 0; snagAcc = 0; stitchAcc = 0; stack.push({ vx: vx.slice(), vy: vy.slice(), vc: vc.slice(), pk: picots.slice(), stains: stains.slice(), snags: snags.slice(), stitches: stitches.slice() }); if (stack.length > 30) stack.shift(); $('#stw').classList.add('busy'); st(({ toile: 'closing the net', cord: 'gathering', esprit: 'picking', veil: 'laying a veil', bloom: 'developing bloom', snag: 'pulling a snag', stitch: 'embroidering raised thread', unpick: 'unpicking' })[tool] || 'working'); apply(last, last) });
      cv.addEventListener('pointermove', e => { if(transformActive){mouse=null;return;} if(activePaintPointer!==null && e.pointerId!==activePaintPointer)return; const p = pt(e); if(labMode){
        if(maskDrawing)queueStroke(clampStage(p),true);
        return;
      }
      mouse = labMode ? null : (drawing ? clampStage(p) : (insideStage(p) ? p : null));
      if (drawing && !labMode)queueStroke(mouse,false);
      go(); });
      const up = e => { if(activePaintPointer!==null&&e.pointerId!==activePaintPointer)return;
        // Never lose the last part of a stroke when the pointer is released
        // between scheduled animation frames.
        flushPendingStroke();activePaintPointer=null;
        if(maskDrawing){maskDrawing=false;maskPrevious=null;maskTouched=true;go();return;}
        if (!drawing) return; drawing = false; $('#stw').classList.remove('busy'); st('ready');
        // Refresh the spatial index once per completed gesture, never per point.
        // Subsequent strokes remain local even after extensive mesh deformation.
        if(meshIndexShift>.001){indexMeshGeometry();reindexBrushGrid();}
        // Local patches already contain the final exact raster result.
        // The old 500ms forced full-canvas rebuild caused a visible pause
        // immediately after every multi-symmetry gesture.
        clearTimeout(ft); go() };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', () => { mouse = null; go() });

      // Floating tool palette: move using the dedicated handle, not brush controls.
      (()=>{
        const dock=$('#toolPalette'),grip=dock.querySelector('.dock-drag-row'),reset=$('#paletteReset');
        let drag=null;
        function clampPos(px,py){
          const r=dock.getBoundingClientRect();
          const hw=Math.min(innerWidth/2, r.width/2),hh=Math.min(innerHeight/2,r.height/2);
          return {x:Math.min(innerWidth-hw-5,Math.max(hw+5,px)),y:Math.min(innerHeight-hh-5,Math.max(hh+5,py))};
        }
        function position(x,y,persist){
          const p=clampPos(x,y);
          dock.classList.add('is-floating');
          dock.style.setProperty('--dock-x',`${p.x}px`); dock.style.setProperty('--dock-y',`${p.y}px`);
          if(persist)storage.set('afterimage-dock-pos',JSON.stringify({x:p.x/innerWidth,y:p.y/innerHeight}));
        }
        grip.addEventListener('pointerdown',e=>{
          if(e.button!==0 || e.target.closest('#paletteReset'))return;
          e.preventDefault();e.stopPropagation();
          const r=dock.getBoundingClientRect();
          drag={id:e.pointerId,dx:e.clientX-(r.left+r.width/2),dy:e.clientY-(r.top+r.height/2)};
          grip.setPointerCapture(e.pointerId);
        });
        grip.addEventListener('pointermove',e=>{
          if(!drag||e.pointerId!==drag.id)return;
          e.preventDefault();position(e.clientX-drag.dx,e.clientY-drag.dy,false);
        });
        function endDrag(e){
          if(!drag||e.pointerId!==drag.id)return;
          const r=dock.getBoundingClientRect();position(r.left+r.width/2,r.top+r.height/2,true);drag=null;
        }
        grip.addEventListener('pointerup',endDrag);grip.addEventListener('pointercancel',endDrag);
        reset.addEventListener('click',()=>{
          dock.classList.remove('is-floating');
          dock.style.removeProperty('--dock-x');dock.style.removeProperty('--dock-y');
          storage.set('afterimage-dock-pos','');
          st('palette returned to its default position');
        });
        const saved=storage.get('afterimage-dock-pos');
        if(saved){try{const p=JSON.parse(saved);if(Number.isFinite(p.x)&&Number.isFinite(p.y))requestAnimationFrame(()=>position(p.x*innerWidth,p.y*innerHeight,false));}catch(e){}}
        addEventListener('resize',()=>{
          if(!dock.classList.contains('is-floating')||drag)return;
          const r=dock.getBoundingClientRect();position(r.left+r.width/2,r.top+r.height/2,true);
        });
      })();
      // sound: a soft thread tick
      function tick() { const t = performance.now(); if (t - lastTick < 55) return; lastTick = t; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter(); o.type = 'triangle'; o.frequency.value = 420 + Math.random() * 260; f.type = 'lowpass'; f.frequency.value = 1400; g.gain.setValueAtTime(.025, ac.currentTime); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + .07); o.connect(f); f.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + .08) } catch (_) { } }

      // ui
      function group(sel, attr, fn) { document.querySelectorAll(sel + ' button').forEach(b => b.onclick = () => { document.querySelectorAll(sel + ' button').forEach(o => o.classList.toggle('on', o === b)); fn(b.dataset[attr]) }) }
      document.querySelectorAll('.glass').forEach(panel => panel.addEventListener('pointermove', e => { const r = panel.getBoundingClientRect(); panel.style.setProperty('--gl-x', `${((e.clientX - r.left) / r.width) * 100}%`); panel.style.setProperty('--gl-y', `${((e.clientY - r.top) / r.height) * 100}%`) }));
      function showHint() { hint.classList.add('show'); clearTimeout(showHint.t); showHint.t = setTimeout(() => hint.classList.remove('show'), 2600) }
      const hint = $('#hint'), toolHints = { toile: 'toilé — close the weave into cloth', cord: 'cord — gather the mesh into raised thread', esprit: 'esprit — build small looped picots', veil: 'veil — lay a soft translucent layer', bloom: 'bloom — develop irregular chemical stains', snag: 'snag — pull and fray the mesh', stitch: 'embroidery — draw raised stitches; choose a style under more', unpick: 'unpick — lift the marks back out' };
      let studioSidebarWanted = true;
      const sidebarWide = () => innerWidth > 900 && !mobileDevice;
      const placeExtra = () => {};
      function setStudioSidebar(show){
        studioSidebarWanted = !!show;
        $('#extra').hidden = !show || labMode;
        $('#more').setAttribute('aria-expanded', String(show && !labMode));
        document.body.classList.toggle('sidebar-open', show && !labMode && sidebarWide());
        requestAnimationFrame(size);
      }
      $('#more').onclick = () => setStudioSidebar($('#extra').hidden);
      $('#sidebarClose').onclick = () => setStudioSidebar(false);
      if(sidebarWide()) setStudioSidebar(true);
      const labPanel = $('#labPanel');
      const setLabCollapsed=collapsed=>{
        labPanel.classList.toggle('mobile-collapsed',collapsed);
        $('#labSheetToggle').textContent=collapsed?'show controls ▴':'hide controls ▾';
        $('#labSheetToggle').setAttribute('aria-expanded',String(!collapsed));
      };
      $('#labSheetToggle').onclick=()=>setLabCollapsed(!labPanel.classList.contains('mobile-collapsed'));
      // Keep panels independent of the artboard size, preserving existing mesh strokes.
      setLabCollapsed(false);
      if(mobileDevice){$('#labQuality').value='4';$('#exportResolution').value='4';}
      function setLabMode(on) {
        labMode = !!on; document.body.classList.toggle('lab-mode', labMode);
        labPanel.hidden = !labMode; $('#stageMode').textContent=labMode?'CHEMICAL DARKROOM':'MATERIAL STUDY'; $('#darkroom').classList.toggle('on', labMode); $('#darkroom').setAttribute('aria-pressed', String(labMode));
        if (labMode) { uploadBg(); $('#extra').hidden = true; $('#more').setAttribute('aria-expanded', 'false'); mouse = null; drawing = false; $('#stw').classList.remove('busy'); st(bgImg ? 'darkroom · image loaded' : 'darkroom · load a photograph'); }
        else {uploadBg();st('ready');if(studioSidebarWanted && sidebarWide()) setStudioSidebar(true)} syncTransformUI(); go();
      }
      $('#darkroom').onclick = () => setLabMode(!labMode);
      $('#labClose').onclick = () => setLabMode(false);
      $('#labImport').onclick = () => openImagePicker($('#imp_f'));
      const labDefaults={fxStrength:82,fxGrain:48,fxBleed:56,fxWear:38,fxExposure:0,fxContrast:50,fxSoft:25,fxBorder:0};
      $('#labReset').onclick = () => {for(const [key,v] of Object.entries(labDefaults))$('#'+key).value=v;updateLabValues();st('darkroom · sliders reset')};
      function updateLabValues(){
        fxStrength=+$('#fxStrength').value/100;fxGrain=+$('#fxGrain').value/100;
        fxBleed=+$('#fxBleed').value/100;fxWear=+$('#fxWear').value/100;
        fxExposure=+$('#fxExposure').value/100;fxContrast=+$('#fxContrast').value/100;
        fxSoft=+$('#fxSoft').value/100;fxBorder=+$('#fxBorder').value/100;
        for(const key of ['fxStrength','fxGrain','fxBleed','fxWear','fxContrast','fxSoft','fxBorder'])$('#'+key+'Value').textContent=$('#'+key).value+'%';
        $('#fxExposureValue').textContent=+$('#fxExposure').value>0?'+'+$('#fxExposure').value:$('#fxExposure').value;
        go();
      }
      ['fxStrength','fxGrain','fxBleed','fxWear','fxExposure','fxContrast','fxSoft','fxBorder'].forEach(id => $('#'+id).addEventListener('input',updateLabValues));
      $('#labRegenerate').onclick=()=>{fxSeed+=2.719+Math.random()*24;go();st('new developer pattern / reaction');};
      const compare=$('#labCompare');
      const toggleBefore= v=>{fxBefore=v?1:0;compare.classList.toggle('on',!!v);go()};
      compare.addEventListener('pointerdown',e=>{e.preventDefault();toggleBefore(true)});
      ['pointerup','pointercancel','pointerleave'].forEach(type=>compare.addEventListener(type,()=>toggleBefore(false)));
      compare.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();toggleBefore(true)}});
      compare.addEventListener('keyup',()=>toggleBefore(false));
      $('#labBrushSize').addEventListener('input',()=>{$('#labBrushSizeValue').textContent=$('#labBrushSize').value+'px'});
      $('#labBrushSoft').addEventListener('input',()=>{$('#labBrushSoftValue').textContent=$('#labBrushSoft').value+'%'});
      document.querySelectorAll('#labBrushModes [data-brush]').forEach(b=>b.onclick=()=>{
        const next=b.dataset.brush;
        if(next!=='full'&&!maskTouched){fillMask(next==='erase')}
        brushMode=next;
        document.querySelectorAll('#labBrushModes [data-brush]').forEach(el=>el.classList.toggle('on',el===b));
        $('#labMaskStatus').textContent=next==='full'?'full frame':next==='paint'?'brush / add':'brush / lift';
        cv.classList.toggle('paintable',next!=='full');go();
      });
      $('#labMaskUndo').onclick=()=>{const im=maskHistory.pop();if(!im)return st('no brush mark to undo');maskCtx.putImageData(im,0,0);maskDirty=true;go();st('brush undo')};
      $('#labMaskClear').onclick=()=>{maskTouched=false;maskHistory.length=0;fillMask(brushMode==='erase'||brushMode==='full');st('brush mask cleared');};
      $('#labFit').onclick=()=>{applyImagePreset(imagePreset==='fit'?'fill':'fit');};
      async function saveLabPrint(){
        if(!gl)return st('GPU is unavailable');
        const button=$('#labSave');button.disabled=true;button.textContent='developing print…';
        const oldW=cv.width,oldH=cv.height;
        try{
          await settleRasterBeforeExport();
          const pixels=Math.min(Number($('#labQuality').value), mobileDevice?6:16)*1e6;
          const scale=Math.max(1,Math.sqrt(pixels/(W*H)));
          const maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE)||4096;
          const maxBuffer=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)||4096;
          const hard=Math.min(mobileDevice?3072:4096,maxTex,maxBuffer),safeScale=Math.min(scale,hard/Math.max(W,H));
          const ew=Math.max(1,Math.round(W*safeScale)),eh=Math.max(1,Math.round(H*safeScale));
          cv.width=ew;cv.height=eh;uploadBg();dirty=true;draw();
          const pixelsOut=new Uint8Array(ew*eh*4);
          gl.readPixels(0,0,ew,eh,gl.RGBA,gl.UNSIGNED_BYTE,pixelsOut);
          const imageCanvas=document.createElement('canvas');imageCanvas.width=ew;imageCanvas.height=eh;
          const g=imageCanvas.getContext('2d'),data=g.createImageData(ew,eh);
          const row=ew*4;
          for(let y=0;y<eh;y++)data.data.set(pixelsOut.subarray((eh-1-y)*row,(eh-y)*row),y*row);
          g.putImageData(data,0,0);
          imageCanvas.toBlob(blob=>{
            if(!blob){st('PNG export failed');return;}
            const url=URL.createObjectURL(blob),download=$('#svd');
            $('#svi').src=url;download.href=url;download.download=`index00-darkroom-${ew}x${eh}.png`;
            $('#svSize').textContent=`${ew.toLocaleString()} × ${eh.toLocaleString()} PX`;
            $('#svType').textContent='PNG / ORIGINAL ASPECT RATIO';
            $('#sv').hidden=false;st(`print developed · ${ew} × ${eh}`);
          },'image/png');
        }catch(err){console.error(err);st('export failed — select a smaller size')}
        finally{cv.width=oldW;cv.height=oldH;uploadBg();button.disabled=false;button.textContent='save print ↗';go()}
      }
      $('#labSave').onclick=saveLabPrint;
      const labNotes=[
        'Fogged silver-gelatin negative · icy density reversal, developer haze and silver dust',
        'Wet-plate collodion · hand-coated silver density, smoky highlights and dark edges',
        'Dye bleed · fluid pigment migration, watercolor pigment pooling and tide lines',
        'Cyanotype · Prussian-blue shadows, cyan highlights and reactive iron-sensitive paper',
        'Cross-processing · amber highlight layer, magenta midtones and cool shadows',
        'Reticulated gelatin · branching membrane fractures and exposed silver emulsion',
        'Film burn · incandescent red leak, chromatic fringing, halation and scratches',
        'Sabattier reversal · partial tonal inversion, hard thresholds and pale contours',
        'Faded archive · aged baryta stock, yellowing paper and oxidized margins',
        'Chromatic ghost · red/cyan channel misregistration and blue developer fog',
        'Bleached positive · blown paper whites, dark remnants and chemical freckles',
        'Smoke print · soot density and violet chemical blooms',
        'Chemigram · solvent-resist islands, tarnish, reaction rims and suspended pigment',
        'Lumen print · sun-reactive lilac oxidation and warm silver deposits',
        'Paper dissolve · water-swollen fibre, washed image layers and dissolving boundaries',
        'Ghost exposure · displaced exposure, translucent double-image and cool bloom',
        'Silver print · rich shadow density, granular midtones and luminous gelatin surface',
        'Photogram · contact-print silhouettes, milky exposure and edge glows',
        'Oil canvas · woven ground, image-adaptive brush diffusion, blue-grey toning and tactile paint build-up'
      ];
      const fxButtons=[...document.querySelectorAll('#fxPresets [data-fx]')];
      const effectSelect=$('#labEffectSelect'), effectGrid=$('#fxPresets'), browse=$('#labBrowseFx');
      const fxOrder=fxButtons.map(el=>Number(el.dataset.fx));
      const setFxMode=index=>{
        if(!Number.isInteger(index))return;
        const hit=fxButtons.find(el=>+el.dataset.fx===index);
        if(!hit)return;
        fxMode=index;
        const ordinal=Math.max(0, fxOrder.indexOf(index));
        fxButtons.forEach(el=>{
          const chosen=el===hit;
          el.classList.toggle('on',chosen);
          el.setAttribute('aria-pressed',String(chosen));
        });
        effectSelect.value=String(fxMode);
        $('#labProcessNum').textContent=String(ordinal+1).padStart(2,'0')+' / '+fxButtons.length;
        $('#labNote').textContent=labNotes[fxMode]+'. Each treatment is shader-generated and editable.';
        if(!effectGrid.hidden){
          const top=hit.offsetTop - effectGrid.clientHeight/2 + hit.offsetHeight/2;
          effectGrid.scrollTop=Math.max(0,top);
        }
        dirty=true;
        st('darkroom · '+hit.querySelector('b').textContent.split('/ ')[1]);
        go();
      };
      fxButtons.forEach(b=>{
        b.type='button';
        b.addEventListener('click',e=>{e.stopPropagation();setFxMode(Number(b.dataset.fx));});
      });
      effectSelect.addEventListener('change',e=>setFxMode(Number(e.target.value)));
      $('#labPrevFx').addEventListener('click',()=>{ const i=fxOrder.indexOf(fxMode); setFxMode(fxOrder[(i+fxOrder.length-1)%fxOrder.length]); });
      $('#labNextFx').addEventListener('click',()=>{ const i=fxOrder.indexOf(fxMode); setFxMode(fxOrder[(i+1)%fxOrder.length]); });
      browse.addEventListener('click',()=>{
        effectGrid.hidden=!effectGrid.hidden;
        const expanded=!effectGrid.hidden;
        browse.setAttribute('aria-expanded',String(expanded));
        browse.innerHTML=expanded?'Hide preset gallery <span aria-hidden="true">▴</span>':'Browse all 4 presets <span aria-hidden="true">▾</span>';
        if(expanded)setFxMode(fxMode);
      });
      addEventListener('resize', () => { if(!labMode && !studioSidebarWanted && !$('#extra').hidden) setStudioSidebar(false); });
      document.addEventListener('pointerdown', e => {
        if (!sidebarWide() && !e.target.closest('#extra') && !e.target.closest('#more') && !$('#extra').hidden) {
          $('#extra').hidden = true; $('#more').setAttribute('aria-expanded', 'false');
        }
      });
      $('#extra').addEventListener('click', e => { if (e.target.closest('button[data-close]')) { $('#extra').hidden = true; $('#more').setAttribute('aria-expanded', 'false') } });
      group('#tools', 't', v => { tool = v; hint.textContent = toolHints[v] || ''; showHint(); st(({ cord: 'gathering thread', toile: 'closing the net', esprit: 'making picots', veil: 'laying a veil', bloom: 'developing bloom', snag: 'pulling a snag', stitch: 'embroidery / ' + $('#stitchStyle').selectedOptions[0].text, unpick: 'unpicking' })[v] || 'ready') });
      const repeatLabels={doily:'Doily 6',radial8:'Radial rosette / 8',radial12:'Radial rosette / 12',rose5:'Rose curve / 5 petals',rose8:'Rose curve / 8 petals',mandala:'Mandala / 24-fold',spiral:'Spiral bloom / 10'};
      group('#modes', 'm', v => { mode = v; $('#repeatPattern').value=''; hint.textContent = `${repeatLabels[v]||v} - repeat the gesture around the center`; showHint(); go() });
      $('#repeatPattern').addEventListener('change',e=>{const v=e.target.value;if(!v)return;mode=v;document.querySelectorAll('#modes button').forEach(b=>b.classList.remove('on'));hint.textContent=`${repeatLabels[v]} - radial mathematical repeat`;showHint();st('repeat - '+repeatLabels[v]);go()});
      function updateLighting() {
        lightX=+$('#lightX').value/100; lightY=+$('#lightY').value/100;
        lightPower=+$('#lightPower').value/100; lightSoft=+$('#lightSoft').value/100; shadowStrength=+$('#shadowStrength').value/100;
        light={x:W*lightX*D,y:H*(1-lightY)*D};
        $('#lightXValue').textContent=$('#lightX').value+'%'; $('#lightYValue').textContent=$('#lightY').value+'%';
        $('#lightPowerValue').textContent=$('#lightPower').value+'%'; $('#lightSoftValue').textContent=$('#lightSoft').value+'%';
        $('#shadowStrengthValue').textContent=$('#shadowStrength').value+'%'; go();
      }
      ['lightX','lightY','lightPower','lightSoft','shadowStrength'].forEach(id=>$('#'+id).addEventListener('input',updateLighting));
      $('#lightPreset').addEventListener('change',e=>{lightPreset=+e.target.value;go();st('light source · '+e.target.selectedOptions[0].text)});
      document.querySelectorAll('#textures [data-x]').forEach(b=>b.onclick=()=>{
        document.querySelectorAll('#textures [data-x]').forEach(o=>o.classList.toggle('on',o===b));textureMode=+b.dataset.x;go();
      });
      function setCloth(id){
        clothSurface=fabrics[id]?Number(id):0;$('#clothSurface').value=String(clothSurface);
        $('#fabricDescription').textContent=fabrics[clothSurface].description;
        document.querySelectorAll('[data-fabric]').forEach(b=>b.classList.toggle('on',+b.dataset.fabric===clothSurface));go();
      }
      document.querySelectorAll('[data-fabric]').forEach(b=>b.onclick=()=>setCloth(+b.dataset.fabric));
      $('#clothSurface').addEventListener('change',e=>setCloth(+e.target.value));setCloth(clothSurface);
      $('#clothSettings').onclick=()=>{
        setStudioSidebar(true);const group=$('#clothGroup');group.open=true;
        group.scrollIntoView({behavior:'smooth',block:'start'});group.querySelector('summary').focus({preventScroll:true});
      };
      function setMeshVisible(visible){
        meshVisible=visible;$('#meshVisibility').textContent=visible?'remove mesh':'restore mesh';
        $('#meshVisibility').setAttribute('aria-pressed',String(!visible));markAll();go();
      }
      $('#meshVisibility').onclick=()=>setMeshVisible(!meshVisible);
      function updateClothControls(){
        clothTension=+$('#clothTension').value/100;clothTear=+$('#clothTear').value/100;
        wrinkleAmount=+$('#wrinkleAmount').value/100;wrinkleScale=+$('#wrinkleScale').value/100;wrinkleAngle=+$('#wrinkleAngle').value;
        wrinkleStyle=+$('#wrinkleStyle').value;weaveScale=+$('#weaveScale').value/100;blendOpacity=+$('#blendOpacity').value/100;
        for(const id of ['clothTension','clothTear','wrinkleAmount','wrinkleScale','wrinkleAngle','weaveScale','blendOpacity'])$('#'+id+'Value').textContent=$('#'+id).value+(id==='wrinkleAngle'?'°':'%');
        go();
      }
      for(const id of ['clothTension','clothTear','wrinkleAmount','wrinkleScale','wrinkleAngle','weaveScale','blendOpacity'])$('#'+id).addEventListener('input',updateClothControls);
      $('#wrinkleStyle').addEventListener('change',updateClothControls);
      $('#flattenCloth').onclick=()=>{$('#wrinkleAmount').value='0';$('#wrinkleAmount').dispatchEvent(new Event('input',{bubbles:true}));};
      document.querySelectorAll('[data-mesh]').forEach(b => b.onclick = () => {
        const saved=preserveMeshSnapshot();
        document.querySelectorAll('[data-mesh]').forEach(o => o.classList.toggle('on', o === b));
        meshMode=b.dataset.mesh;build();restoreResizedMesh(saved);setMeshVisible(true);st('mesh · '+b.textContent);
      });
      $('#stitchStyle').addEventListener('change', e => { stitchStyle = +e.target.value; if (tool === 'stitch') st('embroidery / ' + e.target.selectedOptions[0].text) });
      document.querySelectorAll('#textures [data-p]').forEach((b, i) => b.onclick = () => { document.querySelectorAll('#textures [data-p]').forEach(o => o.classList.toggle('on', o === b)); paletteMode = i; document.documentElement.dataset.palette = b.dataset.p; go() });
      $('#undo').onclick = () => { const s = stack.pop(); if (!s) return st('nothing to undo'); vx.set(s.vx); vy.set(s.vy); vc.set(s.vc); picots = s.pk; stains = s.stains || []; snags = s.snags || []; stitches = s.stitches || []; recalcMax(); indexMeshGeometry(); reindexBrushGrid(); markAll(); go(); st('ready') };
      $('#clear').onclick = () => { stack.push({ vx: vx.slice(), vy: vy.slice(), vc: vc.slice(), pk: picots.slice(), stains: stains.slice(), snags: snags.slice(), stitches: stitches.slice() }); vx.set(vx0); vy.set(vy0); vc.fill(0); picots = []; stains = []; snags = []; stitches = []; maxD = 0; indexMeshGeometry(); reindexBrushGrid(); markAll(); go(); st('all unpicked') };
      const sc = [[1, 44], [2, 70], [3, 100]]; let si = 0; const scaleBtn = $('#scale'); if(scaleBtn) scaleBtn.onclick = e => { si = (si + 1) % 3; R = sc[si][1]; e.target.textContent = sc[si][0] + '×'; go() };
      $('#snd').onclick = e => { snd = !snd; e.target.classList.toggle('on', snd); if (snd) tick() };
      function useFrame() { framed = true; pd = 1 }
      $('#pic').onclick = () => { useFrame(); openImagePicker($('#file')) };
      let mediaLoadVersion=0;
      $('#file').onchange = e => {
        const f=e.target.files[0];if(!f)return;stopCam();
        const version=mediaLoadVersion,im=new Image(),url=URL.createObjectURL(f);
        im.onload=()=>{URL.revokeObjectURL(url);if(version!==mediaLoadVersion)return;media=im;pd=1;go();st('photo set');};
        im.onerror=()=>URL.revokeObjectURL(url);im.src=url;
      };
      function stopCam() { mediaLoadVersion++;if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null } }
      $('#cam').onclick = async () => {
        useFrame();stopCam();const version=mediaLoadVersion;
        try {
          const captured=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});
          if(version!==mediaLoadVersion){captured.getTracks().forEach(t=>t.stop());return;}
          stream=captured;const v=document.createElement('video');v.srcObject=captured;v.muted=true;v.playsInline=true;await v.play();
          if(version!==mediaLoadVersion){captured.getTracks().forEach(t=>t.stop());return;}
          media=v;go();st('camera on');
        } catch (_) {if(version===mediaLoadVersion)st('camera unavailable');}
      };
      function currentExportMetrics(){
        const choice = Number($('#exportResolution').value);
        let ew = cv.width || 1, eh = cv.height || 1;
        if(choice > 0){
          let limit = mobileDevice ? 3072 : 4096;
          if(gl){
            try { limit=Math.min(limit, gl.getParameter(gl.MAX_TEXTURE_SIZE)||4096, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)||4096); } catch(e){}
          }
          const scale=Math.min(Math.sqrt(Math.min(choice,mobileDevice?6:16)*1e6/Math.max(1,W*H)), limit/Math.max(1,W,H));
          ew=Math.max(1,Math.round(W*scale));eh=Math.max(1,Math.round(H*scale));
        }
        return {width:ew,height:eh};
      }
      function updateExportInterface(){
        const mime=$('#exportFormat').value,mp=$('#exportResolution').value;
        document.querySelectorAll('[data-mime]').forEach(b=>b.classList.toggle('on',b.dataset.mime===mime));
        document.querySelectorAll('[data-mp]').forEach(b=>b.classList.toggle('on',b.dataset.mp===mp));
        const dims=currentExportMetrics();
        $('#exportSpecDims').textContent=`${dims.width.toLocaleString()} × ${dims.height.toLocaleString()} PX`;
        $('#exportSpecFormat').textContent=(mime==='image/jpeg'?'JPEG':'PNG')+' / SRGB';
        $('#exportSpecRatio').textContent='LANDSCAPE / 16:9';
        $('#exportSizeScreen').textContent=`${cv.width} × ${cv.height}`;
        $('#exportPreviewAspect').textContent='ARTBOARD / 16:9';
      }
      function refreshExportPreview(){
        const preview=$('#exportPreviewCanvas'),empty=$('#exportEmptyPreview');
        if(!preview || !W || !H) return;
        const f=Math.min(1,1000/Math.max(W,H));
        preview.width=Math.max(1,Math.round(W*f));preview.height=Math.max(1,Math.round(H*f));
        const ctx=preview.getContext('2d');
        try{
          // Snapshot during a same-frame WebGL draw; no destructive canvas resize.
          only=!exportTarget.withBg;dirty=true;draw();
          ctx.drawImage(cv,0,0,preview.width,preview.height);
          if(exportTarget.withBg&&!labMode)ctx.drawImage(fl,0,0,preview.width,preview.height);
          only=false;dirty=true;go();empty.hidden=true;
        }catch(err){console.warn('Export preview unavailable',err);empty.hidden=false;}
      }
      document.querySelectorAll('[data-mime]').forEach(b=>b.addEventListener('click',()=>{$('#exportFormat').value=b.dataset.mime;updateExportInterface()}));
      document.querySelectorAll('[data-mp]').forEach(b=>b.addEventListener('click',()=>{$('#exportResolution').value=b.dataset.mp;updateExportInterface()}));
      $('#exportGrain').oninput=()=>{$('#exportGrainValue').textContent=$('#exportGrain').value+'%'};
      $('#exportFormat').onchange=updateExportInterface;
      $('#exportResolution').onchange=updateExportInterface;
      function addExportGrain(context,w,h,amount){
        if(!amount)return;
        const tile=document.createElement('canvas');tile.width=128;tile.height=128;
        const tc=tile.getContext('2d'),pixels=tc.createImageData(128,128);
        for(let i=0;i<pixels.data.length;i+=4){
          const v=Math.floor(Math.random()*256);
          pixels.data[i]=v;pixels.data[i+1]=v;pixels.data[i+2]=v;pixels.data[i+3]=205;
        }
        tc.putImageData(pixels,0,0);
        context.save();context.globalAlpha=.11*amount/100;
        context.globalCompositeOperation='overlay';
        context.fillStyle=context.createPattern(tile,'repeat');context.fillRect(0,0,w,h);
        context.restore();
      }
      let exportTarget = { withBg: true, name: 'lace-card' };
      function openExportOptions(withBg, name) {
        exportTarget = { withBg, name };
        $('#exportOptions').hidden = false;
        updateExportInterface();refreshExportPreview();
        $('#exportStart').focus();
      }
      async function exportArtwork() {
        const button = $('#exportStart'), oldW = cv.width, oldH = cv.height, oldOnly = only;
        button.disabled = true;
        button.textContent = 'rendering…';
        $('#exportOptions').hidden = true;
        try {
          await settleRasterBeforeExport();
          const requestedMP = Math.min(Number($('#exportResolution').value), mobileDevice ? 6 : 16);
          let ew = oldW, eh = oldH;
          if (requestedMP > 0) {
            const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
            const maxBuffer = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096;
            const maxEdge = Math.min(mobileDevice?3072:4096, maxTexture, maxBuffer);
            const scale = Math.min(Math.sqrt(requestedMP * 1e6 / (W * H)), maxEdge / Math.max(W, H));
            ew = Math.max(1, Math.round(W * scale));
            eh = Math.max(1, Math.round(H * scale));
          }
          cv.width = ew;
          cv.height = eh;
          only = !exportTarget.withBg;
          dirty = true;
          draw();
          const imageCanvas = document.createElement('canvas');
          imageCanvas.width = ew;
          imageCanvas.height = eh;
          const context = imageCanvas.getContext('2d');
          const mime = $('#exportFormat').value;
          if (mime === 'image/jpeg' && !exportTarget.withBg) {
            context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#09090c';
            context.fillRect(0, 0, ew, eh);
          }
          context.drawImage(cv, 0, 0);
          if (exportTarget.withBg && !labMode) context.drawImage(fl, 0, 0, ew, eh);
          addExportGrain(context, ew, eh, Number($('#exportGrain').value));
          const blob = await new Promise(resolve => imageCanvas.toBlob(resolve, mime, mime === 'image/jpeg' ? .95 : undefined));
          if (!blob) throw new Error('Image encoding failed');
          const extension = mime === 'image/jpeg' ? 'jpg' : 'png';
          const url = URL.createObjectURL(blob), download = $('#svd');
          $('#svi').src = url;
          download.href = url;
          download.download = `${exportTarget.name}-${ew}x${eh}.${extension}`;
          $('#svSize').textContent=`${ew.toLocaleString()} × ${eh.toLocaleString()} PX`;
          $('#svType').textContent=`${extension.toUpperCase()} / ORIGINAL ASPECT RATIO`;
          $('#sv').hidden = false;
          st(`saved · ${ew} × ${eh} · ${extension.toUpperCase()}`);
        } catch (error) {
          console.error(error);
          st('save failed — try a smaller size');
        } finally {
          cv.width = oldW;
          cv.height = oldH;
          only = oldOnly;
          pd = 1;
          dr = { full: 1 };
          go();
          button.disabled = false;
          button.textContent = 'export image';
        }
      }
      $('#mobileSave').onclick=()=>$('#save').click();
      $('#saveLace').onclick = () => openExportOptions(false, 'lace');
      $('#save').onclick = () => labMode ? saveLabPrint() : openExportOptions(true, 'lace-card');
      $('#exportStart').onclick = exportArtwork;
      $('#exportCancel').onclick = () => { $('#exportOptions').hidden = true };
      $('#exportOptions').onclick = e => { if (e.target === $('#exportOptions')) $('#exportOptions').hidden = true };

      const closeSv = () => { $('#sv').hidden = true }; $('#svx').onclick = closeSv; $('#sv').onclick = e => { if (e.target.id === 'sv') closeSv() }; addEventListener('keydown', e => { if (e.key === 'Escape') { closeSv(); $('#exportOptions').hidden = true } });
      // imported image: becomes the surface the lace is worked on
      let bgImg = null, bm = 0, currentImageBlob = null; const ic = document.createElement('canvas');
      const BL=blendModes.map(([,name])=>name);
      $('#blendMode').innerHTML=blendModes.map(([id,name],index)=>'<option value="'+index+'">'+name+'</option>').join('');
      function setBlend(i){
        bm=Number.isInteger(i)&&i>=0&&i<BL.length?i:0;$('#bl').textContent='blend: '+BL[bm];$('#blendMode').value=String(bm);st('blend · '+BL[bm]);go();
      }
      $('#blendMode').addEventListener('change',e=>setBlend(+e.target.value));
      // Image texture uploaded only on import. Fit/crop/rotate/drag happen inside the fragment shader.
      // The edit box is a DOM overlay and is not included in exported frames.
      function uploadBg() {
        if (!gl || !bgImg || imageTextureSource===bgImg) return;
        const maxTex=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE)||4096,mobileDevice?3072:8192);
        const iw=bgImg.naturalWidth,ih=bgImg.naturalHeight;
        let source=bgImg;
        if(Math.max(iw,ih)>maxTex){
          const ratio=maxTex/Math.max(iw,ih);
          const thumb=document.createElement('canvas');thumb.width=Math.max(1,Math.floor(iw*ratio));thumb.height=Math.max(1,Math.floor(ih*ratio));
          thumb.getContext('2d').drawImage(bgImg,0,0,thumb.width,thumb.height);source=thumb;
        }
        gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,tx[3]);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
        imageTextureSource=bgImg;
      }
      let imageLoadVersion=0;
      function loadBg(f) {
        const version=++imageLoadVersion;
        currentImageBlob = f;
        return new Promise(resolve => {
        const im=new Image(); const url=URL.createObjectURL(f);
        im.onload=()=>{
          if(version!==imageLoadVersion){URL.revokeObjectURL(url);resolve(false);return;}
          URL.revokeObjectURL(url); bgImg=im; imageTextureSource=null;
          applyImagePreset('fit',false); uploadBg();
          $('#rmbg').hidden=false;
          $('#imageTransformBtn').hidden=false;
          syncTransformUI(); st(labMode?'darkroom · photograph loaded':'photograph loaded · use transform image to position');go();resolve(true);
        };
        im.onerror=()=>{URL.revokeObjectURL(url);if(version===imageLoadVersion){currentImageBlob=null;st('could not read that image');}resolve(false);};
        im.src=url;
        });
      }
      // Image / transform UI. Stage coordinates are CSS pixels; sampler uniforms scale to export resolution.
      const tfOverlay=$('#transformOverlay'),tfBox=$('#transformBox'),tfPanel=$('#transformPanel');
      const setTFCompact=compact=>{
        tfPanel.classList.toggle('tf-compact',compact);
        $('#tfExpand').textContent=compact?'advanced ▴':'less controls ▾';
        $('#tfExpand').setAttribute('aria-expanded',String(!compact));
      };
      $('#tfExpand').onclick=()=>setTFCompact(!tfPanel.classList.contains('tf-compact'));
      setTFCompact(mobileDevice);
      function fitScale(){return bgImg?Math.min(W/bgImg.naturalWidth,H/bgImg.naturalHeight):1;}
      function fillScale(){return bgImg?Math.max(W/bgImg.naturalWidth,H/bgImg.naturalHeight):1;}
      function normalizeAngle(angle){return ((angle+180)%360+360)%360-180;}
      function applyImagePreset(preset='fit',notify=true){
        if(!bgImg)return;
        imagePreset=preset;
        imageTransform.x=W/2; imageTransform.y=H/2;
        imageTransform.angle=0;imageTransform.flipX=false;imageTransform.flipY=false;
        imageTransform.scale=preset==='fill'?fillScale():preset==='actual'?1:fitScale();
        syncTransformUI();go();if(notify)st(`image · ${preset==='actual'?'100% pixels':preset}`);
      }
      function setTransformActive(next){
        transformActive=!!next&&!!bgImg;
        document.body.classList.toggle('transform-mode',transformActive);
        if(transformActive&&mobileDevice)setTFCompact(true);
        $('#imageTransformBtn').classList.toggle('on',transformActive);
        $('#imageTransformBtn').setAttribute('aria-pressed',String(transformActive));
        tfOverlay.hidden=!transformActive; tfPanel.hidden=!transformActive;
        if(transformActive){mouse=null;hv=0;drawing=false;maskDrawing=false;}
        // The editorial work area makes room for the transform sidebar. Preserve and resize
        // the edited mesh rather than stretching the underlying WebGL drawing buffer.
        requestAnimationFrame(size);
        syncTransformUI();go();
      }
      function syncTransformUI(){
        if(!tfBox||!bgImg)return;
        const r=cv.getBoundingClientRect();
        const ww=bgImg.naturalWidth*imageTransform.scale,hh=bgImg.naturalHeight*imageTransform.scale;
        tfBox.style.left=`${r.left+imageTransform.x}px`;
        tfBox.style.top=`${r.top+imageTransform.y}px`;
        tfBox.style.width=`${ww}px`; tfBox.style.height=`${hh}px`;
        tfBox.style.transform=`translate(-50%,-50%) rotate(${imageTransform.angle}deg)`;
        $('#tfScaleValue').textContent=`${Math.round(imageTransform.scale/Math.max(fitScale(),.00001)*100)}%`;
        $('#tfScale').value=Math.max(5,Math.min(600,Math.round(imageTransform.scale/Math.max(fitScale(),.00001)*100)));
        $('#tfAngle').value=normalizeAngle(imageTransform.angle);
        $('#tfAngleValue').textContent=`${Math.round(normalizeAngle(imageTransform.angle))}°`;
        $('#tfPosX').value=(imageTransform.x/Math.max(1,W)*100).toFixed(1);
        $('#tfPosY').value=(imageTransform.y/Math.max(1,H)*100).toFixed(1);
        $('#labFit').textContent='image: '+(imagePreset==='fill'?'cover':imagePreset==='fit'?'contain':'free');
        for(const [id,on] of [['tfFit',imagePreset==='fit'],['tfFill',imagePreset==='fill'],['tfActual',imagePreset==='actual'],['tfFlipX',imageTransform.flipX],['tfFlipY',imageTransform.flipY]])$('#'+id).classList.toggle('on',on);
      }
      function changeTransform(next){
        Object.assign(imageTransform,next);imageTransform.scale=Math.max(.00001,Math.min(50,imageTransform.scale));
        imagePreset='free';syncTransformUI();go();
      }
      $('#imageTransformBtn').onclick=()=>setTransformActive(!transformActive);
      $('#tfClose').onclick=$('#tfDone').onclick=()=>setTransformActive(false);
      $('#tfFit').onclick=()=>applyImagePreset('fit');
      $('#tfFill').onclick=()=>applyImagePreset('fill');
      $('#tfActual').onclick=()=>applyImagePreset('actual');
      $('#tfReset').onclick=()=>applyImagePreset('fit');
      $('#tfCenter').onclick=()=>changeTransform({x:W/2,y:H/2});
      $('#tfFlipX').onclick=()=>changeTransform({flipX:!imageTransform.flipX});
      $('#tfFlipY').onclick=()=>changeTransform({flipY:!imageTransform.flipY});
      $('#tfRotateLeft').onclick=()=>changeTransform({angle:normalizeAngle(imageTransform.angle-90)});
      $('#tfRotateRight').onclick=()=>changeTransform({angle:normalizeAngle(imageTransform.angle+90)});
      $('#tfScale').oninput=e=>changeTransform({scale:fitScale()*Number(e.target.value)/100});
      $('#tfAngle').oninput=e=>changeTransform({angle:Number(e.target.value)});
      $('#tfPosX').oninput=e=>{const v=Number(e.target.value);if(Number.isFinite(v))changeTransform({x:W*v/100});};
      $('#tfPosY').oninput=e=>{const v=Number(e.target.value);if(Number.isFinite(v))changeTransform({y:H*v/100});};
      // Pointer capture on the image bounding box: moving, uniform corner scaling, rotation.
      const tfPointers=new Map();let tfGesture=null;
      function getPos(e){const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
      function captureGesture(){
        const pts=Array.from(tfPointers.values());
        if(pts.length===2){
          const a=pts[0].p,b=pts[1].p;
          tfGesture={kind:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),
            angle:Math.atan2(b.y-a.y,b.x-a.x), midpoint:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},initial:{...imageTransform}};
        }
      }
      tfBox.addEventListener('pointerdown',e=>{
        if(!transformActive)return;e.preventDefault();e.stopPropagation();
        tfBox.setPointerCapture(e.pointerId);
        const p=getPos(e);tfPointers.set(e.pointerId,{p});
        if(tfPointers.size===2){captureGesture();return;}
        const corner=e.target.closest('[data-corner]')?.dataset.corner;
        const kind=corner==='rotate'?'rotate':corner?'scale':'move';
        const start={...imageTransform};
        const dis=Math.max(1,Math.hypot(p.x-start.x,p.y-start.y));
        const angle=Math.atan2(p.y-start.y,p.x-start.x);
        tfGesture={kind,initial:start,origin:p,distance:dis,angle};
      });
      tfBox.addEventListener('pointermove',e=>{
        if(!tfPointers.has(e.pointerId))return;
        e.preventDefault();e.stopPropagation();
        tfPointers.set(e.pointerId,{p:getPos(e)});
        if(!tfGesture)return;
        if(tfGesture.kind==='pinch'&&tfPointers.size>=2){
          const [a,b]=Array.from(tfPointers.values()).slice(0,2).map(v=>v.p);
          const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
          const dist=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));
          const angle=Math.atan2(b.y-a.y,b.x-a.x);
          changeTransform({scale:tfGesture.initial.scale*dist/tfGesture.distance,
            angle:normalizeAngle(tfGesture.initial.angle+(angle-tfGesture.angle)*180/Math.PI),
            x:tfGesture.initial.x+(mid.x-tfGesture.midpoint.x),
            y:tfGesture.initial.y+(mid.y-tfGesture.midpoint.y)});return;
        }
        const p=getPos(e),s=tfGesture.initial;
        if(tfGesture.kind==='move')changeTransform({x:s.x+p.x-tfGesture.origin.x,y:s.y+p.y-tfGesture.origin.y});
        else if(tfGesture.kind==='scale'){
          const d=Math.max(1,Math.hypot(p.x-s.x,p.y-s.y));
          changeTransform({scale:s.scale*d/tfGesture.distance});
        }else if(tfGesture.kind==='rotate'){
          const a=Math.atan2(p.y-s.y,p.x-s.x);
          changeTransform({angle:normalizeAngle(s.angle+(a-tfGesture.angle)*180/Math.PI)});
        }
      });
      const endTFPointer=e=>{tfPointers.delete(e.pointerId);if(tfPointers.size<2)tfGesture=null;};
      tfBox.addEventListener('pointerup',endTFPointer);tfBox.addEventListener('pointercancel',endTFPointer);
      tfBox.addEventListener('lostpointercapture',endTFPointer);
      cv.addEventListener('wheel',e=>{
        if(!transformActive||!bgImg)return;
        e.preventDefault();changeTransform({scale:imageTransform.scale*Math.exp(-e.deltaY*.0013)});
      },{passive:false});
      document.addEventListener('keydown',e=>{
        if(!transformActive||!bgImg||e.target.matches('input,select,textarea')||e.ctrlKey||e.metaKey)return;
        const step=e.shiftKey?10:1;let nx=0,ny=0;
        if(e.key==='ArrowLeft')nx=-step;if(e.key==='ArrowRight')nx=step;
        if(e.key==='ArrowUp')ny=-step;if(e.key==='ArrowDown')ny=step;
        if(nx||ny){e.preventDefault();changeTransform({x:imageTransform.x+nx,y:imageTransform.y+ny});}
        if(e.key==='Escape')setTransformActive(false);
      });
      $('#phoneCamera').onclick = () => { $('#extra').hidden=true; openImagePicker($('#camera_f')); };
      $('#camera_f').onchange = e => { const f=e.target.files[0]; if(f)loadBg(f); e.target.value=''; };
      $('#imp').onclick = () => openImagePicker($('#imp_f'));
      $('#imp_f').onchange = e => { const f = e.target.files[0]; if (f) loadBg(f); e.target.value = '' };
      $('#bl').onclick=()=>{setStudioSidebar(true);$('#blendMode').focus();};
      $('#rmbg').onclick = () => { currentImageBlob=null; bgImg = null; imageTextureSource=null; setTransformActive(false); $('#imageTransformBtn').hidden=true;  $('#rmbg').hidden = true;  go() };
      addEventListener('dragover', e => e.preventDefault());
      addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) loadBg(f) });
      // Sparse drifting silver grain replaces the decorative petals, echoing the
      // photographed mesh and chemical specks in the reference images.
      const fl = $('#fl'), fx = fl.getContext('2d'), still = matchMedia('(prefers-reduced-motion: reduce)').matches; let FL = [], lastT = 0, flNeedsDraw = true;
      function initFl() {
        fl.width = W * D; fl.height = H * D; const n = Math.max(45, Math.min(115, Math.round(W * H / 14000))); FL = []; flNeedsDraw = true;
        for (let i = 0; i < n; i++) FL.push({ x: Math.random() * W, y: Math.random() * H, z: .25 + Math.random() * .75, a: .025 + Math.random() * .1, vx: (Math.random() - .5) * 2.4, vy: (Math.random() - .5) * 1.6, s: .35 + Math.random() * 1.1 });
      }
      function fly(t) {
        if (document.hidden) { lastT = t; return; }
        if (still && !flNeedsDraw) return;
        const dt = still ? 0 : Math.min(.05, (t - lastT) / 1000 || 0); lastT = t; flNeedsDraw = false;
        fx.setTransform(D, 0, 0, D, 0, 0); fx.clearRect(0, 0, W, H);
        for (const f of FL) { f.x += f.vx * dt; f.y += f.vy * dt; if (f.x < 0) f.x = W; if (f.x > W) f.x = 0; if (f.y < 0) f.y = H; if (f.y > H) f.y = 0; fx.fillStyle = `rgba(222,220,226,${f.a})`; fx.fillRect(f.x, f.y, f.s, f.s * (1.5 - f.z * .5)); }
      }
      document.addEventListener('visibilitychange', () => { lastT = 0; if (!document.hidden) flNeedsDraw = true; });
      let lastParticleFrame=0; (function fl_loop(t) { if(t-lastParticleFrame >= (mobileDevice ? 50 : 34)){lastParticleFrame=t;fly(t);} requestAnimationFrame(fl_loop) })(0);
      // Real initialisation state: never fabricate timer-driven progress.
      // size() completes WebGL canvas geometry setup before we reveal the editor.
      const loadingScreen = $('#ld');
      const loadingNumber = $('#ldn');
      if (loadingNumber) loadingNumber.textContent = '00%';
      size();
      requestAnimationFrame(() => {
        if (loadingNumber) loadingNumber.textContent = '100%';
        requestAnimationFrame(() => loadingScreen?.classList.add('off'));
      });

// Public project bridge for the React/Zustand/Dexie application layer.
// The existing GPU engine remains independent of React's render cycle.
const checkpoint = () => ({
  version: 1, savedAt: Date.now(), width: W, height: H,
  meshMode, palette: document.documentElement.dataset.palette || 'ghost',
  textureMode, tool, repeatMode: mode, stitchStyle,
  canvasAspect, meshVisible, clothSurface, clothTension, verticalFormat, uiTheme, labMode, fxMode, fxSeed, brushMode,
  framed, blendMode: bm, blendModeId:blendModes[bm][0], imagePreset, imageTransform: {...imageTransform},
  image: currentImageBlob,
  mesh: {
    originalX: Array.from(vx0 || []), originalY: Array.from(vy0 || []),
    vx: Array.from(vx || []), vy: Array.from(vy || []), vc: Array.from(vc || []),
    picots: structuredClone(picots), stains: structuredClone(stains),
    snags: structuredClone(snags), stitches: structuredClone(stitches)
  },
  mask: maskTouched ? maskCanvas.toDataURL('image/png') : null,
  settings: Object.fromEntries([
    'clothTension','clothTear','wrinkleAmount','wrinkleScale','wrinkleAngle','wrinkleStyle','weaveScale','blendOpacity',
    'lightX','lightY','lightPower','lightSoft','shadowStrength','lightPreset',
    'fxStrength','fxGrain','fxBleed','fxWear','fxExposure','fxContrast',
    'fxSoft','fxBorder','labBrushSize','labBrushSoft'
  ].map(key => [key, $('#'+key)?.value ?? null]))
});
// Capture the clean startup controls before React restores the autosave slot.
// Geometry is rebuilt at reset time to match the current viewport.
const studioDefaults={...checkpoint(),mesh:null,uiTheme:'light'};
const extraDefaults=Object.fromEntries(['exportFormat','exportResolution','exportGrain','labQuality','tfScale','tfAngle','tfPosX','tfPosY'].map(id=>[id,$('#'+id).value]));
const detailDefaults=[...document.querySelectorAll('#extra details')].map(el=>[el,el.open]);
async function resetStudioToDefaults(){
  imageLoadVersion++;
  // Cancel pending gestures so an old pointer sample cannot repaint the reset.
  pendingStroke=null;if(pendingStrokeFrame)cancelAnimationFrame(pendingStrokeFrame);pendingStrokeFrame=0;
  if(activePaintPointer!==null&&cv.hasPointerCapture(activePaintPointer))cv.releasePointerCapture(activePaintPointer);
  activePaintPointer=null;drawing=false;maskDrawing=false;maskPrevious=null;last=null;mouse=null;hv=0;
  clearTimeout(ft);$('#stw').classList.remove('busy');
  stopCam();stream=null;media=null;framed=false;
  setTransformActive(false);setTFCompact(true);tfPointers.clear();tfGesture=null;transformLastPointer=null;
  $('#exportOptions').hidden=true;$('#sv').hidden=true;
  await restoreCheckpoint(studioDefaults);
  currentImageBlob=null;bgImg=null;imageTextureSource=null;only=false;
  exportTarget={withBg:true,name:'lace-card'};
  // All geometry, undo history and old worker responses are invalidated together.
  build();setMeshVisible(true);
  maskTouched=false;maskHistory.length=0;fillMask(true);
  document.querySelector('#labBrushModes [data-brush="full"]').click();
  toggleBefore(false);setLabCollapsed(false);
  if(effectGrid.hidden)browse.click();
  fxSeed=3.1;R=44;si=0;if(scaleBtn)scaleBtn.textContent='1×';
  acc=0;bloomAcc=0;snagAcc=0;stitchAcc=0;side=1;snd=false;$('#snd').classList.remove('on');
  imageTransform={...studioDefaults.imageTransform};imagePreset='fit';bgFit='contain';
  for(const [id,value] of Object.entries(extraDefaults))$('#'+id).value=value;
  $('#tfScaleValue').textContent='100%';$('#tfAngleValue').textContent='0°';$('#labFit').textContent='image: contain';
  $('#exportGrainValue').textContent=extraDefaults.exportGrain+'%';updateExportInterface();
  for(const input of document.querySelectorAll('input[type="file"]'))input.value='';
  countryChoice='auto';storage.set('afterimage-country','auto');
  if($('#studioCountry')){$('#studioCountry').value='auto';$('#studioCountryCustom').value='';$('#studioCountryCustom').hidden=true;}
  updateMetaClock();$('#paletteReset').click();
  for(const [el,open] of detailDefaults)el.open=open;
  setStudioSidebar(sidebarWide());$('#extra').scrollTop=0;
  clearTimeout(showHint.t);hint.classList.remove('show');
  pd=1;markAll();go();st('studio reset to defaults');
  // React detaches the previous named project and saves the clean autosave.
  // The standalone preview handles the same editor reset without a database.
  $('#resetStudio').dispatchEvent(new CustomEvent('index00:reset',{bubbles:true}));
}
$('#resetStudio').onclick=async()=>{
  if(!confirm('Reset the whole studio to its default settings?\n\nThis clears the current image, stitches, mesh edits and undo history, and resets all controls and tool positions. Unsaved edits will be lost. Saved projects will stay in your library.'))return;
  const button=$('#resetStudio');button.disabled=true;
  try{await resetStudioToDefaults();}finally{button.disabled=false;}
};
async function restoreCheckpoint(s) {
  if (!s || s.version !== 1) throw new Error('Unsupported Index 00 project');
  // Apply geometry and format before projecting the saved brush deformation.
  setAspect(s.canvasAspect || (s.verticalFormat?'9:16':'16:9'));
  setMeshVisible(s.meshVisible!==false);
  setCloth(Number(s.clothSurface)||0);
  clothTension=Number.isFinite(s.clothTension)?s.clothTension:.4;
  $('#clothTension').value=String(clothTension*100);$('#clothTensionValue').textContent=Math.round(clothTension*100)+'%';
  if (s.meshMode && s.meshMode !== meshMode) {
    document.querySelector(`[data-mesh="${s.meshMode}"]`)?.click();
  }
  size();
  const old=s.mesh;
  if (old && Array.isArray(old.originalX) && old.originalX.length) {
    const saved={
      width:s.width,height:s.height,
      originalX:Float32Array.from(old.originalX),
      originalY:Float32Array.from(old.originalY),
      current:{vx:Float32Array.from(old.vx), vy:Float32Array.from(old.vy),
        vc:Float32Array.from(old.vc), pk:old.picots||[],
        stains:old.stains||[], snags:old.snags||[], stitches:old.stitches||[]},
      undo:[]
    };
    restoreResizedMesh(saved);markAll();
  }
  const tone=document.querySelector(`#textures [data-p="${s.palette}"]`);
  if (tone)tone.click();
  textureMode=Number(s.textureMode)<4?Number(s.textureMode)||0:0;
  document.querySelector('#textures [data-x="'+textureMode+'"]').click();
  if(!s.clothSurface&&Number(s.textureMode)>=4)setCloth(({4:1,5:4,6:5})[s.textureMode]||0);
  // Defaults keep older projects readable without carrying values from the last project.
  for(const [id,value] of Object.entries({clothTear:0,wrinkleAmount:35,wrinkleScale:40,wrinkleAngle:25,wrinkleStyle:0,weaveScale:100,blendOpacity:100}))$('#'+id).value=String(value);
  if (s.settings) for(const [key,val] of Object.entries(s.settings)) {
    const input=$('#'+key);
    if(input && val !== null && val !== undefined) {
      input.value=String(val);
      input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));
    }
  }
  updateClothControls();setBlend(restoreBlendIndex(s));
  if(Number.isInteger(s.fxMode))setFxMode(s.fxMode);
  if(Number.isFinite(s.fxSeed))fxSeed=s.fxSeed;
  if(s.tool)document.querySelector(`#tools [data-t="${s.tool}"]`)?.click();
  if(s.repeatMode)document.querySelector(`#modes [data-m="${s.repeatMode}"]`)?.click();
  if(s.stitchStyle!==undefined){$('#stitchStyle').value=String(s.stitchStyle);$('#stitchStyle').dispatchEvent(new Event('change'));}
  if(s.image instanceof Blob) {
    if(await loadBg(s.image)){
      if(s.imageTransform){
        const ix=s.width>0?W/s.width:1, iy=s.height>0?H/s.height:1;
        imageTransform={...s.imageTransform,
          x:s.imageTransform.x*ix,y:s.imageTransform.y*iy,
          scale:s.imageTransform.scale*Math.min(ix,iy)};
        imagePreset='free';syncTransformUI();uploadBg();
      }

    }
  } else if(bgImg){$('#rmbg').click();}
  if(typeof s.framed==='boolean')framed=s.framed;
  if(s.mask){
    await new Promise(resolve=>{
      const image=new Image();image.onload=()=>{
        maskCtx.clearRect(0,0,maskCanvas.width,maskCanvas.height);
        maskCtx.drawImage(image,0,0,maskCanvas.width,maskCanvas.height);
        maskTouched=true;maskDirty=true;resolve();
      };image.onerror=()=>resolve();image.src=s.mask;
    });
  }
  if(s.brushMode && s.brushMode!=='full')document.querySelector(`#labBrushModes [data-brush="${s.brushMode}"]`)?.click();
  if(s.labMode!==labMode)setLabMode(!!s.labMode);
  if(s.uiTheme && s.uiTheme !== uiTheme)applyUITheme(s.uiTheme);
  setMeshVisible(s.meshVisible!==false);dr={full:1};pd=1;go();st('project restored');
}
// Exposed only as an instance API; no global DOM engine state.
return {
  checkpoint,restoreCheckpoint,
  getStatus:()=>({meshMode,palette:document.documentElement.dataset.palette,
    labMode,hasImage:!!bgImg,renderer:gl?'WebGL':'unavailable'}),
  redraw:go
};

}
