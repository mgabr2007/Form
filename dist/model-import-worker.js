import * as THREE from './vendor/three.module.js';
import {prepareAsset,sha256,IMPORT_LIMITS} from './imported-model.js';

const progress=(text,value)=>self.postMessage({progress:text,value});
export function inspectGLB(buffer){
  if(buffer.byteLength<20)throw Error('GLB header is incomplete.');
  const view=new DataView(buffer);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength)throw Error('Choose a valid glTF 2.0 binary (.glb) file.');
  let offset=12,json,bin;
  while(offset<buffer.byteLength){
    if(offset+8>buffer.byteLength)throw Error('Invalid GLB chunk.');
    const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
    if(length%4||offset+length>buffer.byteLength)throw Error('Invalid GLB chunk length.');
    if(type===0x4e4f534a){if(json||offset!==20)throw Error('Invalid GLB JSON chunk.');json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,offset,length)));}
    else if(type===0x004e4942){if(bin)throw Error('Duplicate GLB binary chunk.');bin=new Uint8Array(buffer,offset,length);}
    offset+=length;
  }
  if(json?.asset?.version!=='2.0'||!bin)throw Error('GLB requires glTF 2.0 metadata and embedded binary geometry.');
  if(json.buffers?.length!==1||json.buffers[0].uri||json.buffers[0].byteLength>bin.length)throw Error('Only self-contained GLB geometry is supported. External buffers are blocked.');
  if(json.images?.some(x=>x.uri))throw Error('External or URI textures are unsupported. Export a GLB with embedded resources.');
  const extensions=new Set([...(json.extensionsUsed||[]),...(json.extensionsRequired||[])]);
  for(const e of extensions)if(!['KHR_materials_unlit'].includes(e))throw Error('Unsupported glTF extension: '+e+'. Export static, uncompressed geometry without material extensions.');
  if(json.animations?.length||json.skins?.length||json.meshes?.some(m=>m.primitives?.some(p=>p.targets?.length)))throw Error('Animated, skinned and morph-target models are unsupported. Export a static mesh.');
  if(!json.meshes?.length||json.meshes.length>IMPORT_LIMITS.meshes||json.nodes?.length>10000)throw Error('No meshes or too many model nodes.');
  let triangleCount=0;
  for(const m of json.meshes)for(const p of m.primitives||[]){
    if((p.mode??4)!==4)throw Error('Only triangle meshes are supported. Triangulate the model before exporting.');
    const accessor=json.accessors?.[p.indices??p.attributes?.POSITION];
    if(!accessor||!Number.isInteger(accessor.count)||accessor.count%3)throw Error('Invalid triangle accessor.');
    triangleCount+=accessor.count/3;
    if(triangleCount>IMPORT_LIMITS.triangles)throw Error('Model exceeds the triangle limit.');
  }
  // Check hierarchy before the loader recurses. It must be a disjoint forest.
  const parents=new Set(),visited=new Set(),active=new Set();
  const visit=(index,depth=0)=>{
    if(!Number.isInteger(index)||!json.nodes?.[index]||depth>100||active.has(index))throw Error('Invalid or excessively deep GLB hierarchy.');
    if(visited.has(index))return;active.add(index);
    for(const child of json.nodes[index].children||[]){if(parents.has(child))throw Error('GLB node has multiple parents.');parents.add(child);visit(child,depth+1);}
    active.delete(index);visited.add(index);
  };
  for(let i=0;i<(json.nodes?.length||0);i++)visit(i);
  for(const scene of json.scenes||[])for(const root of scene.nodes||[])if(parents.has(root)||!json.nodes[root])throw Error('Invalid scene root.');
  for(const a of json.accessors||[])if(!Number.isInteger(a.count)||a.count<0||a.count>IMPORT_LIMITS.triangles*3)throw Error('Excessive geometry allocation requested.');
  const warnings=[];
  if(json.images?.length)warnings.push('Textures omitted: imported models display material colours only.');
  if(json.materials?.some(m=>(m.alphaMode&&m.alphaMode!=='OPAQUE')||(m.pbrMetallicRoughness?.baseColorFactor?.[3]??1)<1))warnings.push('Transparent materials are displayed and analysed as opaque surfaces.');
  json.images=[];json.textures=[];json.samplers=[];
  json.materials=(json.materials||[]).map(m=>({name:m.name,pbrMetallicRoughness:{baseColorFactor:[...(m.pbrMetallicRoughness?.baseColorFactor||[.68,.74,.70,1]).slice(0,3),1],metallicFactor:0,roughnessFactor:.8},doubleSided:true}));
  // Rebuild the container without textures; no decoder or resource network access.
  const encoded=new TextEncoder().encode(JSON.stringify(json)),length=Math.ceil(encoded.length/4)*4,out=new ArrayBuffer(12+8+length+8+bin.length),v=new DataView(out),bytes=new Uint8Array(out);
  v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,out.byteLength,true);v.setUint32(12,length,true);v.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+length);bytes.set(encoded,20);v.setUint32(20+length,bin.length,true);v.setUint32(24+length,0x004e4942,true);bytes.set(bin,28+length);
  return {buffer:out,warnings};
}
async function readGLB(buffer){
  const checked=inspectGLB(buffer),{GLTFLoader}=await import('./vendor/imports/GLTFLoader.js');
  const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(!url.startsWith('blob:'))throw Error('External model resources are blocked.');return url;});
  const gltf=await new GLTFLoader(manager).parseAsync(checked.buffer,'');
  const root=gltf.scene||gltf.scenes[0];if(!root)throw Error('Choose a GLB containing a default scene.');root.updateMatrixWorld(true);
  const meshes=[];let triangles=0;
  root.traverse(o=>{
    if(!o.isMesh)return;
    if(o.isSkinnedMesh||o.isInstancedMesh)throw Error('Skinned/instanced extensions are unsupported; export expanded static geometry.');
    const p=o.geometry.getAttribute('position'),index=o.geometry.index,values=[],point=new THREE.Vector3(),count=index?index.count:p.count;
    triangles+=count/3;if(triangles>IMPORT_LIMITS.triangles)throw Error('Expanded scene exceeds the triangle limit.');
    const mirrored=o.matrixWorld.determinant()<0;
    for(let i=0;i<count;i+=3)for(const k of mirrored?[0,2,1]:[0,1,2]){point.fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(o.matrixWorld);values.push(point.x,point.y,point.z);}
    const association=gltf.parser.associations.get(o),mat=Array.isArray(o.material)?o.material[0]:o.material;
    meshes.push({id:'mesh:'+meshes.length,name:o.name||'Mesh '+(meshes.length+1),positions:new Float64Array(values),color:mat?.color?.toArray()||[.68,.74,.70],properties:{sourceNode:association?.nodes??null,sourceMesh:association?.meshes??null}});
  });
  root.traverse(o=>{o.geometry?.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material]))m?.dispose();});
  return prepareAsset(meshes,{format:'GLB',sourceUnits:'metres (glTF 2.0)',warnings:checked.warnings});
}
const unwrap=x=>x&&typeof x==='object'&&'value'in x?x.value:x;
async function readIFC(buffer){
  const W=await import('./vendor/imports/web-ifc-api.js'),api=new W.IfcAPI();
  await api.Init(name=>new URL('./vendor/imports/'+name,import.meta.url).href,true);
  const model=api.OpenModel(new Uint8Array(buffer),{COORDINATE_TO_ORIGIN:false,CIRCLE_SEGMENTS:24,MEMORY_LIMIT:256*1024*1024});
  if(model<0)throw Error('IFC could not be opened. Check the file/schema.');
  const meshes=[],byElement=new Map();let count=0;
  try{
    const schema=api.GetModelSchema(model);if(!['IFC2X3','IFC4','IFC4X3'].includes(schema))throw Error('Unsupported IFC schema: '+schema);
    progress('Tessellating IFC geometry…',.25);
    api.StreamAllMeshes(model,(mesh,index,total)=>{
      const line=api.GetLine(model,mesh.expressID),props={expressId:mesh.expressID,globalId:unwrap(line.GlobalId)??null,class:api.GetNameFromTypeCode(line.type),name:unwrap(line.Name)||'',description:unwrap(line.Description)||'',storey:null,propertySets:[]};
      byElement.set(mesh.expressID,props);
      for(let i=0;i<mesh.geometries.size();i++){
        const placed=mesh.geometries.get(i),g=api.GetGeometry(model,placed.geometryExpressID);
        try{
          const v=api.GetVertexArray(g.GetVertexData(),g.GetVertexDataSize()),idx=api.GetIndexArray(g.GetIndexData(),g.GetIndexDataSize()),matrix=new THREE.Matrix4().fromArray(placed.flatTransformation),point=new THREE.Vector3(),values=[];
          count+=idx.length/3;if(count>IMPORT_LIMITS.triangles||meshes.length>=IMPORT_LIMITS.meshes)throw Error('IFC exceeds the geometry limit. Export a simplified envelope or smaller selection.');
          const mirrored=matrix.determinant()<0;
          for(let j=0;j<idx.length;j+=3)for(const k of mirrored?[0,2,1]:[0,1,2]){const a=idx[j+k]*6;point.set(v[a],v[a+1],v[a+2]).applyMatrix4(matrix);values.push(point.x,point.y,point.z);}
          if(values.length)meshes.push({id:'ifc:'+mesh.expressID+':'+i,elementId:props.globalId||String(mesh.expressID),name:props.name||props.class+' #'+mesh.expressID,positions:new Float64Array(values),color:[placed.color.x,placed.color.y,placed.color.z],properties:props});
        }finally{g.delete();}
      }
      if(index%50===0)progress('Reading IFC elements…',.25+.5*index/Math.max(1,total));
    });
    // A diagnostic, not proof of complete tessellation: some representations are
    // legitimately non-solid (spaces/openings/annotations). Keep their IDs reviewable.
    const products=api.GetLineIDsWithType(model,W.IFCPRODUCT,true),represented=[];
    if(products.size()>50000)throw Error('IFC has too many products for this import profile.');
    for(let i=0;i<products.size();i++){const id=products.get(i),line=api.GetLine(model,id);if(line.Representation)represented.push(id);}
    const tessellated=new Set(meshes.map(m=>m.properties.expressId)),missing=represented.filter(id=>!tessellated.has(id));
    const coverage={representedProducts:represented.length,tessellatedProducts:tessellated.size,withoutTriangleGeometry:missing};
    const tree=await api.properties.getSpatialStructure(model,true);
    const walk=(n,storey=null)=>{const next=String(n.type).toUpperCase()==='IFCBUILDINGSTOREY'?String(unwrap(n.Name)||'#'+n.expressID):storey;const p=byElement.get(n.expressID);if(p)p.storey=next;for(const c of n.children||[])walk(c,next);};walk(tree);
    const relations=api.GetLineIDsWithType(model,W.IFCRELDEFINESBYPROPERTIES);
    if(relations.size()>20000)throw Error('IFC has too many property relationships for this import profile.');
    for(let i=0;i<relations.size();i++){
      const rel=api.GetLine(model,relations.get(i)),ids=(rel.RelatedObjects||[]).map(unwrap).filter(id=>byElement.has(id));if(!ids.length)continue;
      const set=api.GetLine(model,unwrap(rel.RelatingPropertyDefinition));
      const values=Object.create(null);for(const ref of (set.HasProperties||[]).slice(0,100)){const p=api.GetLine(model,unwrap(ref)),v=unwrap(p.NominalValue);if(['string','number','boolean'].includes(typeof v))values[String(unwrap(p.Name)||'Property').slice(0,160)]=typeof v==='string'?v.slice(0,500):v;}
      for(const id of ids){const p=byElement.get(id);if(p.propertySets.length<30)p.propertySets.push({name:String(unwrap(set.Name)||'Property set'),values});}
    }
    const projects=api.GetLineIDsWithType(model,W.IFCPROJECT);let unitMetadata=[];
    if(projects.size()){const project=api.GetLine(model,projects.get(0)),assignment=project.UnitsInContext?api.GetLine(model,unwrap(project.UnitsInContext)):null;unitMetadata=(assignment?.Units||[]).map(ref=>{const u=api.GetLine(model,unwrap(ref));return {type:unwrap(u.UnitType),name:unwrap(u.Name),prefix:unwrap(u.Prefix)};});}
    return prepareAsset(meshes,{format:'IFC',schema,sourceUnits:'metres after web-ifc unit conversion',coverage,unitMetadata,spatialTree:tree,warnings:[...(missing.length?[missing.length+' represented IFC products have no imported triangles. They may be openings, annotations or unsupported geometry; inspect the source model before analysis.']:[]),'IFC tessellation is approximate. Review openings, normals and selected exterior faces.','Properties are source information, not verified quantities. Colours only; all analytical surfaces are opaque.'],parser:'web-ifc 0.0.75'});
  }finally{api.CloseModel(model);api.Dispose();}
}
self.onmessage=async({data})=>{
  try{
    const {buffer,name}=data;
    if(!(buffer instanceof ArrayBuffer)||!buffer.byteLength||buffer.byteLength>IMPORT_LIMITS.fileBytes)throw Error('Choose a model no larger than 25 MiB.');
    progress('Checking model…',.1);const id=await sha256(buffer);
    const asset=/\.glb$/i.test(name)?await readGLB(buffer):/\.ifc$/i.test(name)?await readIFC(buffer):null;
    if(!asset)throw Error('Choose a .glb or .ifc file.');
    Object.assign(asset,{id,name:String(name).slice(0,160),source:buffer,sourceBytes:buffer.byteLength});
    const transfers=[buffer,...asset.meshes.map(m=>m.positions.buffer)];self.postMessage({asset},transfers);
  }catch(error){self.postMessage({error:error.message||String(error)});}
};
