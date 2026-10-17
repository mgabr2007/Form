import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {solarSettings,buildBVH,sunSteps,sunlightHours} from '../dist/solar.js';
import {irradiation,radiationSteps,IRRADIATION_METHOD_VERSION} from '../dist/radiation.js';
import {skyExposure} from '../dist/daylight.js';
import {facadeGrid} from '../dist/facade-grid.js';
import {analysisCSV} from '../dist/solar-export.js';
import {parseCSV,replayAnalysisCSV} from '../validation/replay_csv.mjs';
import {snapshot,compare,readHistory,writeHistory} from '../dist/analysis-history.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/pvlib-radiation.json',import.meta.url)));
const wall=[0,0,0,0,6,0,0,6,10,0,0,0,0,6,10,0,0,10];
const grid=facadeGrid(wall,5,3),tree=buildBVH(wall);
const weather={source:'Synthetic integration test',url:'offline',retrieved:'2026-10-17',gridLatitude:30,gridLongitude:31,records:fixture.cases[0].records};
function run(mode,step=30){
 const settings=solarSettings({...fixture.cases[0].settings,analysis:mode,target:'facade',step,skyPatches:2048,skyResolution:32,gridWidth:5,gridHeight:3});
 const steps=mode==='radiation'?radiationSteps(weather.records,settings):sunSteps(settings);
 const components=grid.samples.map(s=>['daylight','sky'].includes(mode)?skyExposure(s,wall,tree,settings.skyResolution):mode==='radiation'?irradiation(s,steps,wall,tree,settings.skyPatches):null);
 const values=grid.samples.map((s,i)=>mode==='sunlight'?sunlightHours(s,steps,wall,tree):components[i][mode==='radiation'?'total':mode==='daylight'?'vsc':'skyView']);
 return {settings,samples:grid.samples,triangles:wall,sampling:'facade-grid-v1',components,values,weather:mode==='radiation'?weather:null,project:{name:'Integration, "all modes"'},daylight:steps.filter(s=>s.altitude>0).reduce((a,s)=>a+s.hours,0),resolutionStudy:{coarseSettings:{gridWidth:10,gridHeight:6}}};
}

test('all four analysis modes retain grid identities and exactly replay the saved ray mesh',()=>{
 for(const mode of ['sunlight','radiation','daylight','sky']){
  const r=run(mode),csv=analysisCSV(r),rows=parseCSV(csv),meta=Object.fromEntries(rows.filter(x=>x.length===2)),head=rows.findIndex(x=>x[0]==='x_m');
  assert.deepEqual(JSON.parse(meta['settings JSON']),r.settings);
  assert.deepEqual(JSON.parse(meta['analysis triangles JSON']),wall);
  assert.deepEqual(JSON.parse(meta['resolution study JSON']),r.resolutionStudy);
  assert.equal(meta.sampling,'facade-grid-v1');
  assert.deepEqual(rows.slice(head+1).map(x=>x.slice(-3).map(Number)),grid.samples.map(s=>[s.gridRow+0,s.gridColumn+0,s.faceTriangle]));
  assert.equal(replayAnalysisCSV(csv).maxAbsoluteError,0);
  if(mode==='radiation'){assert.equal(meta['time step minutes'],'1');assert.equal(meta['sky directions'],'2048');}
 }
});

test('sky replay preserves undefined VSC on horizontal roof probes and rejects a false value',()=>{
 const r=run('sky'),sample={position:[1,7,1],normal:[0,1,0]},c=skyExposure(sample,wall,tree,32);
 Object.assign(r,{samples:[sample],components:[c],values:[c.skyView],sampling:'exterior-roof-v2'});r.settings.target='roof';
 const csv=analysisCSV(r);assert.equal(replayAnalysisCSV(csv).maxAbsoluteError,0);
 const rows=parseCSV(csv);rows.at(-1)[6]='0';
 const invalid=rows.map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\r\n');
 assert.throws(()=>replayAnalysisCSV(invalid),/empty VSC/);
 assert.throws(()=>replayAnalysisCSV(csv.replace(IRRADIATION_METHOD_VERSION,'FORM-irradiation-2')),/method version/);
});

test('comparison retains old history but blocks cross-engine and sky-ray deltas',()=>{
 const a=snapshot(run('radiation'),'New','new'),b=structuredClone(a);
 b.engine='FORM-environment-2026-10-12';b.id='old';
 let data;const storage={setItem:(_,v)=>data=v,getItem:()=>data};writeHistory(storage,[a,b]);
 const saved=readHistory(storage);assert.equal(saved.length,2);assert.ok(compare(saved[0],saved[1]).reasons.includes('engine'));
 b.engine=a.engine;b.result.settings.skyPatches=8192;assert.deepEqual(compare(a,b).reasons,['irradiation sky rays']);
 b.result.settings.skyPatches=2048;b.result.settings.step=60;assert.equal(compare(a,b).delta,0);
 b.result.settings.step=.5;assert.ok(compare(a,b).reasons.includes('time step'));
});

test('worker preserves daylight, sky and sunlight on the clipped facade grid',async()=>{
 const messages=[];globalThis.self={postMessage:m=>messages.push(m)};
 try{
  await import('../dist/solar-worker.js');
  for(const mode of ['daylight','sky','sunlight','radiation']){
   const r=run(mode);self.onmessage({data:{settings:r.settings,weather:r.weather,samples:r.samples,triangles:wall}});
   const actual=messages.at(-1);assert.equal(actual.error,undefined);assert.deepEqual(actual.values,r.values);
  }
 }finally{delete globalThis.self;}
});

test('production worker matches independent one-minute shade reference for every coarser requested step',async()=>{
 const messages=[];globalThis.self={postMessage:m=>messages.push(m)};
 try{
  await import('../dist/solar-worker.js?cap-integration');
  for(const ref of fixture.shaded.filter(r=>r.step===1)){
   const c=fixture.cases.find(c=>c.name===ref.case),o=fixture.obstructions.find(o=>o.name===ref.obstruction);
   for(const step of [5,15,30,60]){
    self.onmessage({data:{settings:{...c.settings,analysis:'radiation',step,skyPatches:2048},weather:{records:c.records},samples:[{position:[0,0,0],normal:o.normal}],triangles:o.triangles}});
    const actual=messages.at(-1);assert.equal(actual.error,undefined);assert.ok(Math.abs(actual.values[0]-ref.total)<.01,`${ref.case}/${ref.obstruction}/${step}`);
   }
  }
 }finally{delete globalThis.self;}
});

test('daylight shared offset does not skip a wall one centimetre from a receiving facade',()=>{
 const t=[.01,-1,-1e5,.01,1e5,-1e5,.01,1e5,1e5,.01,-1,-1e5,.01,1e5,1e5,.01,-1,1e5];
 const c=skyExposure({position:[0,0,0],normal:[1,0,0]},t,buildBVH(t),32);
 assert.ok(c.vsc<.001);assert.ok(Math.abs(c.skyView-50)<.001);
});

test('legacy history retains the original effective step when comparing old saved runs',()=>{
 const a=snapshot(run('radiation',5),'Old five','old5'),b=structuredClone(a);
 a.engine=b.engine='FORM-environment-2026-10-17-audit-integration';b.result.settings.step=1;
 assert.ok(compare(a,b).reasons.includes('time step'));
 assert.equal(solarSettings().skyPatches,8192);assert.equal(solarSettings({skyPatches:2048}).skyPatches,2048);
});
