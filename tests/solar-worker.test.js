import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const f=JSON.parse(readFileSync(new URL('./fixtures/pvlib-radiation.json',import.meta.url)));
test('browser worker pipeline uses selected sky resolution and returns independent benchmark components',async()=>{
 const messages=[];globalThis.self={postMessage:m=>messages.push(m)};
 try{
  await import('../dist/solar-worker.js');
  const c=f.cases.find(c=>c.name==='Berlin_summer'),o=f.obstructions.find(o=>o.name==='facade_overhang'),ref=f.shaded.find(r=>r.case===c.name&&r.obstruction===o.name&&r.step===1);
  self.onmessage({data:{settings:{...c.settings,step:5,skyPatches:8192},weather:{records:c.records},samples:[{position:[0,0,0],normal:o.normal}],triangles:o.triangles}});
  const result=messages.at(-1);assert.equal(result.error,undefined);assert.equal(result.values.length,1);assert.ok(Math.abs(result.values[0]-ref.total)<.002);assert.ok(Math.abs(result.components[0].sky-o.expectedSky)<.003);
 }finally{delete globalThis.self;}
});
