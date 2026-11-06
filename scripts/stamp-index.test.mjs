import test from 'node:test';
import assert from 'node:assert/strict';
import { StampIndex } from '../frontend/src/engine/stampIndex.js';

test('partial queries include marks crossing tile boundaries without duplicates',()=>{
  const index=new StampIndex();
  const stitch={x:96,y:96,r:8},distant={x:1000,y:1000,r:4};
  const records=[stitch,distant];
  assert.deepEqual([...index.query(records,false,80,80,120,120)],[stitch]);
  assert.equal(index.query(records,true,0,0,0,0),records);
});

test('append is incremental and undo/replacement discards old indexed marks',()=>{
  const index=new StampIndex(),records=[{x:20,y:20,r:4}];
  index.sync(records);
  const next={x:400,y:400,r:5};records.push(next);
  assert.deepEqual([...index.query(records,false,390,390,410,410)],[next]);
  records.pop();
  assert.equal(index.query(records,false,390,390,410,410).size,0);
  assert.equal(index.query([],false,0,0,100,100).size,0);
});

test('a local query on a dense design does not enumerate its entire history',()=>{
  const index=new StampIndex(),records=[];
  for(let y=0;y<1000;y+=5)for(let x=0;x<1600;x+=5)records.push({x,y,r:4});
  const nearby=index.query(records,false,700,400,720,420);
  assert.ok(nearby.size<records.length/20);
  const required=records.filter(q=>q.x>=700&&q.x<=720&&q.y>=400&&q.y<=420);
  for(const q of required)assert.ok(nearby.has(q));
});
