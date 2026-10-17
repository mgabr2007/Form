import test from 'node:test';import assert from 'node:assert/strict';
import {solarPosition,solarSettings,sunSteps,buildBVH,blocked,sunlightHours,sampleSurfaces} from '../public/solar.js';
import {normalize,defaults} from '../public/geometry.js';
test('equatorial equinox sun rises east, peaks near zenith and sets west',()=>{
 const a=solarPosition('2026-03-20',9,0,0),b=solarPosition('2026-03-20',12,0,0),c=solarPosition('2026-03-20',15,0,0);assert.ok(a.azimuth>85&&a.azimuth<95);assert.ok(b.altitude>87);assert.ok(c.azimuth>265&&c.azimuth<275);assert.ok(solarPosition('2026-03-20',0,0,0).altitude<0);
});
test('longitude/timezone corrections and north rotation use stated conventions',()=>{
 const a=solarPosition('2026-06-21',12,30,30,2),b=solarPosition('2026-06-21',10,30,30,0);assert.ok(Math.abs(a.altitude-b.altitude)<1e-10);const c=solarPosition('2026-06-21',12,30,30,2,90);assert.ok(Math.abs(c.direction[0]-a.direction[2])<1e-10);assert.ok(Math.abs(c.direction[2]+a.direction[0])<1e-10);
});
test('sun vectors are normalized and polar day/night is finite',()=>{
 for(const date of ['2026-06-21','2026-12-21'])for(const lat of [-89,0,89]){const p=solarPosition(date,12,lat,0);assert.ok(Math.abs(Math.hypot(...p.direction)-1)<1e-10);assert.ok(Number.isFinite(p.azimuth));}
 assert.equal(sunSteps(solarSettings({date:'2026-12-21',lat:89,lon:0,utc:0})).length,0);assert.equal(sunSteps(solarSettings({date:'2026-06-21',lat:89,lon:0,utc:0})).reduce((a,s)=>a+s.hours,0),24);
});
test('ray intersections are double-sided and reject obstacles behind the ray',()=>{
 const t=new Float64Array([-10,5,-10,10,5,-10,10,5,10,-10,5,-10,10,5,10,-10,5,10]),b=buildBVH(t);assert.equal(blocked([0,0,0],[0,1,0],t,b),true);assert.equal(blocked([0,6,0],[0,1,0],t,b),false);assert.equal(blocked([20,0,0],[0,1,0],t,b),false);
});
test('exposure counts visible hours, excludes back-facing samples and shade',()=>{
 const empty=new Float64Array(),b=buildBVH(empty),steps=[{direction:[0,1,0],hours:.5},{direction:[0,1,0],hours:.5}],sample={position:[0,0,0],normal:[0,1,0]};assert.equal(sunlightHours(sample,steps,empty,b),1);assert.equal(sunlightHours({...sample,normal:[0,-1,0]},steps,empty,b),0);
 const t=new Float64Array([-10,5,-10,10,5,-10,10,5,10,-10,5,-10,10,5,10,-10,5,10]);assert.equal(sunlightHours(sample,steps,t,buildBVH(t)),0);
});
test('surface sampling separates upward roofs and vertical faces',()=>{
 const roof=[0,1,0,0,1,10,10,1,0],wall=[0,0,0,0,10,0,10,0,0],t=[...roof,...wall];assert.equal(sampleSurfaces(t,'roof',20).length,20);assert.ok(sampleSurfaces(t,'roof',20).every(s=>s.normal[1]>.7));assert.ok(sampleSurfaces(t,'facade',20).every(s=>Math.abs(s.normal[1])<.1));
});
test('solar settings and context survive project export/import and clamp unsafe inputs',()=>{
 const settings=solarSettings({lat:200,utc:3,context:[{x:70,y:0,width:30,depth:20,height:100}],enabled:true});assert.equal(settings.lat,89);assert.deepEqual(normalize({...defaults(),solar:settings}).solar,settings);
});
