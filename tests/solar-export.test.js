import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisCSV} from '../public/solar-export.js';
import {buildBVH} from '../public/solar.js';
import {irradiation,radiationSteps,IRRADIATION_METHOD_VERSION} from '../public/radiation.js';
import {replayAnalysisCSV} from '../validation/replay_csv.mjs';
// Parse RFC4180 quoting, including embedded newlines in project names.
function parse(csv){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<csv.length;i++){const c=csv[i];if(c==='"'){if(quoted&&csv[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(!quoted&&c===','){row.push(field);field='';}else if(!quoted&&c==='\r'&&csv[i+1]==='\n'){row.push(field);rows.push(row);row=[];field='';i++;}else field+=c;}row.push(field);rows.push(row);return rows;}
test('CSV round-trips the exact computational inputs and reproduces the saved result',()=>{
 const settings={lat:30,lon:31,date:'2026-06-21',utc:2,north:0,step:15,skyPatches:512,target:'roof'},weather={source:'Synthetic "test"',url:'offline',retrieved:'2026-10-12T00:00:00Z',gridLatitude:30,gridLongitude:31,records:[{start:1782036000,end:1782039600,dni:600,dhi:100,ghi:500}]},samples=[{position:[0,0,0],normal:[0,1,0]}],triangles=[-2,2,-2,2,2,-2,2,2,2,-2,2,-2,2,2,2,-2,2,2],components=[irradiation(samples[0],radiationSteps(weather.records,settings),triangles,buildBVH(triangles),settings.skyPatches)];
 const project={name:'Quoted "project"\nname'},rows=parse(analysisCSV({settings,weather,samples,triangles,components,values:[components[0].total],project,daylight:1},{mode:'daylight',maximum:10})),metadata=Object.fromEntries(rows.filter(r=>r.length===2));
 assert.equal(metadata['method version'],IRRADIATION_METHOD_VERSION);assert.deepEqual(JSON.parse(metadata['project JSON']),project);
 const savedTriangles=JSON.parse(metadata['analysis triangles JSON']),savedSettings=JSON.parse(metadata['settings JSON']),savedRecords=JSON.parse(metadata['weather hourly intervals JSON']),last=rows.at(-1).map(Number),savedSample={position:last.slice(0,3),normal:last.slice(3,6)};
 const result=irradiation(savedSample,radiationSteps(savedRecords,savedSettings),savedTriangles,buildBVH(savedTriangles),savedSettings.skyPatches);
 assert.equal(result.total,last[6]);assert.equal(result.direct,last[7]);assert.equal(result.diffuse,last[8]);assert.equal(result.sky,last[9]);
 assert.equal(replayAnalysisCSV(analysisCSV({settings,weather,samples,triangles,components,values:[components[0].total],project,daylight:1})).maxAbsoluteError,0);
});
