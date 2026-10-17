import test from 'node:test';
import assert from 'node:assert/strict';
import {periodDates,periodWindow} from '../public/analysis-period.js';
import {solarSettings,sunSteps} from '../public/solar.js';
import {analysisKey,preflight} from '../public/solar-workflow.js';
import {fetchPeriodWeather} from '../public/weather-data.js';
import {dayWindow} from '../public/radiation.js';
const base=solarSettings({date:'2026-03-20',lat:0,lon:0,utc:0});
const duration=steps=>steps.reduce((sum,s)=>sum+s.hours,0);
test('one hour, inclusive range and whole year have exact durations',()=>{
 assert.equal(periodWindow({...base,period:'hour',analysisHour:23}).end-periodWindow({...base,period:'hour',analysisHour:23}).start,3600);
 assert.equal(periodDates({...base,period:'range',endDate:'2026-03-21'}).length,2);
 assert.equal(periodDates({...base,period:'range',date:'2026-01-01',endDate:'2026-12-31'}).length,365);
 assert.equal(periodDates({...base,period:'range',date:'2024-01-01',endDate:'2024-12-31'}).length,366);
 assert.throws(()=>periodDates({...base,period:'range',endDate:'2027-01-01'}),/one calendar year/);
 assert.throws(()=>periodDates({...base,period:'range',endDate:'2026-03-19'}),/End date/);
 assert.throws(()=>periodDates({...base,period:'hour',analysisHour:24}),/hour/);
});
test('sunlight interval integrates only selected hour and range equals daily sum',()=>{
 assert.equal(duration(sunSteps({...base,period:'hour',analysisHour:12})),1);
 assert.equal(duration(sunSteps({...base,period:'hour',analysisHour:0})),0);
 const total=duration(sunSteps({...base,period:'range',endDate:'2026-03-21'}));
 assert.equal(total,duration(sunSteps(base))+duration(sunSteps({...base,date:'2026-03-21'})));
});
test('period dependencies exclude inactive fields and preview clock',()=>{
 assert.equal(analysisKey(base),analysisKey({...base,analysisHour:3,endDate:'2026-12-31',hour:1}));
 assert.notEqual(analysisKey(base),analysisKey({...base,period:'hour'}));
 assert.notEqual(analysisKey({...base,period:'range'}),analysisKey({...base,period:'range',endDate:'2026-12-31'}));
 assert.throws(()=>preflight({...base,analysis:'radiation',target:'facade',weatherSource:'tmy',period:'range',date:'2024-02-28',endDate:'2024-03-01'}),/29 February/);
});
function weather(s){const {start}=dayWindow(s);return {source:'test',records:Array.from({length:24},(_,i)=>({start:start+i*3600,end:start+(i+1)*3600,ghi:100,dni:80,dhi:20}))};}
test('hourly weather clips correctly with fractional UTC and cumulative range energy',async()=>{
 const hour=await fetchPeriodWeather({...base,lat:1.21,utc:5.5,period:'hour',analysisHour:23},null,async s=>weather(s));
 assert.equal(hour.records.reduce((sum,r)=>sum+r.end-r.start,0),3600);
 assert.ok(Math.abs(hour.ghi-.1)<1e-10);
 let calls=0;const range=await fetchPeriodWeather({...base,lat:1.22,period:'range',endDate:'2026-03-22'},null,async s=>{calls++;return weather(s)});
 assert.equal(calls,3);assert.equal(range.records.length,72);assert.ok(Math.abs(range.ghi-7.2)<1e-9);
});
test('cancelled ranges do not continue fetching',async()=>{
 const c=new AbortController();let calls=0;
 await assert.rejects(fetchPeriodWeather({...base,lat:1.23,period:'range',endDate:'2026-03-22'},c.signal,async s=>{calls++;c.abort();return weather(s)}));
 assert.equal(calls,1);
});
