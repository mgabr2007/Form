import {periodDates,periodWindow,periodLabel} from './analysis-period.js';
import {dayWindow} from './radiation.js';
const annualCache=new Map();
export async function weatherRequest(path,settings,signal){const q=new URLSearchParams({lat:settings.lat,lon:settings.lon,date:settings.date,utc:settings.utc});const r=await fetch('/api/weather/'+path+'?'+q,{signal});const data=await r.json();if(!r.ok)throw Error(data.error||'Weather request failed');return data;}
const finite=(v,name,min=-Infinity,max=Infinity)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('Missing or invalid '+name);return v;};
export function parseTMY(data){
 const raw=data.outputs?.tmy_hourly;if(!Array.isArray(raw)||raw.length!==8760)throw Error('TMY must contain 8,760 hourly records.');
 const offset=finite(data.inputs?.location?.irradiance_time_offset??data.inputs?.meteo_data?.irradiance_time_offset,'irradiance time offset',0,1),seen=new Set(),qualityIssues=[];
 const wind=(value,time)=>{if(typeof value==='number'&&Number.isFinite(value)&&value>=0)return value;qualityIssues.push({sourceTime:time,field:'WS10m',rawValue:value??null,issue:'Invalid wind speed; excluded from processed data. Not used for irradiation.'});return null;};
 const rows=raw.map((r,i)=>{const t=r['time(UTC)']||r.time;if(!/^\d{8}:\d{4}$/.test(t||''))throw Error('Invalid TMY timestamp');const month=+t.slice(4,6),day=+t.slice(6,8),hour=+t.slice(9,11),stamp=Date.UTC(2001,month-1,day,hour);if(stamp!==Date.UTC(2001,0,1)+i*3600000||t.slice(11)!=='00'||seen.has(t.slice(4)))throw Error('TMY has a missing, duplicate or unordered hour.');seen.add(t.slice(4));return{sourceTime:t,month,day,hour,ghi:finite(r['G(h)'],'GHI',0),dni:finite(r['Gb(n)'],'DNI',0),dhi:finite(r['Gd(h)'],'DHI',0),temperature:finite(r.T2m,'temperature',-100,80),humidity:finite(r.RH,'relative humidity',0,100),windSpeed:wind(r.WS10m,t),windDirection:finite(r.WD10m,'wind direction',0,360),pressure:finite(r.SP,'surface pressure',1000),infrared:finite(r['IR(h)'],'infrared',0)};});
 return {rows,offset,qualityIssues,inputs:data.inputs,months:data.outputs.months_selected,source:'PVGIS 5.3 TMY / '+data.inputs?.meteo_data?.radiation_db,retrieved:data.retrieved,url:data.sourceURL,raw:data};
}
export async function loadTMY(settings,signal){const key=settings.lat+'|'+settings.lon;if(annualCache.has(key))return annualCache.get(key);const result=parseTMY(await weatherRequest('tmy',settings,signal));if(annualCache.size>=3)annualCache.delete(annualCache.keys().next().value);annualCache.set(key,result);return result;}
export function tmyDay(tmy,settings){
 if(settings.date.slice(5)==='02-29')throw Error('TMY has no 29 February. Choose another date.');
 const {start,end}=dayWindow(settings),records=[];
 for(let t=Math.floor(start/3600)*3600;t<end;t+=3600){const d=new Date(t*1000);if(d.getUTCMonth()===1&&d.getUTCDate()===29)throw Error('This local day intersects 29 February, which is not in TMY.');const index=(Date.UTC(2001,d.getUTCMonth(),d.getUTCDate(),d.getUTCHours())-Date.UTC(2001,0,1))/3600000,r=tmy.rows[index];records.push({start:Math.max(t,start),end:Math.min(t+3600,end),solarTime:t+tmy.offset*3600,ghi:r.ghi,dni:r.dni,dhi:r.dhi,sourceTime:r.sourceTime});}
 return {records,source:tmy.source+' · typical day (not observed date)',retrieved:tmy.retrieved,url:tmy.url,gridLatitude:tmy.inputs.location.latitude,gridLongitude:tmy.inputs.location.longitude,ghi:records.reduce((s,r)=>s+r.ghi*(r.end-r.start)/3600000,0),provenance:{kind:'TMY',station:null,qualityIssues:tmy.qualityIssues||[],months:tmy.months,inputs:tmy.inputs,irradianceTimeOffsetHours:tmy.offset,method:'Hourly quadrature at provider irradiance timestamp; partial UTC intervals weighted by overlap. Building shading added; PVGIS terrain horizon disabled.'}};
}
export function parseOpenWeatherSolar(data,settings){
 if(data.date!==settings.date||data.interval!=='1h'||data.intervals?.length!==24)throw Error('OpenWeather must return a complete matching hourly day.');
 const m=/^([+-])(\d{2}):(\d{2})$/.exec(data.tz||'');if(!m||(+m[2]+ +m[3]/60)*(m[1]==='-'?-1:1)!==settings.utc)throw Error('OpenWeather UTC offset differs from requested offset.');
 const {start}=dayWindow(settings),records=data.intervals.map((r,i)=>{if(r.start!==String(i).padStart(2,'0')+':00'||r.end!==String(i).padStart(2,'0')+':59')throw Error('Solar response has a gap or unexpected interval.');const v=r.avg_irradiance?.cloudy_sky;return {start:start+i*3600,end:start+(i+1)*3600,ghi:finite(v?.ghi,'GHI',0),dni:finite(v?.dni,'DNI',0),dhi:finite(v?.dhi,'DHI',0)};});
 return {records,source:'OpenWeather Solar Irradiance 2.0 / cloudy-sky model',retrieved:data.retrieved,url:data.sourceURL,gridLatitude:data.lat,gridLongitude:data.lon,ghi:records.reduce((s,r)=>s+r.ghi/1000,0),provenance:{kind:'date-specific model',station:null,interval:'hourly average irradiance W/m²'}};
}
const dailyCache=new Map();
export async function fetchSelectedWeather(settings,signal,fallback){const key=JSON.stringify([settings.weatherSource,settings.lat,settings.lon,settings.date,settings.utc]);if(dailyCache.has(key))return structuredClone(dailyCache.get(key));const data=await selectWeather(settings,signal,fallback);if(dailyCache.size>=8)dailyCache.delete(dailyCache.keys().next().value);dailyCache.set(key,structuredClone(data));return data;}
async function selectWeather(settings,signal,fallback){if(settings.weatherSource==='tmy')return tmyDay(await loadTMY(settings,signal),settings);if(settings.weatherSource==='openweather')return parseOpenWeatherSolar(await weatherRequest('solar',settings,signal),settings);return fallback(settings,signal);}

