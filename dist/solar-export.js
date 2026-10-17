import {IRRADIATION_METHOD_VERSION,DEFAULT_SKY_PATCHES} from './radiation.js';
import {RAY_OFFSET_METRES} from './solar.js';

// Keep all four modes and façade identifiers in the same replayable CSV schema.
export function analysisCSV(r,scale={}){
 const mode=r.settings.analysis||(r.weather?'radiation':'sunlight');
 const radiation=mode==='radiation',sky=['daylight','sky'].includes(mode);
 const titles={radiation:'FORM daily irradiation — estimated direct + sky diffuse, kWh/m²',sunlight:'FORM direct sunlight hours — geometric estimate',daylight:'Façade VSC (%) — geometry-only screening',sky:'Horizontal sky-view factor (%) — geometry-only screening'};
 if(!titles[mode])throw Error('Unsupported analysis type.');
 const settings={...r.settings,analysis:mode};
 const rows=[
  [titles[mode]],['method version',IRRADIATION_METHOD_VERSION],['analysis type',mode],
  ['settings JSON',JSON.stringify(settings)],['project JSON',JSON.stringify(r.project)],
  ['date',settings.date],['latitude',settings.lat],['longitude',settings.lon],['UTC offset',settings.utc],['north rotation',settings.north],['target',settings.target],
  ['context blocks JSON',JSON.stringify(settings.context??[])],
  ['sampled daylight hours',r.daylight],['ray offset metres',RAY_OFFSET_METRES],
  ['coordinate convention','x=east, y=up, z=plan north at north=0; metres'],
  ['colour scale JSON',JSON.stringify(scale)],['analysis triangles JSON',JSON.stringify(Array.from(r.triangles))],
  ['sampling',r.sampling||'area-samples-v1'],
  ['facade grid width m',settings.target==='facade'?settings.gridWidth:''],
  ['facade grid row height m',settings.target==='facade'?settings.gridHeight:''],
  ['resolution study JSON',JSON.stringify(r.resolutionStudy??null)],
  ...(sky?[
   ['method','CIE overcast L=1+2*sin(altitude); horizontal illuminance denominator 7*pi/3; no reflected light'],
   ['sky rays',2*settings.skyResolution*settings.skyResolution],
   ['VSC receiver','Virtual vertical plane facing facade azimuth'],
   ['sky-view receiver','Horizontal plane at sample position'],['date and location','Not used']
  ]:[['time step minutes',radiation?Math.min(1,settings.step):settings.step]]),
  ...(radiation?[
   ['weather source',r.weather.source],['weather URL',r.weather.url],['retrieved UTC',r.weather.retrieved],
   ['weather grid lat lon',r.weather.gridLatitude,r.weather.gridLongitude],
   ['method','DNI cosine projection + ray visibility; isotropic DHI; no reflections; NOAA/Meeus geometric sun; maximum one-minute geometry step'],
   ['sky directions',settings.skyPatches??DEFAULT_SKY_PATCHES],
   ['sky sampling','Spherical Fibonacci hemisphere; normalized cosine weights'],
   ['weather hourly intervals JSON',JSON.stringify(r.weather.records)],
   ['validation status','Selected analytical/pvlib/Radiance benchmarks; no field validation; hourly inputs held constant']
  ]:[]),
  ['x_m','height_m','plan_y_m','normal_x','normal_up','normal_plan_y',
   ...(sky?['vsc_percent','horizontal_sky_view_percent','visible_sky_solid_angle_percent']:radiation?['total_kWh_m2','direct_kWh_m2','diffuse_kWh_m2','sky_factor']:['direct_sun_hours']),
   'grid_row','grid_column','face_triangle'],
  ...r.samples.map((s,i)=>[...s.position,...s.normal,
   ...(sky?[r.components[i].vsc??'',r.components[i].skyView,r.components[i].visibleSky]:radiation?[r.values[i],r.components[i].direct,r.components[i].diffuse,r.components[i].sky]:[r.values[i]]),
   s.gridRow??'',s.gridColumn??'',s.faceTriangle??''])
 ];
 return rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
}
