import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {skyExposure} from '../dist/daylight.js';
import {buildBVH,sunSteps,sunlightHours,RAY_OFFSET_METRES} from '../dist/solar.js';
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
 const settings=JSON.parse(meta['settings JSON']),triangles=JSON.parse(meta['analysis triangles JSON']),bvh=buildBVH(triangles);
 const mode=meta['analysis type'],radiation=mode==='radiation',sky=['daylight','sky'].includes(mode);
 if(!['sunlight','radiation','daylight','sky'].includes(mode)||mode!==settings.analysis)throw Error('Invalid analysis type.');
 if(Number(meta['ray offset metres'])!==RAY_OFFSET_METRES)throw Error('Unsupported ray offset.');
 const steps=sky?[]:radiation?radiationSteps(JSON.parse(meta['weather hourly intervals JSON']),settings):sunSteps(settings);
 const expectedHeader=['x_m','height_m','plan_y_m','normal_x','normal_up','normal_plan_y',
  ...(sky?['vsc_percent','horizontal_sky_view_percent','visible_sky_solid_angle_percent']:radiation?['total_kWh_m2','direct_kWh_m2','diffuse_kWh_m2','sky_factor']:['direct_sun_hours']),
  'grid_row','grid_column','face_triangle'];
 if(JSON.stringify(rows[header])!==JSON.stringify(expectedHeader))throw Error('Unsupported sample columns.');
 let maxError=0,count=0;
 for(const row of rows.slice(header+1)){
  const v=row.map(Number),numericEnd=expectedHeader.length-3;
  if(row.length!==expectedHeader.length||row.slice(0,numericEnd).some((x,i)=>!(sky&&i===6&&x==='')&&(x===''||!Number.isFinite(v[i]))))throw Error('Invalid sample row.');
  const sample={position:v.slice(0,3),normal:v.slice(3,6)};
  const c=sky?skyExposure(sample,triangles,bvh,settings.skyResolution):radiation?irradiation(sample,steps,triangles,bvh,settings.skyPatches):null;
  const actual=sky?[c.vsc,c.skyView,c.visibleSky]:radiation?[c.total,c.direct,c.diffuse,c.sky]:[sunlightHours(sample,steps,triangles,bvh)];
  actual.forEach((x,i)=>{
   if(x===null){if(row[6+i]!=='')throw Error('Horizontal receiver must have empty VSC.');}
   else {if(row[6+i]==='')throw Error('Missing numeric result.');maxError=Math.max(maxError,Math.abs(x-v[6+i]));}
  });count++;
 }
 if(!count)throw Error('No sample rows.');
 return {method:IRRADIATION_METHOD_VERSION,samples:count,maxAbsoluteError:maxError,passed:maxError<1e-9};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv[2])throw Error('Usage: node validation/replay_csv.mjs export.csv');
 const result=replayAnalysisCSV(readFileSync(process.argv[2],'utf8'));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
}
