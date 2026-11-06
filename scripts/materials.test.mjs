import test from 'node:test';
import assert from 'node:assert/strict';
import {blendModes,restoreBlendIndex} from '../frontend/src/engine/blendModes.js';
import {makeFabricMaps} from '../frontend/src/engine/fabricMaps.js';

test('all requested modes have distinct stable identifiers and old IDs migrate',()=>{
  assert.equal(blendModes.length,27);assert.equal(new Set(blendModes.map(x=>x[0])).size,27);
  assert.equal(restoreBlendIndex({blendModeId:'hue',blendMode:0}),23);
  assert.equal(restoreBlendIndex({blendMode:4}),8); // old screen
  assert.equal(restoreBlendIndex({blendMode:5}),12); // old overlay
  assert.equal(restoreBlendIndex({blendMode:99}),0);
});
test('six fabrics have distinct physical maps; only tulle has open weave',()=>{
  const samples=[];
  for(let id=1;id<=6;id++){
    const first=makeFabricMaps(id),second=makeFabricMaps(id);
    assert.deepEqual(first.color,second.color);assert.equal(first.detail.length,512*512*4);
    let holes=0,normalVariation=0;
    for(let i=0;i<first.color.length;i+=4){if(first.color[i+3]<128)holes++;normalVariation+=Math.abs(first.detail[i]-128);}
    if(id===6)assert.ok(holes>100);else assert.equal(holes,0);
    assert.ok(normalVariation>0);samples.push(Buffer.from(first.color).toString('base64'));
  }
  assert.equal(new Set(samples).size,6);
});
