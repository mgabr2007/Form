import {solarPosition,dot,blocked} from './solar.js';
// Isotropic sky radiance, normalized to DHI. Ground/reflected radiation excluded.
export function skyFactor(sample,tris,bvh,resolution=16){
 if(!Number.isInteger(resolution)||resolution<4||resolution>256)throw Error('Invalid sky resolution');
 const origin=sample.position.map((v,i)=>v+.02*sample.normal[i]);let visible=0,total=0;
 for(let j=0;j<resolution;j++){const up=(j+.5)/resolution,r=Math.sqrt(1-up*up);for(let k=0;k<resolution*2;k++){const a=2*Math.PI*(k+.5)/(resolution*2),d=[r*Math.cos(a),up,r*Math.sin(a)],w=Math.max(0,dot(sample.normal,d));total+=w;if(w&&!blocked(origin,d,tris,bvh))visible+=w;}}
 return (1+sample.normal[1])/2*(total?visible/total:0);
}
export function radiationSteps(records,settings,maxStepMinutes=5){if(!Number.isFinite(settings.step)||settings.step<1||!Number.isFinite(maxStepMinutes)||maxStepMinutes<1)throw Error('Invalid radiation time step');const steps=[];for(const r of records){for(let t=r.start;t<r.end;){const end=Math.min(r.end,t+Math.min(settings.step,maxStepMinutes)*60),date=new Date((t+end)*500),p=solarPosition(date.toISOString().slice(0,10),date.getUTCHours()+date.getUTCMinutes()/60+date.getUTCSeconds()/3600,settings.lat,settings.lon,0,settings.north);steps.push({...p,hours:(end-t)/3600,dni:r.dni,dhi:r.dhi});t=end;}}return steps;}
export function irradiation(sample,steps,tris,bvh){const origin=sample.position.map((v,i)=>v+.02*sample.normal[i]),sky=skyFactor(sample,tris,bvh);let direct=0,diffuse=0;for(const s of steps){const cos=Math.max(0,dot(sample.normal,s.direction));if(s.altitude>0&&cos&&!blocked(origin,s.direction,tris,bvh))direct+=s.dni*cos*s.hours/1000;diffuse+=s.dhi*sky*s.hours/1000;}return{direct,diffuse,total:direct+diffuse,sky};}
export function dayWindow(settings){const start=Date.parse(settings.date+'T00:00:00Z')/1000-settings.utc*3600;return{start,end:start+86400};}
export function parseRadiation(data,settings){
 const h=data.hourly,u=data.hourly_units,{start,end}=dayWindow(settings),names=['shortwave_radiation','direct_normal_irradiance','diffuse_radiation'];
 if(!h||!Array.isArray(h.time)||!names.every(n=>Array.isArray(h[n])&&u?.[n]==='W/m²'))throw Error('Weather response lacks hourly radiation in W/m².');
 const records=[];let cursor=start;
 for(let i=0;i<h.time.length;i++){const stamp=typeof h.time[i]==='number'?h.time[i]:Date.parse(h.time[i]+'Z')/1000,a=Math.max(start,stamp-3600),b=Math.min(end,stamp);if(!(b>a))continue;
 if(Math.abs(a-cursor)>.01)throw Error('Weather data has a gap or duplicate interval.');const values=names.map(n=>h[n][i]);if(values.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0))throw Error('Weather data contains missing or invalid radiation. Choose another date.');records.push({start:a,end:b,ghi:values[0],dni:values[1],dhi:values[2]});cursor=b;}
 if(Math.abs(cursor-end)>.01||!records.length)throw Error('A complete 24-hour weather day is not available. Choose an earlier date.');return records;
}
const cache=new Map();
export async function fetchRadiation(settings,signal){
 const {start,end}=dayWindow(settings),historical=start<Date.now()/1000-5*86400,base=historical?'https://archive-api.open-meteo.com/v1/archive':'https://api.open-meteo.com/v1/forecast',url=new URL(base);
 for(const [k,v] of Object.entries({latitude:settings.lat,longitude:settings.lon,hourly:'shortwave_radiation,direct_normal_irradiance,diffuse_radiation',start_date:new Date(start*1000).toISOString().slice(0,10),end_date:new Date(end*1000).toISOString().slice(0,10),timezone:'GMT',timeformat:'unixtime',...(historical?{models:'era5'}:{})}))url.searchParams.set(k,v);
 const key=url.href+'|'+start;if(cache.has(key))return structuredClone(cache.get(key));
 const response=await fetch(url,{signal});if(!response.ok)throw Error('Weather service returned '+response.status+'. Try a past date or retry later.');const data=await response.json(),records=parseRadiation(data,settings),weather={records,source:historical?'Open-Meteo / ERA5 reanalysis':'Open-Meteo / best-match forecast',url:url.href,retrieved:new Date().toISOString(),gridLatitude:data.latitude,gridLongitude:data.longitude,ghi:records.reduce((s,r)=>s+r.ghi*(r.end-r.start)/3600000,0)};
 if(cache.size>=8)cache.delete(cache.keys().next().value);cache.set(key,weather);return structuredClone(weather);
}
