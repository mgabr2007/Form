import fs from 'node:fs';
import * as THREE from '../../dist/vendor/three.module.js';
import {defaults} from '../../dist/geometry.js';
import {exportIFC} from '../../dist/ifc.js';
const dir=new URL('../../tests/fixtures/imports/',import.meta.url);
const RealDate=globalThis.Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-10-17T00:00:00.000Z']));}static now(){return 1792195200000;}};
export function glbFromMeshes(meshes,nodes){
 const chunks=[],bufferViews=[],accessors=[];let length=0;
 const json={asset:{version:'2.0',generator:'FORM import validation synthetic fixtures'},scene:0,scenes:[{nodes:nodes? [0]:meshes.map((_,i)=>i)}],nodes:nodes||meshes.map((m,i)=>({mesh:i,name:m.name})),meshes:meshes.map(m=>{
 const p=new Float32Array(m.positions);chunks.push(new Uint8Array(p.buffer));bufferViews.push({buffer:0,byteOffset:length,byteLength:p.byteLength});length+=p.byteLength;
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.length;i++){min[i%3]=Math.min(min[i%3],p[i]);max[i%3]=Math.max(max[i%3],p[i]);}
 accessors.push({bufferView:bufferViews.length-1,componentType:5126,count:p.length/3,type:'VEC3',min,max});return {name:m.name,primitives:[{attributes:{POSITION:accessors.length-1}}]};}),buffers:[{byteLength:0}],bufferViews,accessors};
 json.buffers[0].byteLength=length;
 const encoded=Buffer.from(JSON.stringify(json)),pad=Math.ceil(encoded.length/4)*4,out=Buffer.alloc(12+8+pad+8+length,0);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(pad,12);out.writeUInt32LE(0x4e4f534a,16);out.fill(32,20,20+pad);encoded.copy(out,20);out.writeUInt32LE(length,20+pad);out.writeUInt32LE(0x004e4942,24+pad);let offset=28+pad;for(const c of chunks){out.set(c,offset);offset+=c.length;}return out;
}
const box=new THREE.BoxGeometry(12,12,12).translate(0,6,0).toNonIndexed(),p=box.attributes.position.array;
const faces=['East','West','Roof','Base','North','South'].map((name,i)=>({name,positions:Array.from(p.slice(i*18,i*18+18))}));
fs.writeFileSync(new URL('envelope.glb',dir),glbFromMeshes(faces));
const context=new THREE.BoxGeometry(10,20,10).translate(15,10,0).toNonIndexed();
fs.writeFileSync(new URL('context-box.glb',dir),glbFromMeshes([{name:'Context box',positions:Array.from(context.attributes.position.array)}]));
fs.writeFileSync(new URL('nested-transform.glb',dir),glbFromMeshes([{name:'Transform cube',positions:Array.from(new THREE.BoxGeometry(2,2,2).toNonIndexed().attributes.position.array)}],[{name:'Parent',translation:[100,20,-50],rotation:[0,Math.sin(Math.PI/4),0,Math.cos(Math.PI/4)],children:[1]},{name:'Mirrored child',mesh:0,scale:[-2,3,4]}]));
fs.writeFileSync(new URL('form-ifc4.ifc',dir),exportIFC({...defaults(),name:'Known 12 metre synthetic building',shape:'rectangle',width:12,depth:12,floors:4,storey:3,podium:false,modifiers:[]}));
fs.writeFileSync(new URL('invalid.glb',dir),Buffer.from('Invalid GLB fixture'));
fs.writeFileSync(new URL('known-geometry.json',dir),JSON.stringify({envelope:{bounds:{min:[-6,0,-6],max:[6,12,6]},triangles:12},context:{bounds:{min:[10,0,-5],max:[20,20,5]}}},null,2)+'\n');

fs.writeFileSync(new URL('form-millimetres.ifc',dir),exportIFC({...defaults(),name:'Synthetic millimetre fixture',shape:'rectangle',width:12000,depth:8000,floors:4,storey:3000,podium:false,modifiers:[]}).replace("IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)","IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)"));
globalThis.Date=RealDate;
