import test from 'node:test';
import assert from 'node:assert/strict';
import {solarSettings} from '../public/solar.js';
import {analysisDependencies as analysisDependenciesForTest,studyControls,analysisKey,preflight,integrationMethod,workflowSummary} from '../public/solar-workflow.js';
import {fetchSelectedWeather} from '../public/weather-data.js';
const s=()=>solarSettings({analysis:'radiation',target:'facade',weatherSource:'tmy'});
test('preview controls preserve daily result dependencies',()=>{const a=s();for(const change of [{hour:19},{enabled:true},{extent:400},{step:60},{skyResolution:64}])assert.equal(analysisKey(a),analysisKey({...a,...change}));});
test('irradiation invalidates for location, orientation, weather, time window, grid and context',()=>{const a=s();for(const change of [{lat:31},{lon:40},{utc:3},{date:'2026-12-21'},{north:90},{weatherSource:'openweather'},{gridWidth:10},{gridHeight:5},{context:[{x:0,y:0,width:10,depth:10,height:20}]}])assert.notEqual(analysisKey(a),analysisKey({...a,...change}));});
test('sky studies depend only on active geometry sampling inputs',()=>{const a={...s(),analysis:'daylight'};for(const change of [{lat:50},{date:'2026-12-21'},{north:90},{weatherSource:'openweather'},{step:60}])assert.equal(analysisKey(a),analysisKey({...a,...change}));assert.notEqual(analysisKey(a),analysisKey({...a,skyResolution:64}));const b={...a,analysis:'sky',target:'ground'};assert.notEqual(analysisKey(b),analysisKey({...b,extent:300}));assert.equal(analysisKey(b),analysisKey({...b,gridWidth:20}));});
test('preflight and metadata distinguish TMY and actual-day integration',()=>{assert.throws(()=>preflight({...s(),date:'2024-02-29'}),/29 February/);assert.throws(()=>preflight({...s(),weatherSource:'openweather',utc:2.1}),/15-minute/);assert.throws(()=>preflight({...s(),target:'ground'}),/façades/);assert.match(integrationMethod(s()),/Hourly quadrature/);assert.match(integrationMethod({...s(),weatherSource:'openweather'}),/1-minute/);assert.match(workflowSummary(s()),/Preview clock does not/);});
test('form and north changes reuse weather; date changes retrieve a new day; callers cannot mutate cache',async()=>{let calls=0;const fallback=async()=>{calls++;return{records:[{dni:10}]};};const a={...s(),weatherSource:'openmeteo',lat:11.25};const first=await fetchSelectedWeather(a,null,fallback);first.records[0].dni=999;const second=await fetchSelectedWeather({...a,north:90,gridWidth:10},null,fallback);assert.equal(calls,1);assert.equal(second.records[0].dni,10);await fetchSelectedWeather({...a,date:'2026-12-21'},null,fallback);assert.equal(calls,2);});

test('restored study settings always select eligible receiving surfaces',()=>{
 for(const target of ['ground','roof','facade',undefined]){
  assert.equal(solarSettings({analysis:'daylight',target}).target,'facade');
  assert.ok(['roof','facade'].includes(solarSettings({analysis:'radiation',target}).target));
 }
 assert.equal(solarSettings({analysis:'sky',target:'ground'}).target,'ground');
 assert.equal(solarSettings({analysis:'sunlight',target:'ground'}).target,'ground');
});

test('visible choices match study dependencies across all supported study/target combinations',()=>{
 for(const analysis of ['sunlight','radiation','daylight','sky']){
  for(const target of ['ground','roof','facade']){
   const settings=solarSettings({analysis,target}),c=studyControls(settings),deps=analysisDependenciesForTest(settings);
   assert.equal(c.site,Boolean(deps.lat!==undefined));
   assert.equal(c.weather,analysis==='radiation');
   assert.equal(c.timeStep,['sunlight','radiation'].includes(analysis));
   assert.equal(c.skySampling,['daylight','sky'].includes(analysis));
   assert.equal(c.grid,settings.target==='facade');
   assert.equal(c.extent,settings.target==='ground');
   assert.ok(c.targets.includes(settings.target));
   assert.equal(c.targetChoice,c.targets.length>1);
   if(analysis==='radiation')assert.ok(!c.targets.includes('ground'));
   if(analysis==='daylight')assert.deepEqual(c.targets,['facade']);
  }
 }
});
