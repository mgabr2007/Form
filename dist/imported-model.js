// Immutable decoded assets and small, versioned instance manifests.
// Units: metres; x/right, y/up, z/plan north before the project north rotation.
export const IMPORT_VERSION = 1;
export const IMPORT_LIMITS = Object.freeze({fileBytes:25*1024*1024, triangles:150000, meshes:2000, instances:12, sceneTriangles:300000, packageBytes:100*1024*1024, expandedBytes:200*1024*1024});
const roles = ['reference','context','target'];
const finite = (x, label, min=-1e8, max=1e8) => {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < min || x > max) throw Error('Invalid '+label);
  return x;
};
const vec = (x, label) => {if(!Array.isArray(x)||x.length!==3)throw Error('Invalid '+label);return x.map(v=>finite(v,label));};
const label = x => String(x??'').slice(0,160);
export function normalizeImports(raw) {
  if (!raw) return {version:IMPORT_VERSION,nativeRole:'target',nativeVisible:true,origin:null,items:[]};
  if(raw.version!==IMPORT_VERSION||!Array.isArray(raw.items)||raw.items.length>IMPORT_LIMITS.instances)throw Error('Unsupported imported-model manifest.');
  if(!roles.includes(raw.nativeRole))throw Error('Invalid procedural building role.');
  const ids=new Set();
  const items=raw.items.map(m=>{
    if(!m||typeof m.id!=='string'||!m.id||m.id.length>100||ids.has(m.id)||!roles.includes(m.role)||!/^[a-f0-9]{64}$/.test(m.assetId))throw Error('Invalid imported model identity or role.');
    ids.add(m.id);
    const receivers={};
    if(!m.receivers||typeof m.receivers!=='object'||Array.isArray(m.receivers)||Object.keys(m.receivers).length>IMPORT_LIMITS.meshes)throw Error('Invalid receiver selection.');
    for(const [key,value] of Object.entries(m.receivers)){
      if(!/^[\w:-]{1,100}$/.test(key)||['__proto__','constructor','prototype'].includes(key)||!value||!['facade','roof','none'].includes(value.type))throw Error('Invalid receiver surface.');
      receivers[key]={type:value.type,flip:!!value.flip};
    }
    return {id:m.id,assetId:m.assetId,name:label(m.name)||'Imported building',role:m.role,visible:m.visible!==false,position:vec(m.position,'placement'),rotation:finite(m.rotation,'rotation',-36000,36000),scale:finite(m.scale,'scale',.0001,10000),receivers,reviewed:!!m.reviewed};
  });
  if(items.filter(m=>m.role==='target').length+(raw.nativeRole==='target'?1:0)!==1)throw Error('Choose exactly one analysis building.');
  return {version:IMPORT_VERSION,nativeRole:raw.nativeRole,nativeVisible:raw.nativeVisible!==false,origin:raw.origin===null?null:vec(raw.origin,'shared source origin'),items};
}
export function boundsOf(meshes) {
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const mesh of meshes)for(let i=0;i<mesh.positions.length;i++){
    const v=mesh.positions[i];if(!Number.isFinite(v))throw Error('Model contains non-finite coordinates.');
    const axis=i%3;min[axis]=Math.min(min[axis],v);max[axis]=Math.max(max[axis],v);
  }
  if(!Number.isFinite(min[0]))throw Error('No triangle geometry was found.');
  return {min,max,size:max.map((v,i)=>v-min[i])};
}
export function normalOf(p,i=0){
  const a=[p[i+3]-p[i],p[i+4]-p[i+1],p[i+5]-p[i+2]],b=[p[i+6]-p[i],p[i+7]-p[i+1],p[i+8]-p[i+2]];
  const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=Math.hypot(...n);
  return len>1e-12?n.map(v=>v/len):null;
}
export function prepareAsset(meshes,metadata={}){
  if(!meshes.length||meshes.length>IMPORT_LIMITS.meshes)throw Error('Model has no meshes or exceeds the mesh limit.');
  let total=0,degenerate=0;
  const ids=new Set();
  for(const mesh of meshes){
    if(!/^[\w:-]{1,100}$/.test(mesh.id)||ids.has(mesh.id))throw Error('Invalid or duplicate mesh identifier.');ids.add(mesh.id);
    if(!mesh.positions?.length||mesh.positions.length%9)throw Error('Model contains invalid triangles.');
    total+=mesh.positions.length/9;
    if(total>IMPORT_LIMITS.triangles)throw Error('Model exceeds the '+IMPORT_LIMITS.triangles.toLocaleString()+' triangle limit. Export a simpler model.');
    for(let i=0;i<mesh.positions.length;i+=9)if(!normalOf(mesh.positions,i))degenerate++;
  }
  const bounds=boundsOf(meshes),origin=[(bounds.min[0]+bounds.max[0])/2,bounds.min[1],(bounds.min[2]+bounds.max[2])/2];
  if(Math.max(...bounds.size)>10000)throw Error('Model extent exceeds 10 km. Check source units or export a smaller site.');
  const warnings=[...(metadata.warnings||[])];
  if(degenerate)warnings.push(degenerate+' zero-area triangles removed.');
  const clean=meshes.map(m=>{
    const values=[],sourceTriangles=[];
    for(let i=0;i<m.positions.length;i+=9){if(!normalOf(m.positions,i))continue;sourceTriangles.push(i/9);for(let j=0;j<9;j++)values.push(m.positions[i+j]-origin[j%3]);}
    return {...m,name:label(m.name)||m.id,positions:new Float64Array(values),sourceTriangles};
  }).filter(m=>m.positions.length);
  if(!clean.length)throw Error('No non-degenerate triangle geometry remains.');
  return {version:IMPORT_VERSION,...metadata,meshes:clean,sourceOrigin:origin,bounds:boundsOf(clean),triangleCount:total-degenerate,warnings};
}
export function transformedTriangles(asset,instance,{receiver=null}={}){
  const out=[],sources=[],theta=instance.rotation*Math.PI/180,c=Math.cos(theta),s=Math.sin(theta);
  for(const mesh of asset.meshes){
    const selection=instance.receivers[mesh.id];
    if(receiver&&selection?.type!==receiver)continue;
    const p=mesh.positions;
    for(let i=0;i<p.length;i+=9){
      const order=receiver&&selection.flip?[0,6,3]:[0,3,6],triangle=[];
      for(const offset of order){const j=i+offset,x=p[j]*instance.scale,y=p[j+1]*instance.scale,z=p[j+2]*instance.scale;triangle.push(c*x+s*z+instance.position[0],y+instance.position[1],-s*x+c*z+instance.position[2]);}
      const n=normalOf(triangle);if(!n)continue;
      if(receiver==='roof'&&n[1]<.7||receiver==='facade'&&Math.abs(n[1])>.7)continue;
      out.push(...triangle);sources.push({modelId:instance.id,assetId:instance.assetId,meshId:mesh.id,elementId:mesh.elementId??null,sourceTriangle:mesh.sourceTriangles?.[i/9]??i/9});
    }
  }
  return {triangles:out,sources};
}
export function importSignature(raw,{contextOnly=false}={}){
  const m=normalizeImports(raw);
  return {version:IMPORT_VERSION,nativeRole:m.nativeRole,items:m.items.filter(x=>contextOnly?x.role==='context':x.role!=='reference').map(x=>({assetId:x.assetId,role:x.role,position:x.position,rotation:x.rotation,scale:x.scale,...(!contextOnly?{receivers:x.receivers,reviewed:x.reviewed}:{})})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))};
}
export async function sha256(buffer){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),x=>x.toString(16).padStart(2,'0')).join('');}
