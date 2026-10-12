// Regular (horizontal tangent, world elevation) lattice, clipped to each façade triangle.
// Horizontal coordinates are world-origin anchored within each planar face.
export function facadeGrid(tris,width=5,height=3,limit=6000){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)throw Error('Grid spacing must be at least 1 m.');
 const samples=[],lines=[],seen=new Set();let candidates=0;
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 for(let f=0;f<tris.length;f+=9){const p=[Array.from(tris.slice(f,f+3)),Array.from(tris.slice(f+3,f+6)),Array.from(tris.slice(f+6,f+9))],raw=cross(sub(p[1],p[0]),sub(p[2],p[0])),len=Math.hypot(...raw);if(len<1e-8)continue;const n=raw.map(v=>v/len);if(Math.abs(n[1])>.7)continue;
 const h=Math.hypot(n[0],n[2]),t=[n[2]/h,0,-n[0]/h],q=p.map(v=>[dot(v,t),v[1]]),d=dot(n,p[0]),den=area(...q);if(Math.abs(den)<1e-8)continue;
 const min=[0,1].map(k=>Math.min(...q.map(v=>v[k]))),max=[0,1].map(k=>Math.max(...q.map(v=>v[k]))),point=(u,y)=>{const k=(d-n[1]*y)/(h*h);return [t[0]*u+n[0]*k,y,t[2]*u+n[2]*k];};
 const bounds=[width,height].map((s,k)=>[Math.ceil(min[k]/s-.5-1e-8),Math.floor(max[k]/s-.5+1e-8)]);candidates+=Math.max(0,bounds[0][1]-bounds[0][0]+1)*Math.max(0,bounds[1][1]-bounds[1][0]+1);if(candidates>250000)throw Error('Grid is too dense. Increase the façade spacing.');
 for(let row=bounds[1][0];row<=bounds[1][1];row++)for(let col=bounds[0][0];col<=bounds[0][1];col++){const uv=[(col+.5)*width,(row+.5)*height];if([area(q[0],q[1],uv)/den,area(q[1],q[2],uv)/den,area(q[2],q[0],uv)/den].some(v=>v< -1e-8))continue;const position=point(...uv),key=[...position,...n].map(v=>Math.round(v*1e5)).join(',');if(seen.has(key))continue;seen.add(key);samples.push({position,normal:n,gridRow:row,gridColumn:col,faceTriangle:f/9});if(samples.length>limit)throw Error(`Grid exceeds ${limit.toLocaleString()} points. Increase the façade spacing.`);}
 for(let axis=0;axis<2;axis++){const spacing=axis===0?width:height;for(let i=Math.ceil(min[axis]/spacing);i<=Math.floor(max[axis]/spacing);i++){const value=i*spacing,hits=[];for(let e=0;e<3;e++){const a=q[e],b=q[(e+1)%3],delta=b[axis]-a[axis];if(Math.abs(delta)<1e-10){if(Math.abs(a[axis]-value)<1e-8)hits.push(a,b);continue;}const r=(value-a[axis])/delta;if(r>=-1e-8&&r<=1+1e-8)hits.push(a.map((v,k)=>v+r*(b[k]-v)));}if(hits.length>=2){hits.sort((a,b)=>a[1-axis]-b[1-axis]);for(const uv of [hits[0],hits.at(-1)])lines.push(...point(...uv).map((v,k)=>v+n[k]*.06));}if(lines.length>600000)throw Error('Grid is too dense. Increase the façade spacing.');}}
 }
 return {samples,lines};
}
