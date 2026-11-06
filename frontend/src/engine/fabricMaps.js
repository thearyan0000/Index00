// Yarn-scale material maps, generated once per selected material and mipmapped
// on the GPU. No per-frame image generation, network assets or pixel readbacks.
export const fabrics = {
  0: {name:'No cloth / image',description:'Use the photograph or studio ground.'},
  1: {name:'Natural linen',description:'Open plain weave · uneven flax yarns · dry, crisp folds',color:[.76,.69,.58],count:64,rough:.9,relief:1.1},
  2: {name:'Cotton canvas',description:'Dense plain weave · rounded paired yarns · soft matte finish',color:[.85,.80,.69],count:80,rough:.87,relief:.8},
  3: {name:'Indigo denim',description:'3/1 warp-faced twill · indigo warp over pale weft · heavy folds',color:[.12,.24,.40],count:96,rough:.78,relief:1.1},
  4: {name:'Ivory silk satin',description:'Long satin floats · fine filaments · directional lustre',color:[.85,.79,.67],count:120,rough:.28,relief:.23},
  5: {name:'Wine velvet',description:'Dense cut pile · light-absorbing face · soft grazing sheen',color:[.31,.065,.11],count:96,rough:.96,relief:.3},
  6: {name:'Tulle net',description:'Open hexagonal net · fine doubled strands · sheer ground',color:[.70,.68,.65],count:32,rough:.48,relief:1.2}
};
const clamp=x=>Math.max(0,Math.min(1,x));
const fract=x=>x-Math.floor(x);
const hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453);
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
// Periodic value noise guarantees matching tile boundaries.
function noise(x,y,period,periodY=period){
  const ix=Math.floor(x),iy=Math.floor(y),fx=fract(x),fy=fract(y),sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const h=(a,b)=>hash((a+period)%period,(b+periodY)%periodY);
  return (h(ix,iy)*(1-sx)+h(ix+1,iy)*sx)*(1-sy)+(h(ix,iy+1)*(1-sx)+h(ix+1,iy+1)*sx)*sy;
}
export function makeFabricMaps(id,size=512){
  const mat=fabrics[id]||fabrics[1],color=new Uint8Array(size*size*4),detail=new Uint8Array(size*size*4),height=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,n=noise(u*16,v*16,16),fuzz=hash(x,y)-.5;
    let wx=u*mat.count,wy=v*mat.count,shade=1,cover=1,h=0;
    const slubX=noise(u*64,v*8,64,8),slubY=noise(u*8,v*64,8,64);
    // Tiny yarn wander, not a perfectly regular screen-space grid.
    wx+=(slubX-.5)*(id===1?.20:.06);wy+=(slubY-.5)*(id===1?.20:.06);
    const ix=Math.floor(wx),iy=Math.floor(wy),fx=fract(wx),fy=fract(wy);
    const width=id===1?.82:id===2?.96:.94;
    const yarnX=Math.pow(Math.max(0,Math.cos((fx-.5)*Math.PI/width)),.65);
    const yarnY=Math.pow(Math.max(0,Math.cos((fy-.5)*Math.PI/width)),.65);
    let topWarp=(ix+iy)%2===0;
    if(id===3)topWarp=(ix-iy+mat.count*2)%4!==0;
    if(id===4)topWarp=(ix+iy*2)%5!==0;
    const top=topWarp?yarnX:yarnY,under=topWarp?yarnY:yarnX;
    h=.16*under+.65*top;
    shade=.60+.45*top+.07*under;
    const twist=Math.sin((topWarp?wy:wx)*17.+(topWarp?fx:fy)*11.);
    shade+=twist*.035+fuzz*.035;
    if(id===1){h*=.85+.3*(topWarp?slubX:slubY);shade*=.9+.18*n;}
    if(id===2){shade*=.96+.07*n;h+=.02*Math.sin((topWarp?fx:fy)*Math.PI*4.);}
    if(id===3){shade*=topWarp?.8+.22*n:1.9;h+=.04*twist;}
    if(id===4){shade=.94+top*.065+fuzz*.008;h*=.36;}
    if(id===5){h=.22+.11*fuzz+.05*n;shade=.78+.26*n+.12*fuzz;}
    if(id===6){
      // Closest of two staggered hexagonal lattices, with wrapped boundaries.
      const ax=u*32*Math.sqrt(3),ay=v*48,sx=Math.sqrt(3),sy=3;
      const mod=(a,b)=>((a%b)+b)%b;
      const a=[mod(ax,sx)-sx/2,mod(ay,sy)-sy/2],b=[mod(ax-sx/2,sx)-sx/2,mod(ay-sy/2,sy)-sy/2];
      const cell=a[0]*a[0]+a[1]*a[1]<b[0]*b[0]+b[1]*b[1]?a:b;
      const edge=Math.abs(.8660254-Math.max(Math.abs(cell[0]),Math.abs(cell[0])*.5+Math.abs(cell[1])*.8660254));
      cover=1-smooth(.018,.065,edge);h=cover*(.65+.05*Math.sin((x+y)*1.8));shade=.75+.25*cover;
    }
    const i=(y*size+x)*4;height[y*size+x]=h;
    for(let c=0;c<3;c++)color[i+c]=Math.round(clamp(mat.color[c]*shade)*255);
    color[i+3]=Math.round(cover*255);
    detail[i+2]=Math.round(mat.rough*255);detail[i+3]=Math.round(clamp(h)*255);
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const dx=height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size];
    const dy=height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x];
    detail[i]=Math.round(clamp(.5-dx*mat.relief*.38)*255);
    detail[i+1]=Math.round(clamp(.5-dy*mat.relief*.38)*255);
  }
  return {size,color,detail};
}
export class FabricTextures{
  constructor(gl){this.gl=gl;this.cache=new Map();this.current=-1;}
  select(id){
    const gl=this.gl;id=id||1;
    if(!gl||this.current===id)return;
    if(!this.cache.has(id)){
      const maps=makeFabricMaps(id),textures=[];
      for(const [index,data] of [maps.color,maps.detail].entries()){
        const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE6+index);gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,maps.size,maps.size,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.generateMipmap(gl.TEXTURE_2D);textures.push(texture);
      }
      this.cache.set(id,textures);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    }
    this.cache.get(id).forEach((texture,index)=>{gl.activeTexture(gl.TEXTURE6+index);gl.bindTexture(gl.TEXTURE_2D,texture);});this.current=id;
  }
}
