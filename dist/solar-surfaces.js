import {modelData,sectionAt,footprint} from './geometry.js';
import clipping from './vendor/polygon-clipping.js';
import {ShapeUtils,Vector2} from './vendor/three.core.js';
import {cross} from './solar.js';

// Remove horizontal mesh patches inside the FORM mass before area sampling.
// This uses the project's cross-sections, NOT visibility: an exterior terrace
// shaded by an overhang or another building must still be sampled.
export function roofSurfaceTriangles(triangles,state){
 const data=modelData(state),out=[],sections=new Map(),heightTolerance=Math.max(1e-5,data.height*1e-7);
 function interior(y){
  if(y>=data.height-heightTolerance)return[];
  if(sections.has(y))return sections.get(y);
  let regions=[];
  if(state.podium&&y<data.base-heightTolerance)regions=[[footprint('rectangle',state.podiumWidth,state.podiumDepth)]];
  if(y>=data.base-heightTolerance){
   let level=(y-data.base)/state.storey;
   if(Math.abs(level-Math.round(level))*state.storey<heightTolerance)level=Math.round(level);
   const tower=sectionAt(state,level).regions;
   regions=regions.length?clipping.union(regions,tower):tower;
  }
  sections.set(y,regions);return regions;
 }
 for(let i=0;i<triangles.length;i+=9){
  const p=Array.from({length:3},(_,j)=>Array.from(triangles.slice(i+j*3,i+j*3+3))),n=cross(p[1].map((v,k)=>v-p[0][k]),p[2].map((v,k)=>v-p[0][k])),len=Math.hypot(...n);
  if(!len||n[1]/len<.7)continue;
  // Inclined envelope faces are already exterior in FORM's mass representation.
  if(Math.max(...p.map(v=>v[1]))-Math.min(...p.map(v=>v[1]))>heightTolerance){out.push(...p.flat());continue;}
  const y=p[0][1],occupied=interior(y),face=[[p.map(v=>[v[0],v[2]])]],visible=occupied.length?clipping.difference(face,occupied):face;
  for(const region of visible){
   const rings=region.map(r=>r.length>1&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1]?r.slice(0,-1):r),flat=rings.flat();
   const indices=ShapeUtils.triangulateShape(rings[0].map(v=>new Vector2(...v)),rings.slice(1).map(r=>r.map(v=>new Vector2(...v))));
   for(const t of indices)for(const j of [t[0],t[2],t[1]])out.push(flat[j][0],y,flat[j][1]);
  }
 }
 return out;
}
