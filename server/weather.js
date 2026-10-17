import {stationLookup} from './stations.js';
const OWNER_EMAIL = 'm.gabr@aucegypt.edu';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const memo=new Map();
function coordinate(q,key,max){const raw=q.get(key),v=Number(raw);if(raw===null||raw.trim()===''||!Number.isFinite(v)||Math.abs(v)>max)throw Error('Invalid '+key);return v;}
async function upstream(url){let r;try{r=await fetch(url,{signal:AbortSignal.timeout(45000)});}catch{throw Error('Weather provider unavailable or timed out. Retry later.');}if(!r.ok){if(r.status===401||r.status===403)throw Error('OpenWeather rejected access. Check key activation and the subscription for this specific product (One Call 4.0 or Solar Irradiance 2.0).');if(r.status===429)throw Error('Weather provider rate limit reached. Retry later.');throw Error('Weather provider returned HTTP '+r.status+'. Check date and geographic coverage.');}return r.json();}
export async function weatherAPI(request,env){
 const url=new URL(request.url),kind=url.pathname.split('/').pop(),key=env.OPENWEATHER_API_KEY||env['Form-ChatGPT'];
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 if(kind==='status')return json({configured:Boolean(key),owner:request.headers.get('oai-authenticated-user-email')?.toLowerCase()===OWNER_EMAIL,tmyProvider:'PVGIS 5.3',station:null});
 if(!['tmy','solar','current','station'].includes(kind))return json({error:'Not found'},404);
 if(!['tmy','station'].includes(kind)&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()!==OWNER_EMAIL)return json({error:'Sign in as the site owner to use the saved OpenWeather subscription.'},403);
 try{
 const lat=coordinate(url.searchParams,'lat',90),lon=coordinate(url.searchParams,'lon',180);
 if(kind==='station')return json(await stationLookup(lat,lon));
 const target=new URL(kind==='tmy'?'https://re.jrc.ec.europa.eu/api/v5_3/tmy':kind==='solar'?'https://api.openweathermap.org/energy/2.0/solar/interval_data':'https://api.openweathermap.org/data/4.0/onecall/current');
 target.searchParams.set('lat',lat.toFixed(4));target.searchParams.set('lon',lon.toFixed(4));
 if(kind==='tmy'){target.searchParams.set('outputformat','json');target.searchParams.set('usehorizon','0');}
 else{if(!key)return json({error:'No OpenWeather secret configured.'},503);if(kind==='current')target.searchParams.set('units','metric');else{
 const date=url.searchParams.get('date'),utc=Number(url.searchParams.get('utc'));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<'1979-01-01'||Date.parse(date)>Date.now()+15*86400000)throw Error('Invalid date: select 1979 onwards, no more than 15 days ahead.');
 if(!url.searchParams.has('utc')||!Number.isFinite(utc)||utc< -12||utc>14||utc*4%1!==0)throw Error('Invalid UTC offset. Use 15-minute increments.');
 const minutes=Math.round(Math.abs(utc)*60),tz=(utc<0?'-':'+')+String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
 for(const [k,v]of Object.entries({date,interval:'1h',tz}))target.searchParams.set(k,v);
 }}
 const cacheKey=target.href,found=memo.get(cacheKey);if(found&&found.expiry>Date.now())return json(found.data);
 if(kind!=='tmy')target.searchParams.set('appid',key);
 const raw=await upstream(target);
 // Whitelist output: provider pagination URLs can contain the API key.
 let data;if(kind==='tmy'){if(!Array.isArray(raw.outputs?.tmy_hourly)||raw.outputs.tmy_hourly.length!==8760)throw Error('PVGIS did not return a complete 8,760-hour TMY.');data={inputs:raw.inputs,outputs:raw.outputs,meta:raw.meta};}
 else if(kind==='solar'){data={lat:raw.lat,lon:raw.lon,date:raw.date,tz:raw.tz,interval:raw.interval,intervals:raw.intervals};if(!Array.isArray(data.intervals))throw Error('Solar response contains no hourly intervals.');}
 else{const v=raw.current||raw.data?.[0]||raw;data={lat:raw.lat,lon:raw.lon,timezone:raw.timezone,dt:v.dt,temp:v.temp,humidity:v.humidity,pressure:v.pressure,wind_speed:v.wind_speed,wind_deg:v.wind_deg,clouds:v.clouds};if(!Number.isFinite(data.temp))throw Error('Current weather response lacks temperature.');}
 data.retrieved=new Date().toISOString();data.sourceURL=cacheKey;data.station=null;
 if(memo.size>=24)memo.delete(memo.keys().next().value);memo.set(cacheKey,{data,expiry:Date.now()+(kind==='tmy'?86400000:kind==='solar'?3600000:600000)});return json(data);
 }catch(e){return json({error:e.message},502);}
}
