import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {normalizeImports,prepareAsset,transformedTriangles,normalOf,importSignature,IMPORT_LIMITS} from '../dist/imported-model.js';
import {defaults,normalize} from '../dist/geometry.js';
import {saveAsset,loadAsset,trimAssetMemory} from '../dist/model-assets.js';
import {createModelScene} from '../dist/model-scene.js';
import {snapshot,compare} from '../dist/analysis-history.js';
import {facadeGrid} from '../dist/facade-grid.js';
import {buildBVH,sunSteps,sunlightHours,sampleSurfaces,solarSettings} from '../dist/solar.js';
import {irradiation,radiationSteps} from '../dist/radiation.js';
import {skyExposure} from '../dist/daylight.js';
import {readFileSync} from 'node:fs';
const hash='a'.repeat(64),face=[0,0,0,0,6,0,0,6,6,0,0,0,0,6,6,0,0,6];
const makeAsset=()=>({...prepareAsset([{id:'mesh:0',name:'Exterior wall',color:[.5,.5,.5],positions:face}]),id:hash,format:'GLB',name:'Known wall',sourceUnits:'metres'});
const instance=(overrides={})=>({id:'test-model',assetId:hash,name:'Known wall',role:'target',visible:true,position:[0,0,3],rotation:0,scale:1,receivers:{'mesh:0':{type:'facade',flip:false}},reviewed:true,...overrides});
const manifest=(item=instance())=>({version:1,nativeRole:item.role==='target'?'reference':'target',nativeVisible:true,origin:[0,0,0],items:[item]});

