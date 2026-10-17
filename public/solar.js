import {periodDates} from './analysis-period.js';
// Geometric solar position using NOAA/Meeus Julian-century equations.
// https://gml.noaa.gov/grad/solcalc/calcdetails.html and main.js.
// No atmospheric refraction or topocentric parallax; benchmarked against pvlib SPA.
const rad=Math.PI/180;
export function solarPosition(date,hour,latitude,longitude,utcOffset=0,north=0){
 // Declination/equation of time must describe the same UTC instant, including
 // date/year rollover, regardless of the caller's clock convention.
 const instant=new Date(Date.parse(date+'T00:00:00Z')+(hour-utcOffset)*3600000);
 if(!Number.isFinite(+instant))throw Error('Invalid analysis date');
 const day=new Date(instant.toISOString().slice(0,10)+'T00:00:00Z');
 hour=(instant-day)/3600000;utcOffset=0;
 const t=(+instant/86400000+2440587.5-2451545)/36525;
 const longitudeMean=(280.46646+t*(36000.76983+.0003032*t))*rad;
 const anomaly=(357.52911+t*(35999.05029-.0001537*t))*rad;
 const eccentricity=.016708634-t*(.000042037+.0000001267*t);
 const centre=(1.914602-t*(.004817+.000014*t))*Math.sin(anomaly)+(.019993-.000101*t)*Math.sin(2*anomaly)+.000289*Math.sin(3*anomaly);
 const omega=(125.04-1934.136*t)*rad;
 const apparentLongitude=longitudeMean+(centre-.00569-.00478*Math.sin(omega))*rad;
 const obliquity=(23+(26+(21.448-t*(46.815+t*(.00059-.001813*t)))/60)/60+.00256*Math.cos(omega))*rad;
 const dec=Math.asin(Math.sin(obliquity)*Math.sin(apparentLongitude)),y=Math.tan(obliquity/2)**2;
 const eq=4/rad*(y*Math.sin(2*longitudeMean)-2*eccentricity*Math.sin(anomaly)+4*eccentricity*y*Math.sin(anomaly)*Math.cos(2*longitudeMean)-.5*y*y*Math.sin(4*longitudeMean)-1.25*eccentricity**2*Math.sin(2*anomaly));
 const ha=(hour*60+eq+4*longitude-60*utcOffset)/4*rad-Math.PI,lat=latitude*rad;
 const east=-Math.cos(dec)*Math.sin(ha),up=Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(ha),n=Math.cos(lat)*Math.sin(dec)-Math.sin(lat)*Math.cos(dec)*Math.cos(ha);
 const a=north*rad;return{altitude:Math.asin(Math.max(-1,Math.min(1,up)))/rad,azimuth:(Math.atan2(east,n)/rad+360)%360,direction:[east*Math.cos(a)+n*Math.sin(a),up,-east*Math.sin(a)+n*Math.cos(a)]};
}
export function sunSteps(settings){const steps=[];for(const date of periodDates(settings)){const start=settings.period==='hour'?settings.analysisHour*60:0,end=settings.period==='hour'?start+60:1440;for(let minutes=start;minutes<end;minutes+=settings.step){const hours=Math.min(settings.step,end-minutes)/60;const p=solarPosition(date,(minutes+hours*30)/60,settings.lat,settings.lon,settings.utc,settings.north);if(p.altitude>0)steps.push({...p,hours});}}return steps;}
function bounds(tris,ids){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const i of ids)for(let j=0;j<9;j++){const a=j%3,v=tris[i*9+j];min[a]=Math.min(min[a],v);max[a]=Math.max(max[a],v);}return{min,max};}
export function buildBVH(tris){const build=ids=>{const box=bounds(tris,ids);if(ids.length<=12)return{...box,ids};const spans=box.max.map((v,i)=>v-box.min[i]),axis=spans.indexOf(Math.max(...spans));ids.sort((a,b)=>(tris[a*9+axis]+tris[a*9+axis+3]+tris[a*9+axis+6])-(tris[b*9+axis]+tris[b*9+axis+3]+tris[b*9+axis+6]));const mid=ids.length>>1;return{...box,left:build(ids.slice(0,mid)),right:build(ids.slice(mid))};};return build(Array.from({length:tris.length/9},(_,i)=>i));}
function boxHit(o,d,node){let lo=0,hi=Infinity;for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-12){if(o[i]<node.min[i]||o[i]>node.max[i])return false;}else{const a=(node.min[i]-o[i])/d[i],b=(node.max[i]-o[i])/d[i];lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(hi<lo)return false;}}return true;}
function triangleHit(o,d,t,i){i*=9;const a=[t[i],t[i+1],t[i+2]],e1=[t[i+3]-a[0],t[i+4]-a[1],t[i+5]-a[2]],e2=[t[i+6]-a[0],t[i+7]-a[1],t[i+8]-a[2]],p=cross(d,e2),det=dot(e1,p);if(Math.abs(det)<1e-10)return false;const inv=1/det,v=o.map((x,k)=>x-a[k]),u=dot(v,p)*inv;if(u<0||u>1)return false;const q=cross(v,e1),w=dot(d,q)*inv;if(w<0||u+w>1)return false;return dot(e2,q)*inv>1e-5;}
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
// 0.1 mm in model metres: large enough for the 0.01 mm hit threshold without
// stepping through centimetre-scale fins/overhangs. Sub-mm geometry is unresolved.
export const RAY_OFFSET_METRES=1e-4;
export const rayOrigin=sample=>sample.position.map((v,i)=>v+sample.normal[i]*RAY_OFFSET_METRES);
export function blocked(o,d,tris,node){if(!boxHit(o,d,node))return false;if(node.ids)return node.ids.some(i=>triangleHit(o,d,tris,i));return blocked(o,d,tris,node.left)||blocked(o,d,tris,node.right);}
export function sampleSurfaces(tris,target,count=500,includeFaceIndex=false){const faces=[];let total=0;for(let i=0;i<tris.length;i+=9){const a=tris.slice(i,i+3),b=tris.slice(i+3,i+6),c=tris.slice(i+6,i+9),n=cross(b.map((v,k)=>v-a[k]),c.map((v,k)=>v-a[k])),length=Math.hypot(...n);if(length<1e-8)continue;const normal=n.map(v=>v/length);if(target==='roof'?normal[1]<.7:Math.abs(normal[1])>.7)continue;total+=length/2;faces.push({a,b,c,normal,total,faceTriangle:i/9});}if(!faces.length)return[];const samples=[];let j=0;for(let k=0;k<count;k++){const t=(k+.5)*total/count;while(j<faces.length-1&&faces[j].total<t)j++;const f=faces[j],u=Math.sqrt(((k*.61803398875+.37)%1)),v=(k*.41421356237+.23)%1;const p=f.a.map((a,i)=>(1-u)*a+u*(1-v)*f.b[i]+u*v*f.c[i]);samples.push({position:p,normal:f.normal,...(includeFaceIndex?{faceTriangle:f.faceTriangle}:{})});}return samples;}
export function sunlightHours(sample,steps,tris,bvh){const origin=rayOrigin(sample);return steps.reduce((sum,s)=>sum+(dot(sample.normal,s.direction)>1e-7&&!blocked(origin,s.direction,tris,bvh)?s.hours:0),0);}
export function solarSettings(raw={}){const number=(k,d,a,b)=>Number.isFinite(+raw[k])?Math.max(a,Math.min(b,+raw[k])):d;const date=/^\d{4}-\d{2}-\d{2}$/.test(raw.date||'')&&Number.isFinite(Date.parse(raw.date))&&new Date(raw.date).toISOString().slice(0,10)===raw.date?raw.date:'2026-06-21';return{period:['hour','range'].includes(raw.period)?raw.period:'day',analysisHour:Math.floor(number('analysisHour',12,0,23)),endDate:/^\d{4}-\d{2}-\d{2}$/.test(raw.endDate||'')?raw.endDate:date,weatherSource:['tmy','openweather'].includes(raw.weatherSource)?raw.weatherSource:'openmeteo',gridWidth:number('gridWidth',5,.25,30),gridHeight:number('gridHeight',3,.25,30),enabled:raw.enabled===true,analysis:['radiation','daylight','sky'].includes(raw.analysis)?raw.analysis:'sunlight',skyResolution:[16,32,64].includes(+raw.skyResolution)?+raw.skyResolution:32,lat:number('lat',30.0444,-89,89),lon:number('lon',31.2357,-180,180),utc:number('utc',2,-12,14),north:number('north',0,-180,180),date,hour:number('hour',12,0,23.99),step:[.25,.5,1,5,15,30,60].includes(+raw.step)?+raw.step:15,skyPatches:[512,2048,8192].includes(+raw.skyPatches)?+raw.skyPatches:8192,target:raw.analysis==='daylight'||raw.analysis==='radiation'&&!['roof','facade'].includes(raw.target)?'facade':['ground','roof','facade'].includes(raw.target)?raw.target:'ground',extent:number('extent',150,50,500),context:(Array.isArray(raw.context)?raw.context:[]).slice(0,5).map(b=>Object.fromEntries(['x','y','width','depth','height'].map(k=>[k,Number.isFinite(+(b||{})[k])?Math.max(k==='x'||k==='y'?-500:1,Math.min(500,+(b||{})[k])):k==='height'?40:k==='x'?60:k==='y'?0:30]))) };}
