import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,normalize,modelData,ringAt,area,footprint,specs} from '../public/geometry.js';
import {floorPlans,planDXF} from '../public/plans.js';
import {exportIFC} from '../public/ifc.js';
const state=(type,extra={})=>normalize({...defaults(),shape:'rectangle',podium:false,modifiers:[{type,value:specs[type].value,start:1,end:48,...extra}]});
const center=p=>p.reduce((a,p)=>[a[0]+p[0]/48,a[1]+p[1]/48],[0,0]);
test('shape transition preserves base and reaches selected target at roof',()=>{
 const s=state('morph',{target:'ellipse'});assert.deepEqual(ringAt(s,0),footprint('rectangle',36,30));
 assert.ok(Math.abs(area(ringAt(s,48))-area(footprint('ellipse',36,30)))<1e-8);
});
test('corner treatment reduces rectangular area without collapsing outline',()=>{
 const s=state('corners',{value:100});assert.equal(area(ringAt(s,0)),1080);assert.ok(area(ringAt(s,48))>800);assert.ok(area(ringAt(s,48))<1080);
});
test('wave has zero endpoint displacement, selected direction and preserves area',()=>{
 const s=state('wave',{direction:'y',cycles:2,phase:90});
 for(const i of [0,48])assert.ok(Math.abs(center(ringAt(s,i))[1])<1e-8);
 assert.ok(Math.abs(center(ringAt(s,24))[1]-6)<1e-8);
 for(const a of modelData(s).areas)assert.ok(Math.abs(a-1080)<1e-8);
});
test('one-sided terraces leave opposite boundary fixed and create horizontal transitions',()=>{
 const s=state('terraces',{every:8,side:'x+',value:1}),d=modelData(s),p=ringAt(s,8);
 assert.equal(Math.min(...p.map(p=>p[0])),-18);assert.equal(Math.max(...p.map(p=>p[0])),17);
 assert.equal(d.layers.filter(r=>r.y===8*s.storey).length,2);
 assert.ok(Math.abs(area(p)-1050)<1e-8);
});
test('offset groups alternate, return above range and preserve floor area',()=>{
 const s=state('offsets',{every:4,direction:'x',value:5,end:16});
 for(const [level,x] of [[0,0],[4,5],[8,0],[12,5],[16,0]])assert.ok(Math.abs(center(ringAt(s,level))[0]-x)<1e-8);
 assert.ok(Math.abs(center(ringAt(s,4,true))[0])<1e-8);
 assert.equal(modelData(s).layers.filter(r=>r.y===4*s.storey).length,2);
});
test('all new modifiers round trip and share plan/export geometry',()=>{
 for(const type of ['morph','corners','wave','terraces','offsets']){
 const s=state(type),d=modelData(s);assert.deepEqual(modelData(normalize(JSON.parse(JSON.stringify(s)))),d);
 assert.deepEqual(floorPlans(s)[8].points,d.rings[8].points);
 assert.match(planDXF(floorPlans(s)[8]),/LWPOLYLINE/);assert.match(exportIFC(s),/IFCSLAB/);
 assert.ok(d.areas.every(a=>a>0&&Number.isFinite(a)));
 }
});
test('invalid option inputs normalize safely and disabled modifiers leave geometry unchanged',()=>{
 const s=state('wave',{cycles:'bad',phase:Infinity,direction:'invalid'});assert.equal(s.modifiers[0].cycles,2);assert.equal(s.modifiers[0].phase,0);assert.equal(s.modifiers[0].direction,'x');
 for(const type of ['morph','corners','wave','terraces','offsets'])assert.deepEqual(ringAt(state(type,{enabled:false}),24),footprint('rectangle',36,30));
});
