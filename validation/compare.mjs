// Characterize errors; fixtures come from a Python process with no FORM imports.
import {readFileSync} from 'node:fs';
import {solarPosition,buildBVH} from '../dist/solar.js';
import {radiationSteps,irradiation,skyFactor} from '../dist/radiation.js';
const f=JSON.parse(readFileSync(new URL('../tests/fixtures/pvlib-radiation.json',import.meta.url))),empty=[],bvh=buildBVH(empty),rad=Math.PI/180;
const out={provenance:f.provenance,cases:[],obstructions:[],shaded:[]};
for(const c of f.cases){
 const steps=radiationSteps(c.records,c.settings);let angular=0;
 c.solar.forEach((r,i)=>{const a=r.altitude*rad,z=r.azimuth*rad,d=[Math.cos(a)*Math.sin(z),Math.sin(a),Math.cos(a)*Math.cos(z)];angular=Math.max(angular,Math.acos(Math.max(-1,Math.min(1,d.reduce((sum,v,j)=>sum+v*steps[i].direction[j],0))))/rad);});
 for(const r of c.expected){const t=r.tilt*rad,a=r.azimuth*rad,s={position:[0,0,0],normal:[Math.sin(t)*Math.sin(a),Math.cos(t),Math.sin(t)*Math.cos(a)]},v=irradiation(s,steps,empty,bvh);out.cases.push({case:c.name,surface:r.name,reference:r.total,form:v.total,error:v.total-r.total,directError:v.direct-r.direct,diffuseError:v.diffuse-r.diffuse,maxSunAngleError:angular});}
}
for(const c of f.obstructions)for(const patches of [512,2048,8192]){const actual=skyFactor({position:[0,0,0],normal:c.normal},c.triangles,buildBVH(c.triangles),patches);out.obstructions.push({case:c.name,patches,reference:c.expectedSky,form:actual,error:actual-c.expectedSky});}
for(const r of f.shaded.filter(r=>r.step!==1)){
 const c=f.cases.find(c=>c.name===r.case),o=f.obstructions.find(o=>o.name===r.obstruction),v=irradiation({position:[0,0,0],normal:o.normal},radiationSteps(c.records,{...c.settings,step:r.step}),o.triangles,buildBVH(o.triangles)),fine=f.shaded.find(s=>s.case===r.case&&s.obstruction===r.obstruction&&s.step===1);
 out.shaded.push({...r,referenceAtSameStep:r.total,referenceAtOneMinute:fine.total,form:v.total,errorAtSameStep:v.total-r.total,errorAtOneMinute:v.total-fine.total,directErrorAtSameStep:v.direct-r.direct});
}
console.log(JSON.stringify(out,null,2));
