const SOURCE='https://aviationweather.gov/data/cache/stations.cache.json.gz';
let cached=null,pending=null;
export function distanceKm(lat,lon,a,b){const r=Math.PI/180,dlat=(a-lat)*r,dlon=(b-lon)*r,h=Math.sin(dlat/2)**2+Math.cos(lat*r)*Math.cos(a*r)*Math.sin(dlon/2)**2;return 6371.0088*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));}
export function nearestStation(rows,lat,lon){let best=null;for(const r of rows){if(!Array.isArray(r.siteType)||!r.siteType.includes('METAR')||!Number.isFinite(r.lat)||!Number.isFinite(r.lon)||Math.abs(r.lat)>90||Math.abs(r.lon)>180||!r.id||!r.site)continue;const distance=distanceKm(lat,lon,r.lat,r.lon);if(!best||distance<best.distanceKm)best={id:String(r.id),icao:r.icaoId||null,wmo:r.wmoId||null,name:String(r.site),country:r.country||null,latitude:r.lat,longitude:r.lon,elevationM:Number.isFinite(r.elev)?r.elev:null,types:Array.isArray(r.siteType)?r.siteType:[],distanceKm:distance};}if(!best)throw Error('Station directory contains no usable coordinates.');return best;}
async function directory(){
 if(cached&&Date.now()-Date.parse(cached.retrieved)<86400000)return cached;if(pending)return pending;
 pending=(async()=>{
 const response=await fetch(SOURCE,{headers:{'User-Agent':'FORM-Tower-Studio/1.0 (academic weather station reference)'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Station directory unavailable (HTTP '+response.status+'). Retry later.');
 const bytes=new Uint8Array(await response.arrayBuffer());let raw;if(bytes[0]===31&&bytes[1]===139){raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();}else raw=JSON.parse(new TextDecoder().decode(bytes));
 if(!Array.isArray(raw)||!raw.length)throw Error('Invalid station directory response.');const data={rows:raw,retrieved:new Date().toISOString()};cached=data;return data;
 })();try{return await pending;}finally{pending=null;}
}
export async function stationLookup(lat,lon){const data=await directory();return {station:nearestStation(data.rows,lat,lon),source:'NOAA / NWS Aviation Weather Center station directory',sourceURL:SOURCE,retrieved:data.retrieved,directoryCount:data.rows.length,scope:'Nearest by great-circle distance among geolocated METAR-listed entries in this directory; not an exhaustive list of all weather stations. Listing does not confirm current reporting or TMY availability.',usedForCalculation:false};}
