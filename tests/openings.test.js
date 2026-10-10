import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,normalize,modelData,ringAt,area,sectionAt,regionArea,specs} from '../dist/geometry.js';
import {floorPlans,planSVG,planDXF} from '../dist/plans.js';
import {exportIFC} from '../dist/ifc.js';
import {ShapeUtils,Vector2} from '../dist/vendor/three.core.js';
const state=(type,extra={})=>normalize({...defaults(),shape:'rectangle',width:30,depth:20,podium:false,modifiers:[{type,value:specs[type].value,start:1,end:48,...extra}]});
test('atrium removes exact area and exports a genuine interior ring',()=>{
 const s=state('atrium',{value:8,depth:6}),r=sectionAt(s,0);assert.equal(r.area,552);assert.equal(r.regions.length,1);assert.equal(r.regions[0].length,2);
 const plan=floorPlans(s)[0];assert.equal(plan.area,552);assert.match(planSVG(plan),/fill-rule="evenodd"/);assert.equal((planDXF(plan).match(/LWPOLYLINE/g)||[]).length,2);
 assert.match(exportIFC(s),/IFCARBITRARYPROFILEDEFWITHVOIDS/);
});
test('overlapping atriums are unioned, not subtracted twice',()=>{
 const s=state('atrium',{value:8,depth:6});s.modifiers.push({...s.modifiers[0]});assert.equal(sectionAt(s,0).area,552);
});
test('cut-out removes precise recess and triangulation retains concavity',()=>{
 const s=state('notch',{value:6,width:10}),r=sectionAt(s,0);assert.equal(r.area,540);
 for(const region of r.regions){const flat=region.flat(),tris=ShapeUtils.triangulateShape(region[0].map(p=>new Vector2(...p)),region.slice(1).map(h=>h.map(p=>new Vector2(...p))));const total=tris.reduce((a,t)=>a+area(t.map(i=>flat[i])),0);assert.ok(Math.abs(total-regionArea([region]))<1e-7);}
});
test('hole triangulation excludes the void',()=>{
 const r=sectionAt(state('atrium',{value:8,depth:6}),0).regions[0],flat=r.flat();const triangles=ShapeUtils.triangulateShape(r[0].map(p=>new Vector2(...p)),r.slice(1).map(h=>h.map(p=>new Vector2(...p))));assert.ok(Math.abs(triangles.reduce((sum,t)=>sum+area(t.map(i=>flat[i])),0)-552)<1e-7);
});
test('local rotation changes only selected floor group and preserves area',()=>{
 const s=state('localRotate',{start:10,end:20,value:90}),baseline={...s,modifiers:[]};assert.deepEqual(ringAt(s,8),ringAt(baseline,8));assert.deepEqual(ringAt(s,20),ringAt(baseline,20));assert.notDeepEqual(ringAt(s,10),ringAt(baseline,10));assert.ok(Math.abs(area(ringAt(s,10))-600)<1e-8);
});
test('slenderness doubles width/depth ratio and preserves area',()=>{
 const s=state('slender',{value:2}),r=ringAt(s,48),width=Math.max(...r.map(p=>p[0]))-Math.min(...r.map(p=>p[0])),depth=Math.max(...r.map(p=>p[1]))-Math.min(...r.map(p=>p[1]));assert.ok(Math.abs(width/depth-3)<1e-8);assert.ok(Math.abs(area(r)-600)<1e-8);
});
test('balconies are external, repeated and excluded from floor area',()=>{
 const s=state('balcony',{value:2,side:'x+',every:2}),a=sectionAt(s,0),b=sectionAt(s,1);assert.equal(a.area,600);assert.equal(a.balconyArea,40);assert.equal(b.balconyArea,0);assert.equal(modelData(s).balconyArea,960);assert.match(exportIFC(s),/balcony/);
});
test('cut-outs handle split and completely removed floors without invalid IFC',()=>{
 const s=state('atrium',{value:8,depth:40});assert.equal(sectionAt(s,0).regions.length,2);s.modifiers[0].value=40;assert.equal(sectionAt(s,0).area,0);assert.doesNotThrow(()=>planSVG(floorPlans(s)[0]));assert.doesNotThrow(()=>exportIFC(s));assert.doesNotMatch(exportIFC(s),/NaN|Infinity|IFCPOLYLINE\(\(\)\)/);
});
test('new options round-trip and floor ranges bound openings',()=>{
 for(const type of ['atrium','notch','localRotate','balcony','slender']){const s=state(type,{start:5,end:10});assert.deepEqual(modelData(s),modelData(normalize(JSON.parse(JSON.stringify(s)))));}
 const s=state('atrium',{start:5,end:10});assert.equal(sectionAt(s,3).area,600);assert.ok(sectionAt(s,4).area<600);assert.equal(sectionAt(s,10).area,600);
});
