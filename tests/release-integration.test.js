import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,normalize} from '../public/geometry.js';
import {normalizeImports,prepareAsset,sha256} from '../public/imported-model.js';
import {saveAsset} from '../public/model-assets.js';
import {portableBundle} from '../public/project-model-assets.js';
import {saveRevision,projectBundle,importBundle} from '../public/projects.js';
import {solarSettings,buildBVH} from '../public/solar.js';
import {radiationSteps,irradiation} from '../public/radiation.js';
import {facadeGrid} from '../public/facade-grid.js';
import {savedFacadeCells} from '../public/saved-facade.js';
import {analysisCSV} from '../public/solar-export.js';
import {replayAnalysisCSV} from '../validation/replay_csv.mjs';
import {searchCandidates} from '../public/search-core.js';
const wall=[0,0,0,0,6,0,0,6,10,0,0,0,0,6,10,0,0,10];
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const item=id=>({id:'model-1',assetId:id,name:'Context',role:'context',visible:false,position:[0,0,0],rotation:0,scale:1,receivers:{},reviewed:false});
test('v2 project revisions retain imports, structure, plot area, identity and period settings',()=>{
 const state=normalize({...defaults(),version:2,projectId:'project-test-1',plotArea:1200,structure:{frameWidth:10},solar:{period:'range',date:'2026-06-20',endDate:'2026-06-21'},imports:{...normalizeImports(),items:[item('a'.repeat(64))]}});
 const local=storage();saveRevision(state,local);const bundle=projectBundle(state.projectId,local),remote=storage();importBundle(bundle,remote);const restored=projectBundle(state.projectId,remote).project.revisions[0].state;
 assert.equal(restored.imports.items[0].visible,false);assert.equal(restored.structure.frameWidth,10);assert.equal(restored.plotArea,1200);assert.equal(restored.solar.period,'range');assert.equal(restored.version,2);
});
test('portable snapshots embed matching original model bytes once across revisions',async()=>{
 const source=new TextEncoder().encode('fixture original source').buffer,id=await sha256(source),asset={...prepareAsset([{id:'mesh:0',positions:wall,color:[1,1,1]}]),id,name:'test.glb',source};await saveAsset(asset);
 const state=normalize({...defaults(),projectId:'project-test-2',imports:{...normalizeImports(),items:[item(id)]}}),local=storage();saveRevision(state,local);saveRevision(state,local);
 const result=await portableBundle(projectBundle(state.projectId,local));assert.equal(result.modelAssets.length,1);assert.equal(result.modelAssets[0].id,id);assert.equal(atob(result.modelAssets[0].data),'fixture original source');
});
test('imported saved façade cells reconstruct the recorded receivers, without a parametric replacement',()=>{
 const grid=facadeGrid(wall,2,2),r={settings:{target:'facade',gridWidth:2,gridHeight:2},sampling:'imported-facade-grid-v1',receiverTriangles:wall,project:defaults(),samples:grid.samples,values:grid.samples.map(()=>1)};
 assert.deepEqual(savedFacadeCells(r),{positions:grid.cellPositions,indices:grid.cellSamples});r.samples[0].position[0]+=1;assert.throws(()=>savedFacadeCells(r),/locations/);
});
test('TMY provider timestamp and date-specific subminute geometry remain distinct and replayable',()=>{
 const start=Date.parse('2026-06-21T10:00Z')/1000,records=[{start,end:start+3600,solarTime:start+600,dni:700,dhi:100}],settings=solarSettings({analysis:'radiation',weatherSource:'tmy',period:'hour',analysisHour:12,step:.5}),sample={position:[0,0,0],normal:[0,1,0]},tree=buildBVH([]);
 const steps=radiationSteps(records,settings);assert.equal(steps.length,1);assert.equal(steps[0].hours,1);assert.equal(radiationSteps(records.map(({solarTime,...r})=>r),settings).length,120);
 const c=irradiation(sample,steps,[],tree,settings.skyPatches),r={settings,samples:[sample],triangles:[],components:[c],values:[c.total],weather:{records,source:'PVGIS fixture',provenance:{kind:'TMY'}},project:defaults(),daylight:1};assert.equal(replayAnalysisCSV(analysisCSV(r)).maxAbsoluteError,0);
});
test('parameter sweeps reject imported targets instead of changing an unrelated building',()=>{
 const state={...defaults(),imports:{...normalizeImports(),nativeRole:'reference',items:[{...item('a'.repeat(64)),role:'target'}]}};assert.throws(()=>searchCandidates(state,{parameter:'orientation',start:0,end:90,count:2}),/parametric building/);
});
