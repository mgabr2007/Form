import fs from 'node:fs';import assert from 'node:assert/strict';
import {buildBVH} from '../../public/solar.js';import {irradiation,radiationSteps,skyFactor,DEFAULT_SKY_PATCHES} from '../../public/radiation.js';
import {facadeGrid} from '../../public/facade-grid.js';
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url)));
const decoded=read('./decoded-scenes.json'),spec=read('../radiance/scenes.json'),reference=read('../release/results.json'),fixture=read('../../tests/fixtures/pvlib-radiation.json');
const days=fixture.cases.filter(d=>['Berlin_summer','Berlin_winter','Cairo_summer','Cairo_winter'].includes(d.name));
const results={reference:'Archived native Radiance results, validation/release/results.json; no new reference-engine run',daily:[],sky:[],temporal:[],spatial:[],skySensitivity:[],geometry:[]};
for(const scene of spec.scenes){
 const d=decoded.find(x=>x.id===scene.id),triangles=d.triangles,tree=buildBVH(triangles);
 let boundError=0;for(let i=0;i<scene.boxes.length;i++){const mesh=d.meshBounds[i],box=scene.boxes[i];for(let k=0;k<3;k++)boundError=Math.max(boundError,Math.abs(mesh.min[k]-box.min[k]),Math.abs(mesh.max[k]-box.max[k]));}
 results.geometry.push({scene:scene.id,maxBoundingCoordinateError:boundError,pass:boundError<=1e-5});assert.ok(boundError<=1e-5);
 for(const sensor of scene.sensors){
  const value=skyFactor(sensor,triangles,tree,DEFAULT_SKY_PATCHES),ref=reference.sky.find(r=>r.scene===scene.id&&r.sensor===sensor.id).reference,error=value-ref;
  results.sky.push({scene:scene.id,sensor:sensor.id,value,reference:ref,error,pass:Math.abs(error)<=.005});
  results.skySensitivity.push({scene:scene.id,sensor:sensor.id,values:Object.fromEntries([512,2048,8192].map(n=>[n,skyFactor(sensor,triangles,tree,n)]))});
  for(const day of days){
   const components=irradiation(sensor,radiationSteps(day.records,{...day.settings,step:1}),triangles,tree),value=components.total,ref=reference.daily.find(r=>r.scene===scene.id&&r.sensor===sensor.id&&r.day===day.name).reference,error=value-ref;
   results.daily.push({scene:scene.id,sensor:sensor.id,day:day.name,...components,reference:ref,error,pass:Math.abs(error)<=Math.max(.02,.02*ref)});
   const fine=irradiation(sensor,radiationSteps(day.records,{...day.settings,step:.25}),triangles,tree).total,change=value-fine;
   results.temporal.push({scene:scene.id,sensor:sensor.id,day:day.name,oneMinute:value,fifteenSeconds:fine,change,pass:Math.abs(change)<=Math.max(.01,.01*fine)});
  }
 }
 const day=days.find(d=>d.name==='Cairo_summer'),p=scene.probe,[x0,x1]=p.x,[y0,y1]=p.height,z=p.z,face=[x0,y0,z,x0,y1,z,x1,y1,z,x0,y0,z,x1,y1,z,x1,y0,z],steps=radiationSteps(day.records,{...day.settings,step:1});
 const grids=[1,.5,.25].map(spacing=>{const samples=facadeGrid(face,spacing,spacing).samples,values=samples.map(s=>irradiation(s,steps,triangles,tree).total);return {spacing,count:samples.length,mean:values.reduce((a,b)=>a+b,0)/values.length};});
 const fine=grids.at(-1).mean;results.spatial.push({scene:scene.id,grids,halfMetreChange:grids[1].mean-fine,pass:Math.abs(grids[1].mean-fine)<=Math.max(.01,.01*fine)});
 console.log(scene.id);
}
results.summary=Object.fromEntries(['geometry','daily','sky','temporal','spatial'].map(k=>[k,{passed:results[k].filter(r=>r.pass).length,cases:results[k].length}]));
results.summary.daily.maxAbsoluteError=Math.max(...results.daily.map(r=>Math.abs(r.error)));results.summary.sky.maxAbsoluteError=Math.max(...results.sky.map(r=>Math.abs(r.error)));
fs.writeFileSync(new URL('./numerical-results.json',import.meta.url),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results.summary,null,2));assert.ok(Object.values(results.summary).every(s=>s.passed===s.cases));
