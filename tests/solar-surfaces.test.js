import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../dist/vendor/three.module.js';
import {defaults,normalize,modelData,footprint} from '../dist/geometry.js';
import {envelopeMesh} from '../dist/envelope.js';
import {roofSurfaceTriangles} from '../dist/solar-surfaces.js';
import {sampleSurfaces,buildBVH,cross} from '../dist/solar.js';
import {irradiation,skyFactor} from '../dist/radiation.js';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
function mesh(s){const ctx=vm.createContext({THREE,modelData,footprint,envelopeMesh,mode:'mass',s});vm.runInContext(source.slice(source.indexOf('function geometry('),source.indexOf('function dispose('))+';var root=building(s,false,"mass");',ctx);const out=[];ctx.root.updateMatrixWorld(true);ctx.root.traverse(o=>{if(o.isMesh)out.push(...o.geometry.attributes.position.array);});return out;}
const state=overrides=>normalize({...defaults(),shape:'rectangle',width:20,depth:16,floors:10,storey:3,podium:false,modifiers:[],...overrides});
function area(tris){let sum=0;for(let i=0;i<tris.length;i+=9){const a=tris.slice(i,i+3),b=tris.slice(i+3,i+6),c=tris.slice(i+6,i+9);sum+=Math.hypot(...cross(b.map((v,j)=>v-a[j]),c.map((v,j)=>v-a[j])))/2;}return sum;}

test('actual ten-storey box samples only the exterior roof, with sky factor one',()=>{
 const s=state(),t=mesh(s),roof=roofSurfaceTriangles(t,s),samples=sampleSurfaces(roof,'roof',40),bvh=buildBVH(t);
 assert.ok(Math.abs(area(roof)-320)<1e-5);assert.equal(samples.length,40);
 for(const p of samples){assert.ok(Math.abs(p.position[1]-30)<1e-6);assert.equal(skyFactor(p,t,bvh),1);const v=irradiation(p,[{direction:[0,1,0],altitude:90,hours:1,dni:800,dhi:100}],t,bvh);assert.equal(v.total,.9);}
});
test('podium and setback terraces remain exterior roof candidates',()=>{
 for(const s of [state({podium:true,podiumWidth:30,podiumDepth:24,podiumFloors:2}),state({modifiers:[{id:'set',enabled:true,type:'setback',value:30,start:5,end:10}]})]){
  const roof=roofSurfaceTriangles(mesh(s),s),samples=sampleSurfaces(roof,'roof',100),top=modelData(s).height;
  assert.ok(samples.some(p=>p.position[1]<top-1));assert.ok(samples.some(p=>Math.abs(p.position[1]-top)<1e-4));
  assert.ok(Math.abs(area(roof)-(s.podium?s.podiumWidth*s.podiumDepth:320))<1e-3,JSON.stringify({podium:s.podium,area:area(roof)}));
 }
});
test('shaded exterior balconies are retained; roof eligibility is not a sky-visibility test',()=>{
 const s=state({modifiers:[{id:'b',enabled:true,type:'balcony',start:2,end:9,value:2,side:'all',every:1}]}),t=mesh(s),roof=roofSurfaceTriangles(t,s),samples=sampleSurfaces(roof,'roof',40),bvh=buildBVH(t);
 const low=samples.filter(p=>p.position[1]<modelData(s).height-1);assert.ok(low.length>0);assert.ok(low.some(p=>skyFactor(p,t,bvh)<.5));
});
test('atrium void is preserved and enclosed floors are excluded',()=>{
 const s=state({modifiers:[{id:'a',enabled:true,type:'atrium',start:1,end:10,value:6,depth:6,shape:'rectangle',x:0,y:0}]}),roof=roofSurfaceTriangles(mesh(s),s),samples=sampleSurfaces(roof,'roof',50);
 assert.ok(Math.abs(area(roof)-(320-36))<1e-4);assert.ok(samples.every(p=>p.position[1]>29.99));assert.ok(samples.every(p=>Math.abs(p.position[0])>=3||Math.abs(p.position[2])>=3));
});
