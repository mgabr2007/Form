import {sectionAt} from './geometry.js';
import clipping from './vendor/polygon-clipping.js';
import {ShapeUtils,Vector2} from './vendor/three.core.js';
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const centroid=p=>p.reduce((s,v)=>[s[0]+v[0]/p.length,s[1]+v[1]/p.length],[0,0]);
const open=p=>p.length>1&&dist(p[0],p.at(-1))<1e-9?p.slice(0,-1):p;
function triangle(out,a,b,c){const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(Math.hypot(...cross)>1e-10)out.push(...a,...b,...c);}
function cap(out,regions,y,reverse=false){for(const region of regions){const rings=region.map(open),flat=rings.flat(),tris=ShapeUtils.triangulateShape(rings[0].map(p=>new Vector2(...p)),rings.slice(1).map(h=>h.map(p=>new Vector2(...p))));for(const t of tris){const ids=reverse?t:[t[0],t[2],t[1]];triangle(out,...ids.map(i=>[flat[i][0],y,flat[i][1]]));}}}
// Pair nearest outer loops and their holes; never bridge a change in topology.
function pairs(a,b){if(a.length!==b.length)return null;const unused=new Set(b.map((_,i)=>i)),out=[];for(const r of a){const c=centroid(r[0]),candidates=[...unused].filter(i=>b[i].length===r.length).sort((i,j)=>dist(c,centroid(b[i][0]))-dist(c,centroid(b[j][0])));if(!candidates.length)return null;const j=candidates[0];unused.delete(j);out.push([r[0],b[j][0]]);const holes=new Set(b[j].slice(1).map((_,i)=>i+1));for(const h of r.slice(1)){const k=[...holes].sort((i,k)=>dist(centroid(h),centroid(b[j][i]))-dist(centroid(h),centroid(b[j][k])))[0];holes.delete(k);out.push([h,b[j][k]]);}}return out;}
function parameterize(p){const lengths=[0];for(let i=0;i<p.length;i++)lengths.push(lengths.at(-1)+dist(p[i],p[(i+1)%p.length]));const total=lengths.at(-1);return{knots:lengths.map(l=>l/total),at(t){let i=0;while(i<p.length-1&&lengths[i+1]/total<t-1e-12)i++;const a=p[i],b=p[(i+1)%p.length],span=lengths[i+1]-lengths[i],f=span?(t*total-lengths[i])/span:0;return[a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])];}};}
export function loftLoops(out,a,b,y0,y1,edges=[]){
 // Align the closest corresponding starting vertex before perimeter sampling.
 let best=0;for(let i=1;i<b.length;i++)if(dist(a[0],b[i])<dist(a[0],b[best]))best=i;b=[...b.slice(best),...b.slice(0,best)];
 const pa=parameterize(a),pb=parameterize(b),knots=[...new Set([...pa.knots,...pb.knots].map(t=>Math.round(t*1e10)/1e10))].sort((a,b)=>a-b);
 for(let i=0;i<knots.length-1;i++){const p=pa.at(knots[i]),q=pa.at(knots[i+1]),r=pb.at(knots[i+1]),s=pb.at(knots[i]);triangle(out,[...p.slice(0,1),y0,p[1]],[r[0],y1,r[1]],[q[0],y0,q[1]]);triangle(out,[p[0],y0,p[1]],[s[0],y1,s[1]],[r[0],y1,r[1]]);edges.push(p[0],y0,p[1],s[0],y1,s[1]);}
}
export function envelopeMesh(state,data){
 const positions=[],edges=[],fallbackFloors=new Set(),base=data.base;
 const bridge=(a,b,y0,y1)=>{for(const [p,q]of pairs(a,b)||[])loftLoops(positions,p,q,y0,y1,edges);};
 const transition=(a,b,y)=>{if(JSON.stringify(a)===JSON.stringify(b))return;cap(positions,a.length?clipping.difference(a,b):[],y);cap(positions,b.length?clipping.difference(b,a):[],y,true);};
 if(!data.hasCuts){for(let i=0;i<data.layers.length-1;i++){const a=data.layers[i],b=data.layers[i+1]; // Preserve vertex correspondence for original smooth modifiers.
 for(let j=0;j<a.points.length;j++){const k=(j+1)%a.points.length,p=a.points[j],q=a.points[k],r=b.points[k],s=b.points[j];triangle(positions,[p[0],a.y,p[1]],[r[0],b.y,r[1]],[q[0],a.y,q[1]]);triangle(positions,[p[0],a.y,p[1]],[s[0],b.y,s[1]],[r[0],b.y,r[1]]);edges.push(p[0],a.y,p[1],s[0],b.y,s[1]);}}return{positions,edges,fallbackFloors:[]};}
 const interval=(lo,hi,a,b,depth=0)=>{
  if(pairs(a,b)){bridge(a,b,base+lo*state.storey,base+hi*state.storey);return;}
  const mid=(lo+hi)/2,m=sectionAt(state,mid).regions;
  if(depth<3){interval(lo,mid,a,m,depth+1);interval(mid,hi,m,b,depth+1);return;}
  // A topology event needs a narrow stepped strip instead of crossed faces.
  fallbackFloors.add(Math.min(state.floors,Math.floor(lo)+1));bridge(a,a,base+lo*state.storey,base+mid*state.storey);transition(a,b,base+mid*state.storey);bridge(b,b,base+mid*state.storey,base+hi*state.storey);
 };
 for(let floor=0;floor<state.floors;floor++){
  for(let j=0;j<4;j++){const lo=floor+j/4,hi=floor+(j+1)/4,a=j===0?data.rings[floor].regions:sectionAt(state,lo).regions,b=sectionAt(state,hi,j===3).regions;interval(lo,hi,a,b);}
  const before=sectionAt(state,floor+1,true).regions,after=data.rings[floor+1].regions;transition(before,after,base+(floor+1)*state.storey);
 }
 return{positions,edges,fallbackFloors:[...fallbackFloors]};
}
