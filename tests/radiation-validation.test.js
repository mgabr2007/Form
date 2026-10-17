import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildBVH,solarPosition} from '../dist/solar.js';
import {irradiation,radiationSteps as productionRadiationSteps,skyFactor} from '../dist/radiation.js';
const radiationSteps=(records,settings)=>productionRadiationSteps(records,settings,60);
const fixture=JSON.parse(readFileSync(new URL('./fixtures/pvlib-radiation.json',import.meta.url))),empty=[],bvh=buildBVH(empty),rad=Math.PI/180;
const vector=(alt,az)=>[Math.cos(alt*rad)*Math.sin(az*rad),Math.sin(alt*rad),Math.cos(alt*rad)*Math.cos(az*rad)];
const sample=r=>({position:[0,0,0],normal:vector(90-r.tilt,r.azimuth)});
const close=(a,b,tol,label)=>assert.ok(Math.abs(a-b)<=tol,`${label}: ${a} versus ${b}, tolerance ${tol}`);

test('independent pvlib transposition: roof, cardinal facades and tilt, 10 dates/locations',()=>{
 for(const c of fixture.cases){
  const steps=radiationSteps(c.records,c.settings).map((s,i)=>({...s,altitude:c.solar[i].altitude,direction:vector(c.solar[i].altitude,c.solar[i].azimuth)}));
  for(const expected of c.expected){const actual=irradiation(sample(expected),steps,empty,bvh);
   for(const key of ['direct','diffuse','total'])close(actual[key],expected[key],1e-11,`${c.name}/${expected.name}/${key}`);
  }
 }
});

test('end-to-end NOAA vs SPA characterization envelope (not a field accuracy criterion)',()=>{
 for(const c of fixture.cases){const steps=radiationSteps(c.records,c.settings);
  c.solar.forEach((s,i)=>{const ref=vector(s.altitude,s.azimuth),cos=ref.reduce((sum,v,k)=>sum+v*steps[i].direction[k],0),angle=Math.acos(Math.max(-1,Math.min(1,cos)))/rad;
   assert.ok(angle<.02,`${c.name}: geometric sun vector differs by ${angle} degrees`);
  });
  for(const expected of c.expected){const actual=irradiation(sample(expected),steps,empty,bvh);
   // Engineering regression budgets for these synthetic cases, not a universal
   // accuracy specification. Absolute bound protects low-energy surfaces.
   close(actual.total,expected.total,.002,`${c.name}/${expected.name}`);
   if(expected.total>.5)close(actual.total,expected.total,.005*expected.total,`${c.name}/${expected.name} 0.5%`);
  }
 }
});

test('finite canopy/overhang diffuse factors match independent projected-area quadrature',()=>{
 for(const c of fixture.obstructions){const s={position:[0,0,0],normal:c.normal},b=buildBVH(c.triangles);
  close(skyFactor(s,c.triangles,b,2048),c.expectedSky,.005,`${c.name} 2048`);
  close(skyFactor(s,c.triangles,b,8192),c.expectedSky,.003,`${c.name} 8192`);
 }
});

test('obstructed daily beam agrees with independent rectangle intersection using identical SPA directions',()=>{
 for(const c of fixture.cases.slice(0,3)){const steps=radiationSteps(c.records,c.settings).map((s,i)=>({...s,altitude:c.solar[i].altitude,direction:vector(c.solar[i].altitude,c.solar[i].azimuth)}));
  for(const o of fixture.obstructions){const expected=fixture.shaded.find(r=>r.case===c.name&&r.obstruction===o.name&&r.step===15),actual=irradiation({position:[0,0,0],normal:o.normal},steps,o.triangles,buildBVH(o.triangles));
   close(actual.direct,expected.direct,1e-10,`${c.name}/${o.name} beam`);
   close(actual.diffuse,expected.diffuse,.01,`${c.name}/${o.name} diffuse`);
  }
 }
});
test('end-to-end shaded cases stay within 0.01 kWh/m² of matched-resolution independent references',()=>{
 for(const r of fixture.shaded){const c=fixture.cases.find(c=>c.name===r.case),o=fixture.obstructions.find(o=>o.name===r.obstruction),v=irradiation({position:[0,0,0],normal:o.normal},radiationSteps(c.records,{...c.settings,step:r.step}),o.triangles,buildBVH(o.triangles));
  close(v.total,r.total,.01,`${r.case}/${r.obstruction}/${r.step} minutes`);
 }
});

test('Cairo summer cardinal facades do not collapse to a common radiation value',()=>{
 const c=fixture.cases.find(c=>c.name==='Cairo_summer'),steps=radiationSteps(c.records,c.settings),values=Object.fromEntries(c.expected.map(r=>[r.name,irradiation(sample(r),steps,empty,bvh).total]));
 assert.ok(values.east>values.south+.5);assert.ok(values.west>values.south+.5);assert.ok(values.roof>values.east);assert.ok(Math.abs(values.east-values.west)<.2);
});

test('same UTC instant is invariant to local time notation across year/leap rollover',()=>{
 for(const [date,hour,utc,utcDate,utcHour] of [['2026-01-01',1,5.75,'2025-12-31',19.25],['2024-03-01',1,3,'2024-02-29',22],['2026-06-21',12,2,'2026-06-21',10]]){
  const a=solarPosition(date,hour,30,31,utc),b=solarPosition(utcDate,utcHour,30,31,0);
  a.direction.forEach((v,i)=>close(v,b.direction[i],1e-12,'UTC identity'));
 }
});

test('rotating true north and the facade together preserves beam incidence',()=>{
 const c=fixture.cases[4],base=radiationSteps(c.records,c.settings),rot=radiationSteps(c.records,{...c.settings,north:73}),a=73*rad;
 const n=[.6,0,.8],turned=[n[0]*Math.cos(a)+n[2]*Math.sin(a),0,-n[0]*Math.sin(a)+n[2]*Math.cos(a)];
 const x=irradiation({position:[0,0,0],normal:n},base,empty,bvh),y=irradiation({position:[0,0,0],normal:turned},rot,empty,bvh);
 close(x.total,y.total,1e-12,'rotated energy');
});
