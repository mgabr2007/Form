import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {structureDisplayState} from '../public/structure-panel-layout.js';
import {saveStructuralRun} from '../public/structure-storage.js';

test('result controls require results and magnification only applies to deformation',()=>{
  assert.deepEqual(structureDisplayState(false,'deformed'),{mode:'frame',showMagnification:false,allowResults:false});
  assert.equal(structureDisplayState(true,'deformed').showMagnification,true);
  assert.equal(structureDisplayState(true,'moment').showMagnification,false);
});
test('static pages have unique element IDs',()=>{
  for(const file of readdirSync('public').filter(f=>f.endsWith('.html'))){
    const ids=[...readFileSync('public/'+file,'utf8').matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(new Set(ids).size,ids.length,file);
  }
});
test('structure has one workspace entry and no redundant manual preview',()=>{
  const page=readFileSync('public/studio.html','utf8'),viewer=readFileSync('public/structure-viewer.js','utf8');
  assert.equal((page.match(/data-tab="structure"/g)||[]).length,1);
  assert.ok(!page.includes('Structure ↗'));
  assert.ok(!viewer.includes('st-preview'));
});
test('saving an existing structural run updates the same record',async()=>{
  const records=new Map(),original=globalThis.indexedDB;
  globalThis.indexedDB={open(){const req={};queueMicrotask(()=>{req.result={close(){},transaction(){const tx={objectStore(){return {put(record){records.set(record.id,record);queueMicrotask(()=>tx.oncomplete());}};}};return tx;}};req.onsuccess();});return req;}};
  try{
    const run={createdAt:'2026-10-17',state:{name:'Test'}};
    run.id=await saveStructuralRun(run);
    assert.ok(run.id);
    assert.equal(await saveStructuralRun(run),run.id);
    assert.equal(records.size,1);
  }finally{globalThis.indexedDB=original;}
});
