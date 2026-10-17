import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTMY,tmyDay,parseOpenWeatherSolar} from '../public/weather-data.js';
import {radiationSteps} from '../public/radiation.js';
import {weatherAPI} from '../server/weather.js';
const settings={date:'2026-01-01',utc:5.5,lat:30,lon:31,step:30,north:0};
function fixture(){return{inputs:{location:{latitude:30,longitude:31,irradiance_time_offset:.5},meteo_data:{radiation_db:'ERA5'}},outputs:{months_selected:[],tmy_hourly:Array.from({length:8760},(_,i)=>{const t=new Date(Date.UTC(2001,0,1)+i*3600000).toISOString();return{'time(UTC)':t.slice(0,10).replaceAll('-','')+':'+t.slice(11,16).replace(':',''),T2m:20,RH:50,'G(h)':100,'Gb(n)':80,'Gd(h)':20,'IR(h)':300,WS10m:2,WD10m:90,SP:101325};})}};}
test('TMY accepts complete year, rejects missing, duplicate and invalid radiation',()=>{const f=fixture();assert.equal(parseTMY(f).rows.length,8760);f.outputs.tmy_hourly.pop();assert.throws(()=>parseTMY(f));const d=fixture();d.outputs.tmy_hourly[10]=d.outputs.tmy_hourly[9];assert.throws(()=>parseTMY(d));const b=fixture();b.outputs.tmy_hourly[0]['Gb(n)']=null;assert.throws(()=>parseTMY(b));});
test('TMY day handles fractional UTC and year boundary, energy and solar offset',()=>{const t=parseTMY(fixture()),w=tmyDay(t,settings);assert.equal(w.records.length,25);assert.equal(w.records.reduce((s,r)=>s+r.end-r.start,0),86400);assert.ok(Math.abs(w.ghi-2.4)<1e-9);assert.equal(w.records[0].sourceTime,'20011231:1800');const steps=radiationSteps(w.records,settings);assert.equal(steps.length,25);assert.equal(steps.reduce((s,r)=>s+r.hours,0),24);assert.throws(()=>tmyDay(t,{...settings,date:'2024-02-29'}));});
test('OpenWeather uses average cloudy irradiance, full hour duration and rejects incomplete data',()=>{const d={date:settings.date,interval:'1h',tz:'+05:30',intervals:Array.from({length:24},(_,i)=>({start:String(i).padStart(2,'0')+':00',end:String(i).padStart(2,'0')+':59',avg_irradiance:{cloudy_sky:{ghi:100,dni:80,dhi:20}}}))};const w=parseOpenWeatherSolar(d,settings);assert.ok(Math.abs(w.ghi-2.4)<1e-9);assert.equal(w.records[23].end-w.records[0].start,86400);d.tz='+00:00';assert.throws(()=>parseOpenWeatherSolar(d,settings));});
test('paid routes deny anonymous users, status never returns secret, validation precedes fetch',async()=>{const env={'Form-ChatGPT':'test-secret'};let r=await weatherAPI(new Request('https://example.org/api/weather/solar?lat=30&lon=31'),env);assert.equal(r.status,403);r=await weatherAPI(new Request('https://example.org/api/weather/status'),env);assert.equal((await r.text()).includes('test-secret'),false);r=await weatherAPI(new Request('https://example.org/api/weather/tmy?lat=bad&lon=31'),env);assert.equal(r.status,502);});
test('provider pagination URLs and key are never returned',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({lat:30,lon:31,current:{temp:24},next:'https://api.openweathermap.org/?appid=test-secret'});try{const r=await weatherAPI(new Request('https://example.org/api/weather/current?lat=30&lon=31',{headers:{'oai-authenticated-user-email':'m.gabr@aucegypt.edu'}}),{'Form-ChatGPT':'test-secret'});assert.equal(r.status,200);const text=await r.text();assert.ok(!text.includes('test-secret'));assert.ok(!text.includes('next'));}finally{globalThis.fetch=original;}});

test('negative ancillary wind does not discard valid solar data; issue remains traceable',()=>{
 const f=fixture();f.outputs.tmy_hourly[751].WS10m=-.21;
 const t=parseTMY(f);assert.equal(t.rows.length,8760);
 assert.equal(t.rows[751].windSpeed,null);
 assert.equal(t.raw.outputs.tmy_hourly[751].WS10m,-.21);
 assert.equal(t.qualityIssues[0].rawValue,-.21);
 assert.equal(t.qualityIssues[0].sourceTime,f.outputs.tmy_hourly[751]['time(UTC)']);
 assert.deepEqual(tmyDay(t,settings).provenance.qualityIssues,t.qualityIssues);
 f.outputs.tmy_hourly[751]['Gb(n)']=-.21;assert.throws(()=>parseTMY(f),/DNI/);
});
