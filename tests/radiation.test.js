import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBVH} from '../dist/solar.js';
import {skyFactor,irradiation,parseRadiation,dayWindow,radiationSteps} from '../dist/radiation.js';
const empty=new Float64Array(),bvh=buildBVH(empty),sample=normal=>({position:[0,0,0],normal});
test('unobstructed isotropic sky matches analytic tilt factors',()=>{for(const n of [[0,1,0],[1,0,0],[0,.5,Math.sqrt(.75)]])assert.ok(Math.abs(skyFactor(sample(n),empty,bvh)-(1+n[1])/2)<1e-12);});
test('one hour beam normal and diffuse integrate W/m² to kWh/m²',()=>{const c=irradiation(sample([0,1,0]),[{direction:[0,1,0],altitude:90,hours:1,dni:800,dhi:100}],empty,bvh);assert.equal(c.direct,.8);assert.equal(c.diffuse,.1);assert.equal(c.total,.9);});
test('beam incidence and back facing surfaces',()=>{const step={direction:[Math.sqrt(.75),.5,0],altitude:30,hours:1,dni:800,dhi:100};assert.equal(irradiation(sample([0,1,0]),[step],empty,bvh).direct,.4);const c=irradiation(sample([-1,0,0]),[step],empty,bvh);assert.equal(c.direct,0);assert.equal(c.diffuse,.05);});
test('opaque overhead plane blocks beam and reduces diffuse',()=>{const t=new Float64Array([-100,1,-100,100,1,-100,100,1,100,-100,1,-100,100,1,100,-100,1,100]);const c=irradiation(sample([0,1,0]),[{direction:[0,1,0],altitude:90,hours:1,dni:800,dhi:100}],t,buildBVH(t));assert.equal(c.direct,0);assert.ok(c.diffuse<.001);});
function fixture(settings){const {start,end}=dayWindow(settings),time=[];for(let t=Math.floor(start/3600)*3600;t<=end+3600;t+=3600)time.push(t);const names=['shortwave_radiation','direct_normal_irradiance','diffuse_radiation'];return{hourly:{time,...Object.fromEntries(names.map(n=>[n,time.map(()=>100)]))},hourly_units:Object.fromEntries(names.map(n=>[n,'W/m²']))};}
test('preceding-hour intervals cover fixed local day and fractional UTC offsets',()=>{for(const utc of [-5,0,2,5.5,5.75]){const s={date:'2026-06-21',utc},r=parseRadiation(fixture(s),s),w=dayWindow(s);assert.equal(r[0].start,w.start);assert.equal(r.at(-1).end,w.end);assert.equal(r.reduce((v,x)=>v+x.end-x.start,0),86400);}});
test('missing values and incomplete coverage fail rather than become zero',()=>{const s={date:'2026-06-21',utc:0};let f=fixture(s);f.hourly.diffuse_radiation[5]=null;assert.throws(()=>parseRadiation(f,s),/missing/);f=fixture(s);f.hourly.time.pop();f.hourly.time.pop();assert.throws(()=>parseRadiation(f,s),/complete/);});
test('sun geometry uses UTC midpoint and substeps preserve duration',()=>{const s={date:'2026-06-21',utc:2,lat:30,lon:31,north:0,step:15},records=parseRadiation(fixture(s),s),steps=radiationSteps(records,s);assert.equal(steps.length,96);assert.equal(steps.reduce((n,s)=>n+s.hours,0),24);assert.ok(steps.every(s=>Number.isFinite(s.altitude)));});
test('centimetre-scale obstruction is not skipped by the self-intersection offset',()=>{
 const t=new Float64Array([-100,.01,-100,100,.01,-100,100,.01,100,-100,.01,-100,100,.01,100,-100,.01,100]);
 const c=irradiation(sample([0,1,0]),[{direction:[0,1,0],altitude:90,hours:1,dni:800,dhi:100}],t,buildBVH(t));
 assert.equal(c.direct,0);assert.equal(c.diffuse,0);
});
test('invalid time steps and intervals fail rather than loop indefinitely',()=>{
 for(const step of [0,-1,NaN,Infinity])assert.throws(()=>radiationSteps([{start:0,end:3600,dni:1,dhi:1}],{step}),/positive/);
 for(const r of [{start:0,end:0,dni:1,dhi:1},{start:0,end:Infinity,dni:1,dhi:1},{start:0,end:3600,dni:NaN,dhi:1}])assert.throws(()=>radiationSteps([r],{step:15}),/interval/);
});
test('duplicate intervals, invalid units and out-of-order weather are rejected',()=>{
 const s={date:'2026-06-21',utc:0};let f=fixture(s);f.hourly.time[6]=f.hourly.time[5];assert.throws(()=>parseRadiation(f,s),/gap|duplicate/);
 f=fixture(s);f.hourly_units.diffuse_radiation='Wh/m²';assert.throws(()=>parseRadiation(f,s),/W\/m²/);
 f=fixture(s);[f.hourly.time[5],f.hourly.time[6]]=[f.hourly.time[6],f.hourly.time[5]];assert.throws(()=>parseRadiation(f,s),/gap|duplicate/);
});
test('subdivision conserves diffuse energy for non-integer UTC offsets',()=>{
 const s={date:'2026-06-21',utc:5.75,lat:30,lon:31,north:0},records=parseRadiation(fixture(s),s);
 for(const step of [1,15,30,60]){const steps=radiationSteps(records,{...s,step});assert.equal(steps.reduce((v,s)=>v+s.hours,0).toFixed(9),'24.000000000');assert.ok(Math.abs(irradiation(sample([0,1,0]),steps,empty,bvh).diffuse-2.4)<1e-11);}
});
