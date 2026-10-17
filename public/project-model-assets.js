import {validateBundle} from './projects.js';
import {loadAsset,parseModel,saveAsset} from './model-assets.js';
const ids=b=>[...new Set(b.project.revisions.flatMap(r=>(r.state.imports?.items||[]).map(m=>m.assetId)))];
// Keep original files alongside revision manifests; the existing cloud cap still applies.
export async function portableBundle(bundle){
 validateBundle(bundle);const assets=[];
 for(const id of ids(bundle)){const a=await loadAsset(id),bytes=new Uint8Array(a.source);let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));assets.push({id,name:a.name,data:btoa(binary)});}
 const value={...bundle,modelAssets:assets};if(new Blob([JSON.stringify(value)]).size>8*1024*1024)throw Error('Project with original models exceeds the 8 MB snapshot limit. Open a revision and export its FORM package from Models instead.');return value;
}
export async function restoreBundleAssets(bundle){
 validateBundle(bundle);const required=ids(bundle),entries=bundle.modelAssets||[];
 if(!Array.isArray(entries)||entries.length>6000)throw Error('Invalid model assets');
 const parsed=[];
 for(const id of required){const entry=entries.find(a=>a.id===id);if(!entry){await loadAsset(id);continue;}if(typeof entry.data!=='string'||entry.data.length>12*1024*1024)throw Error('Invalid model asset size');const binary=atob(entry.data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),asset=await parseModel(new File([bytes],entry.name));if(asset.id!==id)throw Error('Model checksum mismatch; project was not imported.');parsed.push(asset);}
 for(const asset of parsed)if(!await saveAsset(asset))throw Error('Model storage unavailable; export a FORM package before leaving this browser.');
 return bundle;
}
