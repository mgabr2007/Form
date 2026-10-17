import fs from 'node:fs';
import {facadeGrid} from '../../dist/facade-grid.js';
import {buildBVH,rayOrigin} from '../../dist/solar.js';
import {radiationSteps,irradiation,skyFactor,DEFAULT_SKY_PATCHES,IRRADIATION_METHOD_VERSION} from '../../dist/radiation.js';
const spec=JSON.parse(fs.readFileSync(new URL('../radiance/scenes.json',import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/pvlib-radiation.json',import.meta.url)));
function boxTriangles(box){
 const [x0,y0,z0]=box.min,[x1,y1,z1]=box.max;
 const v=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
 return [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]].flatMap(q=>[q[0],q[1],q[2],q[0],q[2],q[3]].flatMap(i=>v[i]));
}
const prior={days:fixture.cases.filter(d=>['Berlin_summer','Berlin_winter','Cairo_summer','Cairo_winter'].includes(d.name)),scenes:spec.scenes.map(c=>({...c,triangles:c.boxes.flatMap(boxTriangles)}))};
const out={method:IRRADIATION_METHOD_VERSION,skyDirections:DEFAULT_SKY_PATCHES,days:prior.days.map(d=>({...d,steps:Object.fromEntries([.25,.5,1,5].map(step=>[step,radiationSteps(d.records,{...d.settings,step},60)]))})),scenes:[]};
for(const c of prior.scenes){
 const bvh=buildBVH(c.triangles),sensors=c.sensors.map(s=>({...s,origin:rayOrigin(s),sky:skyFactor(s,c.triangles,bvh)})),daily=[];
 for(const day of out.days)for(const s of sensors){const beam=irradiation(s,day.steps[1],c.triangles,bvh);daily.push({day:day.name,sensor:s.id,...beam});}
 const grids=[];const day=out.days.find(d=>d.name==='Cairo_summer');
 for(const spacing of [4,2,1,.5,.25]){
  const p=c.probe,[x0,x1]=p.x,[y0,y1]=p.height,z=p.z,face=[x0,y0,z,x0,y1,z,x1,y1,z,x0,y0,z,x1,y1,z,x1,y0,z];
  const samples=facadeGrid(face,spacing,spacing).samples,values=samples.map(s=>irradiation(s,day.steps[1],c.triangles,bvh).total);
  grids.push({spacing,count:samples.length,mean:values.reduce((a,b)=>a+b,0)/values.length});
 }
 out.scenes.push({id:c.id,sensors,daily,grids});console.log(c.id,grids);
}
fs.writeFileSync(new URL('inputs.json',import.meta.url),JSON.stringify(out));
