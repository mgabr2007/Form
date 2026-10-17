import * as THREE from './vendor/three.module.js';
import {normalizeImports,transformedTriangles,IMPORT_LIMITS,importSignature,sha256} from './imported-model.js';
import {loadAsset,cachedAsset,trimAssetMemory} from './model-assets.js';

export function meshTriangles(root){
  root.updateMatrixWorld(true);const out=[],v=new THREE.Vector3();
  root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,index=o.geometry.index;for(let i=0;i<(index?index.count:p.count);i++){v.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(o.matrixWorld);out.push(v.x,v.y,v.z);}});return out;
}
export function disposeModel(root){root.traverse(o=>{o.geometry?.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material]))m?.dispose();});root.removeFromParent();}
export function buildAssetRoot(asset){
  const root=new THREE.Group();root.name=asset.name;root.userData.assetId=asset.id;
  for(const m of asset.meshes){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(m.positions,3));geometry.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({color:new THREE.Color(...m.color),roughness:.8,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geometry,material);mesh.name=m.name;mesh.userData.meshId=m.id;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  }
  return root;
}
export function createModelScene({scene,getState,getNative,onStatus=()=>{},onReady=()=>{}}){
  const root=new THREE.Group();root.name='Imported buildings';scene.add(root);
  const instances=new Map();let generation=0,isolated=null,selected=null,preview=null;
  async function sync(){
    const serial=++generation,m=normalizeImports(getState().imports),ids=new Set(m.items.map(x=>x.id));
    if(isolated&&isolated!=='native'&&!ids.has(isolated))isolated=null;
    for(const [id,obj]of instances)if(!ids.has(id)){disposeModel(obj);instances.delete(id);}
    const native=getNative();if(native){native.userData.baseVisible=m.nativeVisible&&(!isolated||isolated==='native');native.visible=native.userData.baseVisible;native.traverse(o=>{if(o.isMesh)o.castShadow=m.nativeRole!=='reference';});}
    for(const item of m.items){
      try{
        const asset=cachedAsset(item.assetId)||await loadAsset(item.assetId);if(serial!==generation)return;
        let obj=instances.get(item.id);
        if(obj?.userData.assetId!==item.assetId){if(obj)disposeModel(obj);obj=buildAssetRoot(asset);instances.set(item.id,obj);root.add(obj);}
        obj.position.fromArray(item.position);obj.rotation.y=item.rotation*Math.PI/180;obj.scale.setScalar(item.scale);obj.userData.baseVisible=item.visible&&(!isolated||isolated===item.id);obj.visible=obj.userData.baseVisible;obj.name=item.name;
        for(const mesh of obj.children){mesh.castShadow=item.role!=='reference';const selection=item.receivers[mesh.userData.meshId];mesh.material.emissive.set(item.id===selected?(selection?.type==='facade'?0x244a67:selection?.type==='roof'?0x58610b:0x000000):0x000000);}
      }catch(e){if(serial===generation)onStatus(e.message);}
    }
    if(serial===generation){trimAssetMemory(new Set(m.items.map(x=>x.assetId)));onReady();}
  }
  function bounds(id){const out=new THREE.Box3();if(id==='preview'&&preview)return out.setFromObject(preview);if(id==='native')return out.setFromObject(getNative());if(id)return instances.has(id)?out.setFromObject(instances.get(id)):out;if(getNative()?.visible)out.expandByObject(getNative());for(const obj of instances.values())if(obj.visible)out.expandByObject(obj);return out;}
  async function analysis(native,surface){
    const manifest=normalizeImports(getState().imports),target=manifest.items.find(m=>m.role==='target');
    const all=manifest.nativeRole!=='reference'?[...native]:[],assets=new Map();let triangles=all.length/9;
    for(const m of manifest.items){
      if(m.role==='reference')continue;
      const asset=await loadAsset(m.assetId);assets.set(m.id,asset);triangles+=asset.triangleCount;
      if(triangles>IMPORT_LIMITS.sceneTriangles)throw Error('Analysis scene exceeds 300,000 triangles. Simplify or exclude context models.');
      const t=transformedTriangles(asset,m).triangles;for(const v of t)all.push(v);
    }
    const provenance={version:1,models:importSignature(manifest),context:{...importSignature(manifest,{contextOnly:true}),nativeContextHash:manifest.nativeRole==='context'?await sha256(new Float64Array(native).buffer):null},receiverSelection:target?{assetId:target.assetId,receivers:target.receivers,method:'selected-mesh-v1'}:null,target:target?{modelId:target.id,name:target.name,assetId:target.assetId}: {modelId:'native',name:'FORM parametric building'},assets:[...assets.values()].map(a=>({id:a.id,name:a.name,format:a.format,schema:a.schema??null,sourceUnits:a.sourceUnits,sourceOrigin:a.sourceOrigin,coverage:a.coverage??null,warnings:a.warnings,parser:a.parser??'Three.js 0.180.0'}))};
    if(!target)return {target:native,all,imported:false,provenance,sources:null};
    if(surface==='ground')return {target:[],all,imported:true,provenance,sources:[]};
    if(!target.reviewed)throw Error('Review the imported building’s exterior receiver surfaces in Models and confirm the selection.');
    const selected=transformedTriangles(assets.get(target.id),target,{receiver:surface});
    if(!selected.triangles.length)throw Error('No selected '+surface+' surfaces have eligible outward normals. Review selection and normal direction in Models.');
    return {target:selected.triangles,all,imported:true,provenance,sources:selected.sources};
  }
  return {sync,bounds,analysis,root,asset:cachedAsset,
    preview(asset,position=[0,0,0]){if(preview)disposeModel(preview);preview=buildAssetRoot(asset);preview.position.fromArray(position);preview.traverse(o=>{if(o.isMesh)o.castShadow=false;});scene.add(preview);if(getNative())getNative().visible=false;for(const obj of instances.values())obj.visible=false;},
    clearPreview(){if(preview){disposeModel(preview);preview=null;}sync();},
    targetRoot(){const target=getState().imports?.items.find(m=>m.role==='target');return target?instances.get(target.id):getNative();},select(id){selected=id;sync();},isolate(id){isolated=isolated===id?null:id;sync();},getRoot:id=>instances.get(id)};
}
