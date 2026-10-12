import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {buildBVH,sunSteps,sunlightHours} from '../dist/solar.js';
import {irradiation,radiationSteps,IRRADIATION_METHOD_VERSION} from '../dist/radiation.js';

export function parseCSV(csv){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<csv.length;i++){
  const c=csv[i];
  if(c==='"'){if(quoted&&csv[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&c===','){row.push(field);field='';}
  else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&csv[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}
  else field+=c;
 }
 if(quoted)throw Error('Unterminated CSV field.');
 if(field||row.length){row.push(field);rows.push(row);}return rows;
}
export function replayAnalysisCSV(csv){
 const rows=parseCSV(csv),header=rows.findIndex(r=>r[0]==='x_m'),meta=Object.fromEntries(rows.slice(0,header).filter(r=>r.length===2));
 if(header<0||meta['method version']!==IRRADIATION_METHOD_VERSION)throw Error('Unsupported CSV method version. Use the matching FORM source revision.');
 const settings=JSON.parse(meta['settings JSON']),triangles=JSON.parse(meta['analysis triangles JSON']),bvh=buildBVH(triangles),radiation=!!meta['weather hourly intervals JSON'];
 const steps=radiation?radiationSteps(JSON.parse(meta['weather hourly intervals JSON']),settings):sunSteps(settings);
 let maxError=0,count=0;
 for(const row of rows.slice(header+1)){
  const v=row.map(Number);if(v.length!==(radiation?10:7)||!v.every(Number.isFinite))throw Error('Invalid sample row.');
  const sample={position:v.slice(0,3),normal:v.slice(3,6)},c=radiation?irradiation(sample,steps,triangles,bvh,settings.skyPatches):null,actual=c?[c.total,c.direct,c.diffuse,c.sky]:[sunlightHours(sample,steps,triangles,bvh)];
  actual.forEach((x,i)=>{maxError=Math.max(maxError,Math.abs(x-v[6+i]));});count++;
 }
 if(!count)throw Error('No sample rows.');
 return {method:IRRADIATION_METHOD_VERSION,samples:count,maxAbsoluteError:maxError,passed:maxError<1e-9};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv[2])throw Error('Usage: node validation/replay_csv.mjs export.csv');
 const result=replayAnalysisCSV(readFileSync(process.argv[2],'utf8'));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
}
