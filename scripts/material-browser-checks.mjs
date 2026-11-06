import fs from 'node:fs/promises';
import path from 'node:path';

function checkBlends(source){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
  const gl=canvas.getContext('webgl',{antialias:false,preserveDrawingBuffer:true});
  const shader=(type,code)=>{const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision highp float;uniform vec3 b,s;uniform float m;'+source+'\nvoid main(){gl_FragColor=vec4(blendRGB(b,s,m),1.);}'));
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
  const b=gl.getUniformLocation(program,'b'),s=gl.getUniformLocation(program,'s'),m=gl.getUniformLocation(program,'m');
  const ref=document.createElement('canvas');ref.width=ref.height=1;const g=ref.getContext('2d',{willReadFrequently:true});
  const native={0:'source-over',1:'source-over',2:'darken',3:'multiply',4:'color-burn',7:'lighten',8:'screen',9:'color-dodge',12:'overlay',13:'soft-light',14:'hard-light',19:'difference',20:'exclusion',23:'hue',24:'saturation',25:'color',26:'luminosity'};
  const base=[.2,.4,.7],top=[.8,.3,.1];gl.uniform3fv(b,base);gl.uniform3fv(s,top);
  const expected={5:[0,0,0],6:top,10:[1,.7,.8],11:base,15:[.5,0,0],16:[.8,0,0],17:[.6,.4,.2],18:[1,0,0],21:[0,.1,.6],22:[.25,1,1]};
  const results=[];
  for(let mode=0;mode<27;mode++){
    gl.uniform1f(m,mode);gl.drawArrays(gl.TRIANGLES,0,3);const actual=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,actual);
    let target;
    if(native[mode]){
      g.globalCompositeOperation='copy';g.fillStyle='rgb(20% 40% 70%)';g.fillRect(0,0,1,1);
      g.globalCompositeOperation=native[mode];g.fillStyle='rgb(80% 30% 10%)';g.fillRect(0,0,1,1);target=g.getImageData(0,0,1,1).data;
    }else target=expected[mode].map(x=>Math.round(x*255));
    const delta=Math.max(...[0,1,2].map(i=>Math.abs(actual[i]-target[i])));
    if(delta>2)throw Error(`Blend ${mode}: ${actual} differs from ${target} by ${delta}`);
    results.push({mode,actual:[...actual].slice(0,3),error:delta});
  }
  // Black/white boundary cases must not produce NaNs or inverted burn/dodge.
  for(const mode of [4,9,15,22])for(const value of [0,1]){
    gl.uniform3f(b,value,value,value);gl.uniform3f(s,value,value,value);gl.uniform1f(m,mode);gl.drawArrays(gl.TRIANGLES,0,3);
    if(gl.getError()!==gl.NO_ERROR)throw Error('Blend boundary GL error');
  }
  gl.getExtension('WEBGL_lose_context')?.loseContext();return results;
}

export async function checkMaterials({evaluate,rpc,root,output}){
  const source=await fs.readFile(path.join(root,'frontend/src/shaders/blending.glsl'),'utf8');
  const blends=await evaluate(`(${checkBlends.toString()})(${JSON.stringify(source)})`);
  const sample=async()=>{
    await evaluate(`window.__sampleFrame=true;document.querySelector('#wrinkleAmount').dispatchEvent(new Event('input'));`);
    for(let i=0;i<80;i++){if(await evaluate('window.__sampleFrame===false'))return evaluate('window.__frameSignature');await new Promise(r=>setTimeout(r,100));}
    throw Error('Material sample timeout');
  };
  await evaluate(`document.querySelector('#meshVisibility').click();document.querySelector('#wrinkleAmount').value='70';`);
  const fabrics=[];
  for(const [id,name] of [[1,'linen'],[2,'cotton'],[3,'denim'],[4,'silk'],[5,'velvet'],[6,'tulle']]){
    await evaluate(`document.querySelector('#clothSurface').value='${id}';document.querySelector('#clothSurface').dispatchEvent(new Event('change'));`);
    const signature=await sample();
    const rect=await evaluate(`(()=>{const r=document.querySelector('#c').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1};})()`);
    const image=await rpc('Page.captureScreenshot',{format:'png',clip:rect});
    await fs.writeFile(path.join(output,`fabric-${name}.png`),Buffer.from(image.data,'base64'));fabrics.push({id,name,signature});
  }
  if(new Set(fabrics.map(x=>x.signature)).size!==6)throw Error('Fabric renders are not distinct');
  await evaluate(`document.querySelector('#clothSurface').value='4';document.querySelector('#clothSurface').dispatchEvent(new Event('change'));document.querySelector('#flattenCloth').click();`);
  const flat=await sample();await evaluate(`document.querySelector('#wrinkleAmount').value='85';`);const folded=await sample();
  await evaluate(`document.querySelector('#wrinkleStyle').value='1';document.querySelector('#wrinkleStyle').dispatchEvent(new Event('change'));`);const crumpled=await sample();
  await evaluate(`document.querySelector('#wrinkleStyle').value='2';document.querySelector('#wrinkleStyle').dispatchEvent(new Event('change'));`);const creased=await sample();
  if(new Set([flat,folded,crumpled,creased]).size!==4)throw Error('Wrinkle settings do not change rendered output');
  await evaluate(`document.querySelector('#clothSurface').value='1';document.querySelector('#clothSurface').dispatchEvent(new Event('change'));document.querySelector('#wrinkleAmount').value='35';document.querySelector('#wrinkleStyle').value='0';document.querySelector('#wrinkleStyle').dispatchEvent(new Event('change'));document.querySelector('#meshVisibility').click();`);
  await fs.writeFile(path.join(output,'material-checks.json'),JSON.stringify({blends,fabrics,wrinkles:{flat,folded,crumpled,creased}},null,2));
  console.log('All 27 blend equations, six material renders and four wrinkle states passed.');
}
