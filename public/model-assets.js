import {IMPORT_LIMITS} from './imported-model.js';
const memory=new Map(),pending=new Map(),sessionOnly=new Set();let database;
function db(){
  if(!database)database=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(Error('Browser model storage is unavailable.'));return;}
    const request=indexedDB.open('form-model-assets-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('assets',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  return database;
}
export function cachedAsset(id){return memory.get(id);}
export async function saveAsset(asset){
  memory.set(asset.id,asset);
  try{
    const database=await db();await new Promise((resolve,reject)=>{const tx=database.transaction('assets','readwrite');tx.objectStore('assets').put(asset);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
    sessionOnly.delete(asset.id);return true;
  }catch{sessionOnly.add(asset.id);return false;}
}
export async function loadAsset(id){
  if(memory.has(id))return memory.get(id);if(pending.has(id))return pending.get(id);
  const promise=(async()=>{
    const database=await db();const result=await new Promise((resolve,reject)=>{const q=database.transaction('assets').objectStore('assets').get(id);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
    if(!result)throw Error('A model file is missing from this browser. Reopen its FORM package or reimport the matching original file.');
    memory.set(id,result);return result;
  })();pending.set(id,promise);
  try{return await promise;}finally{pending.delete(id);}
}
export async function loadProjectAssets(project){return Promise.all([...new Set((project.imports?.items||[]).map(m=>m.assetId))].map(loadAsset));}
export function trimAssetMemory(keep){for(const id of memory.keys())if(!keep.has(id)&&!sessionOnly.has(id))memory.delete(id);}
export function parseModel(file,{onProgress=()=>{},signal}={}){
  return new Promise(async(resolve,reject)=>{
    if(file.size>IMPORT_LIMITS.fileBytes){reject(Error('Choose a model no larger than 25 MiB.'));return;}
    if(signal?.aborted){reject(new DOMException('Import cancelled.','AbortError'));return;}
    const worker=new Worker(new URL('./model-import-worker.js',import.meta.url),{type:'module'});
    const cleanup=()=>{worker.terminate();signal?.removeEventListener('abort',cancel);};
    const cancel=()=>{cleanup();reject(new DOMException('Import cancelled.','AbortError'));};signal?.addEventListener('abort',cancel,{once:true});
    worker.onmessage=({data})=>{if(data.progress){onProgress(data.progress,data.value);return;}cleanup();if(data.error)reject(Error(data.error));else resolve(data.asset);};
    worker.onerror=e=>{cleanup();reject(Error('Model import failed: '+e.message));};
    try{const buffer=await file.arrayBuffer();if(signal?.aborted)return;worker.postMessage({buffer,name:file.name},[buffer]);}catch(e){cleanup();reject(e);}
  });
}
function packageJob(data,{signal}={}){
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('Package operation cancelled.','AbortError'));return;}
    const worker=new Worker(new URL('./model-package-worker.js',import.meta.url),{type:'module'});
    const cleanup=()=>{worker.terminate();signal?.removeEventListener('abort',cancel);};
    const cancel=()=>{cleanup();reject(new DOMException('Package operation cancelled.','AbortError'));};signal?.addEventListener('abort',cancel,{once:true});
    worker.onmessage=({data})=>{cleanup();data.error?reject(Error(data.error)):resolve(data);};worker.onerror=e=>{cleanup();reject(Error(e.message));};worker.postMessage(data);
  });
}
export async function exportPackage(project,options){const assets=await loadProjectAssets(project);return (await packageJob({action:'write',project,assets:assets.map(a=>({id:a.id,name:a.name,format:a.format,source:a.source}))},options)).buffer;}
export async function importPackage(file,{onProgress=()=>{},signal}={}){
  if(file.size>IMPORT_LIMITS.packageBytes)throw Error('Project package exceeds 100 MiB.');
  const {project,sources}=await packageJob({action:'read',buffer:await file.arrayBuffer()},{signal});
  const assets=[];
  for(let i=0;i<sources.length;i++){
    const entry=sources[i];onProgress('Checking model '+(i+1)+' of '+sources.length+'…');
    const asset=await parseModel(new File([entry.source],entry.name),{signal,onProgress});
    if(asset.id!==entry.id)throw Error('Package model checksum does not match.');assets.push(asset);
  }
  return {project,assets};
}
