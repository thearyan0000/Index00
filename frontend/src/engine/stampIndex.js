// Incremental spatial lookup for embroidery and decorative marks. Both the
// synchronous renderer and raster worker use the same bounds and query logic.
export class StampIndex {
  constructor() { this.records=null; this.count=0; this.bins=new Map(); }
  sync(records) {
    if (this.records!==records || this.count>records.length) {
      this.records=records;this.count=0;this.bins.clear();
    }
    for (;this.count<records.length;this.count++) {
      const q=records[this.count],r=Math.max((q.r||0)*2,(q.len||0))+16;
      for(let y=Math.floor((q.y-r)/96);y<=Math.floor((q.y+r)/96);y++)
        for(let x=Math.floor((q.x-r)/96);x<=Math.floor((q.x+r)/96);x++) {
          const key=x+','+y;
          if(!this.bins.has(key))this.bins.set(key,[]);
          this.bins.get(key).push(q);
        }
    }
  }
  query(records,full,x0,y0,x1,y1) {
    this.sync(records);
    if(full)return records;
    const found=new Set();
    for(let y=Math.floor(y0/96);y<=Math.floor(y1/96);y++)
      for(let x=Math.floor(x0/96);x<=Math.floor(x1/96);x++)
        for(const q of this.bins.get(x+','+y)||[])found.add(q);
    return found;
  }
}
