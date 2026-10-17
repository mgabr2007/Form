import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,normalize,modelData} from '../public/geometry.js';
import {envelopeMesh,loftLoops} from '../public/envelope.js';
const make=mods=>normalize({...defaults(),floors:12,podium:false,shape:'rectangle',modifiers:mods.map(m=>({start:1,end:12,...m}))});
test('atrium with taper and twist has continuous inclined envelope triangles',()=>{
 const s=make([{type:'atrium',value:6,depth:6},{type:'taper',value:25},{type:'twist',value:45}]),d=modelData(s),e=envelopeMesh(s,d);assert.equal(e.fallbackFloors.length,0);assert.ok(e.positions.every(Number.isFinite));assert.ok(e.positions.length>0);
 // Every storey is subdivided; no full-storey vertical extrusion remains.
 for(let i=0;i<e.positions.length;i+=9){const ys=[e.positions[i+1],e.positions[i+4],e.positions[i+7]];assert.ok(Math.max(...ys)-Math.min(...ys)<=s.storey/4+1e-6);}
 const tops=e.positions.filter((v,i)=>i%3===1&&Math.abs(v-d.height)<1e-8);assert.ok(tops.length);
});
test('loft preserves corners when polygon vertex counts differ',()=>{
 const p=[],edges=[];loftLoops(p,[[0,0],[10,0],[10,10],[0,10]],[[0,0],[5,0],[10,0],[10,10],[0,10]],0,4,edges);
 assert.ok(p.every(Number.isFinite));for(const y of [0,4])for(const [x,z]of [[0,0],[10,0],[10,10],[0,10]])assert.ok(p.some((v,i)=>i%3===0&&Math.abs(v-x)<1e-7&&p[i+1]===y&&Math.abs(p[i+2]-z)<1e-7));
});
test('removed and split floors are explicitly reported',()=>{
 const s=make([{type:'atrium',value:40,depth:40,start:3,end:5}]),d=modelData(s);assert.deepEqual(d.emptyFloors,[3,4,5]);
 const split=modelData(make([{type:'atrium',value:8,depth:40}]));assert.equal(split.splitFloors.length,12);
 assert.doesNotThrow(()=>envelopeMesh(s,d));
});
test('topology changes are localized and reported without nonfinite triangles',()=>{
 const s=make([{type:'atrium',value:16,depth:40},{type:'taper',value:65}]),e=envelopeMesh(s,modelData(s));assert.ok(e.positions.every(Number.isFinite));assert.ok(e.fallbackFloors.length>0);
});
test('abrupt modifiers with openings retain finite horizontal transitions',()=>{
 const s=make([{type:'notch',value:6,width:8,start:3,end:9},{type:'setback',value:25,start:6},{type:'localRotate',value:30,start:8,end:10}]),e=envelopeMesh(s,modelData(s));assert.ok(e.positions.every(Number.isFinite));assert.ok(e.positions.length>0);
});