test('old projects survive; imported manifests round-trip without asset duplication',()=>{
  const old=normalize(defaults());assert.equal(old.version,1);assert.equal(old.imports,undefined);
  const next=normalize({...old,version:2,imports:manifest()});assert.equal(next.version,2);assert.deepEqual(next.imports,manifest());assert.equal(JSON.stringify(next).includes('positions'),false);
  assert.throws(()=>normalizeImports({...manifest(),nativeRole:'target'}),/exactly one/);
  assert.throws(()=>normalizeImports(manifest(instance({scale:0}))),/scale/);
  assert.throws(()=>normalizeImports(manifest(instance({position:[NaN,0,0]}))),/placement/);
  assert.throws(()=>normalizeImports({...manifest(),items:[instance(),instance()]}),/identity/);
});
test('world transforms preserve dimensions and rotate receiver normals',()=>{
  const asset=makeAsset(),m=instance({rotation:90,scale:2,position:[10,4,20]}),r=transformedTriangles(asset,m,{receiver:'facade'});
  assert.equal(r.triangles.length,18);assert.deepEqual(r.sources.map(s=>s.meshId),['mesh:0','mesh:0']);
  const n=normalOf(r.triangles);assert.ok(Math.abs(n[2]+1)<1e-12);assert.ok(Math.abs(n[0])<1e-12);
  assert.deepEqual([Math.min(...r.triangles.filter((_,i)=>i%3===1)),Math.max(...r.triangles.filter((_,i)=>i%3===1))],[4,16]);
});
test('receiver normal correction never changes obstruction geometry',()=>{
  const asset=makeAsset(),a=instance(),b=instance({receivers:{'mesh:0':{type:'facade',flip:true}}});
  assert.deepEqual(transformedTriangles(asset,a).triangles,transformedTriangles(asset,b).triangles);
  const na=normalOf(transformedTriangles(asset,a,{receiver:'facade'}).triangles),nb=normalOf(transformedTriangles(asset,b,{receiver:'facade'}).triangles);
  assert.ok(na.every((v,i)=>Math.abs(v+nb[i])<1e-12));
  assert.equal(transformedTriangles(asset,a,{receiver:'roof'}).triangles.length,0);
});
test('invalid coordinates and geometry limits fail explicitly',()=>{
  assert.throws(()=>prepareAsset([{id:'mesh:0',positions:[NaN,0,0,1,1,1,2,1,2]}]),/non-finite/);
  assert.throws(()=>prepareAsset([{id:'mesh:0',positions:new Float64Array((IMPORT_LIMITS.triangles+1)*9)}]),/triangle limit/);
  assert.throws(()=>prepareAsset([{id:'mesh:0',positions:new Float64Array(9)}]),/non-degenerate/);
  const asset=prepareAsset([{id:'mesh:0',positions:[...face,...new Array(9).fill(0)]}]);assert.equal(asset.triangleCount,2);assert.ok(asset.warnings[0].includes('zero-area'));
});
test('appearance and names are excluded from analytical signatures',()=>{
  const a=manifest(instance({role:'context'})),b=structuredClone(a);b.items[0].visible=false;b.items[0].name='Changed label';b.nativeVisible=false;
  assert.deepEqual(importSignature(a),importSignature(b));
  b.items[0].position[0]=1;assert.notDeepEqual(importSignature(a,{contextOnly:true}),importSignature(b,{contextOnly:true}));
});
test('imported role and receiver selection control analytical meshes, not visibility',async()=>{
  const asset=makeAsset();await saveAsset(asset);const state={...defaults(),imports:manifest()},scene=new THREE.Scene(),manager=createModelScene({scene,getState:()=>state,getNative:()=>new THREE.Group()});
  const a=await manager.analysis([], 'facade');assert.deepEqual(a.target,face);assert.equal(a.all.length,18);assert.equal(a.sources[0].assetId,hash);
  state.imports.items[0].visible=false;assert.deepEqual((await manager.analysis([],'facade')).target,a.target);
  state.imports.items[0].reviewed=false;await assert.rejects(manager.analysis([],'facade'),/Review/);
  state.imports.items[0].role='reference';state.imports.nativeRole='target';assert.equal((await manager.analysis(face,'facade')).all.length,face.length);
  state.imports.items[0].role='context';assert.equal((await manager.analysis(face,'facade')).all.length,face.length*2);
});
test('native context geometry changes block comparisons for imported targets',async()=>{
  await saveAsset(makeAsset());const state={...defaults(),imports:{...manifest(),nativeRole:'context'}},manager=createModelScene({scene:new THREE.Scene(),getState:()=>state,getNative:()=>new THREE.Group()});
  const one=await manager.analysis(face,'facade'),two=await manager.analysis(face.map(v=>v+1),'facade');
  const result={values:[1],settings:solarSettings({analysis:'radiation',target:'facade'}),sampling:'imported-facade-grid-v1',importProvenance:one.provenance};
  const a=snapshot(result,'A','A'),b=snapshot({...result,importProvenance:two.provenance},'B','B');
  assert.ok(compare(a,b).reasons.includes('imported context'));
  b.result.importProvenance=one.provenance;b.result.settings.gridWidth=2.5;assert.ok(compare(a,b).reasons.includes('grid width'));
});
test('imported equivalent geometry reproduces all four analysis modes and receiver identities',()=>{
  const asset=makeAsset(),m=instance(),imported=transformedTriangles(asset,m,{receiver:'facade'}),grid=facadeGrid(imported.triangles,3,3),plain=facadeGrid(face,3,3);
  assert.deepEqual(grid.samples,plain.samples);
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/pvlib-radiation.json',import.meta.url))),day=fixture.cases.find(c=>c.name==='Cairo_summer'),settings=solarSettings({...day.settings,step:1}),tree=buildBVH(face),itree=buildBVH(imported.triangles);
  const sun=sunSteps({...settings,step:15}),radiation=radiationSteps(day.records,settings);
  for(const s of grid.samples){assert.equal(sunlightHours(s,sun,face,tree),sunlightHours(s,sun,imported.triangles,itree));assert.deepEqual(irradiation(s,radiation,face,tree,512),irradiation(s,radiation,imported.triangles,itree,512));assert.deepEqual(skyExposure(s,face,tree,16),skyExposure(s,imported.triangles,itree,16));}
  const roof=[0,2,0,0,2,4,4,2,4,0,2,0,4,2,4,4,2,0];
  const points=sampleSurfaces(roof,'roof',20,true);assert.ok(points.every(s=>Number.isInteger(s.faceTriangle)&&s.faceTriangle<2));
});

test('receiver keys cannot change manifest object prototypes',()=>{
  const m=manifest();m.items[0].receivers=JSON.parse('{"__proto__":{"type":"facade","flip":false}}');
  assert.throws(()=>normalizeImports(m),/receiver surface/);
});
test('session-only assets remain available for undo after removal',async()=>{
  const asset={...makeAsset(),id:'b'.repeat(64)};assert.equal(await saveAsset(asset),false);
  trimAssetMemory(new Set());assert.equal(await loadAsset(asset.id),asset);
});

test('receiver source-triangle identity survives removal of degenerates',()=>{
 const a=prepareAsset([{id:'mesh:0',positions:[...new Array(9).fill(0),...face]}]);
 assert.deepEqual(transformedTriangles(a,instance()).sources.map(s=>s.sourceTriangle),[1,2]);
});
