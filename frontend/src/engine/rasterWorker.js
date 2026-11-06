// Index 00 · CPU height-map raster worker
// OffscreenCanvas moves the expensive Path2D mesh/stitch rasterization away from
// React, pointer handling and the GPU presentation loop. WebGL remains on main.
// No external packages or network access are required.
let W=1,H=1,D=1,HS=1,A=7.8,NV=0,GB=48,gw=0,gh=0;
let vx0=new Float32Array(0),vy0=new Float32Array(0),vx=new Float32Array(0),vy=new Float32Array(0),vc=new Float32Array(0);
let cells=[],edges=[],picots=[],stains=[],snags=[],stitches=[],maxD=0;
const hc=new OffscreenCanvas(1,1),hg=hc.getContext('2d');
const renderStats={draws:0,lastDrawMs:0,lastCells:0,lastEdges:0,meshVertices:0};
const stampIndexes={picots:new StampIndex(),stains:new StampIndex(),snags:new StampIndex(),stitches:new StampIndex()};

      let meshCellBins=[], meshEdgeBins=[], allCellIds=[], allEdgeIds=[];
      let indexedVX=new Float32Array(0),indexedVY=new Float32Array(0), meshIndexShift=0;
      let seenCells=new Uint32Array(0), seenEdges=new Uint32Array(0), meshQueryToken=0;
      function indexMeshGeometry(){
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
        renderStats.draws++;
        renderStats.lastDrawMs=performance.now()-renderStart;
        return full ? {full:true,sx:0,sy:0,sw:hc.width,sh:hc.height} : {
          full:false,sx:Math.floor(x0*HS),sy:Math.floor(y0*HS),
          sw:Math.min(hc.width-Math.floor(x0*HS),Math.ceil((x1-x0)*HS)+1),
          sh:Math.min(hc.height-Math.floor(y0*HS),Math.ceil((y1-y0)*HS)+1)
        };
      }

let sceneVersion=0, lastGeometryRevision=-1, meshVisible=true;
self.onmessage=async e=>{
  const d=e.data;
  if(d.type==='geometry'){
    sceneVersion=d.version;lastGeometryRevision=-1;
    W=d.W;H=d.H;D=d.D;A=d.A;NV=d.NV;
    cells=d.cells;edges=d.edges;
    vx0=new Float32Array(d.vx0);vy0=new Float32Array(d.vy0);
    vx=new Float32Array(d.vx);vy=new Float32Array(d.vy);vc=new Float32Array(d.vc);
    gw=Math.ceil(W/GB)+3;gh=Math.ceil(H/GB)+3;
    indexMeshGeometry();
    self.postMessage({type:'ready',version:sceneVersion});
    return;
  }
  if(d.type!=='render'||d.version!==sceneVersion)return;
  const t0=performance.now();
  try{
    if(d.vx){vx=d.vx;vy=d.vy;vc=d.vc;}
    const update=(key,records)=>{
      const change=d.marks[key];
      if(!change.append)return change.items;
      for(const item of change.items)records.push(item);
      return records;
    };
    picots=update('picots',picots);stains=update('stains',stains);
    snags=update('snags',snags);stitches=update('stitches',stitches);
    D=d.D;
    // Reindex against the newest deforming geometry. The full arrays are tiny
    // compared with the CPU raster, and the index remains exact for each job.
    if(d.geometryRevision!==lastGeometryRevision){indexMeshGeometry();lastGeometryRevision=d.geometryRevision;}
    meshVisible=d.meshVisible!==false;
    const patches=d.damage.full?[{full:true}]:d.damage.rects;
    const infos=[];
    for(const region of patches)infos.push(drawH(region));
    const outputs=[],transfers=[];
    for(const info of infos){
      if(!info)continue;
      if(info.sw<=0||info.sh<=0)continue;
      const bitmap=await createImageBitmap(hc,info.sx,info.sy,info.sw,info.sh,{imageOrientation:'flipY'});
      outputs.push({...info,bitmap});transfers.push(bitmap);
    }
    self.postMessage({type:'rendered',version:d.version,sequence:d.sequence,
      outputs,elapsedMs:performance.now()-t0,drawCount:renderStats.draws},transfers);
  }catch(error){
    self.postMessage({type:'error',version:d.version,message:String(error&&error.stack||error)});
  }
};