export async function fetchPeriodWeather(settings,signal,fallback,onProgress=()=>{}){
 const dates=periodDates(settings),window=periodWindow(settings),records=[],days=[];
 let first;
 for(let i=0;i<dates.length;i++){
  signal?.throwIfAborted();
  onProgress(i,dates.length);
  let day;try{day=await fetchSelectedWeather({...settings,date:dates[i],period:'day'},signal,fallback);}catch(e){if(signal?.aborted)throw e;throw Error('Weather for '+dates[i]+': '+e.message);}
  signal?.throwIfAborted();first??=day;
  days.push({date:dates[i],source:day.source,url:day.url,retrieved:day.retrieved,provenance:day.provenance});
  for(const r of day.records){const start=Math.max(window.start,r.start),end=Math.min(window.end,r.end);if(end>start)records.push({...r,start,end});}
 }
 let cursor=window.start;
 for(const r of records){if(Math.abs(r.start-cursor)>.01)throw Error('Weather period has a missing or overlapping interval.');cursor=r.end;}
 if(Math.abs(cursor-window.end)>.01)throw Error('Weather does not cover the selected period.');
 return {...first,records,ghi:records.reduce((sum,r)=>sum+r.ghi*(r.end-r.start)/3600000,0),
  provenance:{...first.provenance,period:periodLabel(settings),startUTC:window.start,endUTC:window.end,days}};
}
