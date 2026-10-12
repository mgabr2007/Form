import {IRRADIATION_METHOD_VERSION,DEFAULT_SKY_PATCHES} from './radiation.js';
import {RAY_OFFSET_METRES} from './solar.js';

// Store the actual ray mesh, samples and weather, as well as design parameters.
// The numeric kernel is identified by a version; keep that source with the CSV.
export function analysisCSV(r,scale={}){
 const radiation=!!r.weather;
 const rows=[
  [radiation?'FORM daily irradiation — estimated direct + sky diffuse, kWh/m²':'FORM direct sunlight hours — geometric estimate'],
  ['method version',IRRADIATION_METHOD_VERSION],['settings JSON',JSON.stringify(r.settings)],
  ['project JSON',JSON.stringify(r.project)],['sampled daylight hours',r.daylight],
  ['ray offset metres',RAY_OFFSET_METRES],['coordinate convention','x=east, y=up, z=plan north at north=0; metres'],
  ['colour scale JSON',JSON.stringify(scale)],
  ['analysis triangles JSON',JSON.stringify(r.triangles)],
  ...(radiation?[
   ['weather source',r.weather.source],['weather URL',r.weather.url],['retrieved UTC',r.weather.retrieved],
   ['weather grid lat lon',r.weather.gridLatitude,r.weather.gridLongitude],
   ['method','DNI cosine projection + ray visibility; isotropic DHI; no reflections; NOAA/Meeus geometric sun'],
   ['sky directions',r.settings.skyPatches??DEFAULT_SKY_PATCHES],
   ['weather hourly intervals JSON',JSON.stringify(r.weather.records)],
   ['validation status','Selected analytical/pvlib benchmarks only; no field validation; hourly inputs held constant']
  ]:[]),
  ['x_m','height_m','plan_y_m','normal_x','normal_up','normal_plan_y',radiation?'total_kWh_m2':'direct_sun_hours',...(radiation?['direct_kWh_m2','diffuse_kWh_m2','sky_factor']:[])],
  ...r.samples.map((s,i)=>[...s.position,...s.normal,r.values[i],...(radiation?[r.components[i].direct,r.components[i].diffuse,r.components[i].sky]:[])])
 ];
 return rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
}
