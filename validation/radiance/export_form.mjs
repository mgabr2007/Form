import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildBVH,rayOrigin,RAY_OFFSET_METRES} from '../../public/solar.js';
import {irradiation,radiationSteps,skyFactor,IRRADIATION_METHOD_VERSION} from '../../public/radiation.js';
import {facadeGrid} from '../../public/facade-grid.js';
const dir=new URL('./',import.meta.url),spec=JSON.parse(fs.readFileSync(new URL('scenes.json',dir))),fixture=JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/pvlib-radiation.json',import.meta.url)));
function boxTriangles(box){
 const [x0,y0,z0]=box.min,[x1,y1,z1]=box.max;
 const v=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
 return [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]].flatMap(q=>[q[0],q[1],q[2],q[0],q[2],q[3]].flatMap(i=>v[i]));
}
const days=fixture.cases.filter(c=>['Berlin_summer','Berlin_winter','Cairo_summer','Cairo_winter'].includes(c.name));
const out={baseline:'39918542251086992b778c945447a26b282d439e',method:IRRADIATION_METHOD_VERSION,rayOffset:RAY_OFFSET_METRES,node:process.version,protocolSHA256:crypto.createHash('sha256').update(fs.readFileSync(new URL('PROTOCOL.md',dir))).digest('hex'),scenes:[],days:days.map(c=>({name:c.name,settings:c.settings,records:c.records,steps:Object.fromEntries([1,5,15,30,60].map(step=>[step,radiationSteps(c.records,{...c.settings,step},60)]))}))};
for(const scene of spec.scenes){
 const triangles=scene.boxes.flatMap(boxTriangles),tree=buildBVH(triangles),sensors=scene.sensors.map(s=>({...s,origin:rayOrigin(s),sky:Object.fromEntries([512,2048,8192].map(n=>[n,skyFactor(s,triangles,tree,n)]))}));
 const daily=[];
 for(const d of out.days)for(const s of sensors)for(const step of [1,5,15,30,60]){const c=irradiation(s,d.steps[step],triangles,tree,2048);daily.push({day:d.name,sensor:s.id,step,...c});}
 const grids=[];
 for(const spacing of [4,2,1]){
  const p=scene.probe,[x0,x1]=p.x,[y0,y1]=p.height,z=p.z,face=[x0,y0,z,x0,y1,z,x1,y1,z,x0,y0,z,x1,y1,z,x1,y0,z];
  const samples=facadeGrid(face,spacing,spacing).samples;
  const d=out.days.find(d=>d.name==='Cairo_summer'),values=samples.map(s=>irradiation(s,d.steps[5],triangles,tree,2048).total);
  grids.push({spacing,samples:samples.map(s=>({...s,origin:rayOrigin(s)})),values,mean:values.reduce((a,b)=>a+b,0)/values.length});
 }
 out.scenes.push({...scene,triangles,sensors,daily,grids});
}
fs.writeFileSync(new URL('form-inputs.json',dir),JSON.stringify(out)+'\n');
console.log(`Exported ${out.scenes.length} scenes, ${out.scenes.reduce((n,s)=>n+s.sensors.length,0)} fixed sensors, ${out.days.length} synthetic days.`);
