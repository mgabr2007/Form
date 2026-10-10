import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,normalize,modelData,ringAt,area} from '../dist/geometry.js';
test('rectangular tower has analytically correct height and floor area',()=>{
 const s={...defaults(),shape:'rectangle',width:30,depth:20,floors:40,storey:3.5,podium:false,modifiers:[]},d=modelData(s);
 assert.equal(d.height,140);assert.equal(d.totalArea,24000);assert.equal(d.areas.length,40);assert.equal(d.areas[0],600);
});
test('podium is counted separately once',()=>{
 const s={...defaults(),shape:'rectangle',width:30,depth:20,floors:40,storey:3.5,podium:true,podiumFloors:3,podiumWidth:60,podiumDepth:50,modifiers:[]},d=modelData(s);
 assert.equal(d.height,150.5);assert.equal(d.totalArea,33000);assert.equal(d.base,10.5);
});
test('twist and translations preserve floor area',()=>{
 const s={...defaults(),shape:'rectangle',podium:false,modifiers:[{type:'twist',value:150,start:1,end:48,enabled:true},{type:'leanX',value:30,start:1,end:48,enabled:true},{type:'bend',value:20,start:1,end:48,enabled:true}]};
 for(const a of modelData(s).areas)assert.ok(Math.abs(a-s.width*s.depth)<1e-7);
});
test('taper scales area by the square of the linear scale',()=>{
 const s={...defaults(),shape:'rectangle',modifiers:[{type:'taper',value:50,start:1,end:48,enabled:true}]};
 assert.ok(Math.abs(area(ringAt(s,48))-s.width*s.depth*.25)<1e-7);
});
test('setbacks create a horizontal terrace and exact area reduction',()=>{
 const s={...defaults(),shape:'rectangle',modifiers:[{type:'setback',value:20,start:20,end:48,enabled:true}]},d=modelData(s);
 assert.equal(d.layers.length,d.rings.length+1);assert.ok(Math.abs(d.areas[19]-s.width*s.depth*.64)<1e-7);assert.equal(d.areas[18],s.width*s.depth);
 const terrace=d.layers.filter(r=>r.y===d.rings[19].y);assert.equal(terrace.length,2);
});
test('project round trip preserves generated geometry',()=>{
 const s=defaults(),a=modelData(s),b=modelData(normalize(JSON.parse(JSON.stringify(s))));assert.deepEqual(a,b);
});
test('extreme combined modifiers retain finite positive geometry',()=>{
 const s=normalize({...defaults(),floors:100,shape:'hexagon',modifiers:[{type:'twist',value:180,start:1,end:100},{type:'taper',value:65,start:10,end:70},{type:'bulge',value:-45,start:15,end:85},{type:'leanZ',value:-50,start:1,end:100},{type:'setback',value:45,start:50,end:100}]});
 const d=modelData(s);assert.ok(d.areas.every(a=>Number.isFinite(a)&&a>0));assert.ok(d.rings.every(r=>r.points.flat().every(Number.isFinite)));
});
test('imports clamp ranges and reject unknown or nonfinite values',()=>{
 const s=normalize({...defaults(),floors:1000,modifiers:[{type:'twist',value:999,start:1000,end:1}]});assert.equal(s.floors,100);assert.equal(s.modifiers[0].start,100);assert.equal(s.modifiers[0].end,100);assert.equal(s.modifiers[0].value,180);
 assert.throws(()=>normalize({...defaults(),width:'bad'}));assert.throws(()=>normalize({...defaults(),modifiers:[{type:'unknown'}]}));assert.throws(()=>normalize({version:9}));
});
