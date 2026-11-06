// R: open needle holes, G: gathered cloth, B: loose fibres. Updated only where
// new stitches land; undo/resize rebuild from the same saved stitch records.
export class ClothDamage {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.patch = document.createElement('canvas');
    this.patchCtx = this.patch.getContext('2d');
    this.tiles = new Set();
    this.records = null;
    this.count = 0;
    this.full = true;
  }
  sync(width, height, records, settings={tension:.4,tear:0,material:1}) {
    const key=`${settings.tension}/${settings.tear}/${settings.material}`;
    if (this.canvas.width !== width || this.canvas.height !== height || this.records !== records || this.count > records.length || this.key!==key) {
      this.canvas.width = width; this.canvas.height = height;
      this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, width, height);
      this.count = 0; this.full = true; this.tiles.clear();
    }
    this.key=key;this.settings=settings;
    this.records = records;
    for (; this.count < records.length; this.count++) this.add(records[this.count]);
  }
  add(q) {
    const {tension,tear,material}=this.settings;
    const compliance=material===3?.45:material===4?1.25:material===2?.7:1;
    const g = this.ctx, r = q.r, reach = r * 7 + 12;
    const seed=Math.sin(q.x*12.9898+q.y*78.233)*43758.5453,random=seed-Math.floor(seed);
    g.save(); g.translate(q.x, q.y); g.rotate(q.a);
    g.globalCompositeOperation = 'lighten';
    // Slender asymmetric gathers perpendicular to the seam. Smooth height is
    // converted to displaced yarns and light-aware normals by the shader.
    if(tension>0)for(let side=-1;side<=1;side+=2){
      g.save();g.translate((random-.5)*r,side*r*(1.2+random));g.rotate((random-.5)*.5);
      g.scale(r*(.38+random*.18),r*(2.4+random*1.8));
      const ridge=g.createRadialGradient(0,0,0,0,0,1);
      ridge.addColorStop(0,`rgba(0,255,0,${tension*.42*compliance})`);
      ridge.addColorStop(.28,`rgba(0,180,0,${tension*.28*compliance})`);
      ridge.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=ridge;g.fillRect(-1,-1,2,2);g.restore();
    }
    const ends = q.style === 1 ? [[0,-r],[0,r]] : q.style === 2 ? [[-r,-r],[r,r],[-r,r],[r,-r]] : q.style === 4 ? [[0,0]] : [[-r,0],[r,0]];
    for (const [x,y] of ends) {
      // The needle displaces yarns; it does not punch a large star-shaped hole.
      // Visible splitting is a separate wear setting and follows the cloth grain.
      const hole = .34 + r*.025 + tension*.12;
      g.fillStyle = '#ff0000'; g.beginPath();
      g.ellipse(x,y,hole,hole*.65,0,0,Math.PI*2);g.fill();
      if(tear>0&&random<tear*.58){
        const length=(1+tear*tear*r*1.4)*(material===3?.55:1);
        g.save();g.translate(x,y);g.rotate(-q.a+(random>.3?Math.PI/2:0));
        g.beginPath();g.moveTo(-length,0);g.lineTo(-length*.3,-hole*.7);g.lineTo(length*.65,-hole*.4);g.lineTo(length,0);g.lineTo(length*.25,hole);g.closePath();g.fill();
        g.strokeStyle='rgb(0,0,145)';g.lineWidth=.4;
        for(let i=0;i<3;i++){const px=(i-1)*length*.55;g.beginPath();g.moveTo(px,-hole);g.quadraticCurveTo(px+1,-2.2-tear,px+2+random,-1.2);g.stroke();}
        g.restore();
      }
    }
    g.restore();
    if (!this.full) {
      for (let y=Math.max(0,Math.floor((q.y-reach)/128));y<=Math.min(Math.ceil(this.canvas.height/128)-1,Math.floor((q.y+reach)/128));y++)
        for (let x=Math.max(0,Math.floor((q.x-reach)/128));x<=Math.min(Math.ceil(this.canvas.width/128)-1,Math.floor((q.x+reach)/128));x++) this.tiles.add(`${x},${y}`);
    }
  }
  upload(gl, texture) {
    if (!this.full && !this.tiles.size) return;
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    if (this.full) gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.canvas);
    else for (const tile of this.tiles) {
      const [tx,ty]=tile.split(',').map(Number), x=tx*128,y=ty*128;
      const w=Math.min(128,this.canvas.width-x),h=Math.min(128,this.canvas.height-y);
      this.patch.width=w;this.patch.height=h;
      this.patchCtx.drawImage(this.canvas,x,y,w,h,0,0,w,h);
      gl.texSubImage2D(gl.TEXTURE_2D,0,x,this.canvas.height-y-h,gl.RGBA,gl.UNSIGNED_BYTE,this.patch);
    }
    this.full=false;this.tiles.clear();
  }
}
