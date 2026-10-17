import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot,compare,summarize,readHistory,writeHistory,comparisonCSV} from '../public/analysis-history.js';
const result=()=>({values:[0,4,8],samples:[],settings:{analysis:'sunlight',target:'facade',date:'2026-06-21',lat:30,lon:31,utc:2,north:0,step:30,context:[]},project:{floors:40},weather:null});
const run=()=>snapshot(result(),'A','id','2026-10-12T00:00:00Z');
test('snapshot isolates the live project and computes numerical summary',()=>{const r=result(),a=snapshot(r,'A','x');r.values[0]=100;r.project.floors=80;assert.equal(a.result.project.floors,40);assert.deepEqual(summarize(a.result.values),{min:0,max:8,mean:4,count:3});});
test('design change permits comparison; environmental changes suppress deltas',()=>{const a=run(),b=run();b.result.project.floors=80;b.result.values=[2,6,10];assert.equal(compare(b,a).delta,2);assert.equal(compare(b,a).relative,50);b.result.settings.north=90;assert.deepEqual(compare(b,a).reasons,['north rotation']);assert.equal(compare(b,a).delta,null);});
test('sky comparisons ignore sun parameters but detect resolution and metric mismatch',()=>{const a=run(),b=run();a.result.settings.analysis=b.result.settings.analysis='sky';a.result.settings.skyResolution=b.result.settings.skyResolution=32;b.result.settings.date='2026-01-01';assert.equal(compare(b,a).delta,0);b.result.settings.skyResolution=64;assert.deepEqual(compare(b,a).reasons,['sky resolution']);b.result.settings.analysis='daylight';assert.ok(compare(b,a).reasons.includes('metric'));});
test('weather comparisons ignore retrieval time, detect changed inputs',()=>{const a=run(),b=run();for(const r of [a,b]){r.result.settings.analysis='radiation';r.result.weather={source:'ERA5',records:[{dni:200}],retrieved:'today'};}b.result.weather.retrieved='tomorrow';assert.equal(compare(b,a).delta,0);b.result.weather.records[0].dni=400;assert.deepEqual(compare(b,a).reasons,['weather']);});
test('zero baseline has no relative delta; different sample counts warn without suppressing descriptive deltas',()=>{const a=run(),b=run();a.result.values=[0,0,0];assert.equal(compare(b,a).relative,null);b.result.values.push(8);assert.equal(compare(b,a).reasons.length,0);assert.equal(compare(b,a).warnings.length,1);assert.equal(compare(b,a).delta,5);});
test('storage roundtrip, quota failure and corrupted data are explicit',()=>{let raw=null;const storage={getItem:()=>raw,setItem:(_,v)=>raw=v};writeHistory(storage,[run()]);assert.equal(readHistory(storage)[0].name,'A');assert.throws(()=>writeHistory({setItem(){throw Error('Quota');}},[run()]),/Quota/);assert.throws(()=>writeHistory(storage,Array(101).fill(run())),/100/);raw='{}';assert.throws(()=>readHistory(storage));});
test('CSV escapes formula names and preserves comparison/provenance',()=>{const a=run();a.name='=CMD("x")';const csv=comparisonCSV([a],a);assert.ok(csv.includes("'=CMD"));assert.ok(csv.includes('conditions JSON'));assert.ok(csv.includes('north rotation'));});
test('facade grid sampling and spacing prevent incompatible comparisons',()=>{const a=run(),b=run();b.result.sampling='facade-grid-v1';b.result.settings.gridWidth=5;b.result.settings.gridHeight=3;assert.ok(compare(b,a).reasons.includes('sampling'));a.result.sampling='facade-grid-v1';a.result.settings.gridWidth=5;a.result.settings.gridHeight=3;assert.equal(compare(b,a).delta,0);b.result.settings.gridWidth=10;assert.ok(compare(b,a).reasons.includes('grid width'));});

test('range weather retrieval timestamps do not block otherwise identical comparisons',()=>{
 const a=run(),b=run();
 for(const r of [a,b]){r.result.settings.analysis='radiation';r.result.weather={source:'PVGIS',records:[{dni:200}],provenance:{days:[{date:'2026-06-21',retrieved:'first'}]}};}
 b.result.weather.provenance.days[0].retrieved='second';
 assert.equal(compare(b,a).delta,0);
 b.result.weather.provenance.days[0].date='2026-06-22';
 assert.ok(compare(b,a).reasons.includes('weather'));
});
