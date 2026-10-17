import {facadeSector} from './facade-unfold.js';
export function distribution(values){
 const a=Array.from(values).sort((a,b)=>a-b);if(!a.length||a.some(v=>!Number.isFinite(v)))throw Error('Invalid sample values');
 const q=p=>{const i=(a.length-1)*p,k=Math.floor(i);return a[k]+(a[Math.min(k+1,a.length-1)]-a[k])*(i-k);};
 return {min:a[0],q1:q(.25),median:q(.5),q3:q(.75),max:a.at(-1),mean:a.reduce((s,v)=>s+v,0)/a.length,count:a.length};
}
export function histogram(values,low,high,bins=10){const counts=Array(bins).fill(0);for(const v of values){const i=high===low?0:Math.max(0,Math.min(bins-1,Math.floor((v-low)/(high-low)*bins)));counts[i]++;}return counts.map(n=>100*n/values.length);}
export function orientationMeans(result){
 if(result.settings.target!=='facade'||result.samples?.length!==result.values.length)return null;
 const sums=Array(4).fill(0),counts=Array(4).fill(0);
 for(let i=0;i<result.samples.length;i++){const n=result.samples[i].normal;if(!n||!n.every(Number.isFinite))return null;const k=facadeSector(n,result.settings.north||0).index;sums[k]+=result.values[i];counts[k]++;}
 return sums.map((v,k)=>({mean:counts[k]?v/counts[k]:null,count:counts[k]}));
}
export function componentMeans(result){
 if(result.settings.analysis!=='radiation'||result.components?.length!==result.values.length)return null;
 let direct=0,diffuse=0;for(const c of result.components){if(!Number.isFinite(c.direct)||!Number.isFinite(c.diffuse))return null;direct+=c.direct;diffuse+=c.diffuse;}
 return {direct:direct/result.values.length,diffuse:diffuse/result.values.length};
}
