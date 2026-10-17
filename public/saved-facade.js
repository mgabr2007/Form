import {ShapeUtils,Vector2} from './vendor/three.core.js';
import {modelData,footprint} from './geometry.js';
import {envelopeMesh} from './envelope.js';
import {facadeGrid} from './facade-grid.js';
function addBand(out,p,q,y0,y1){for(let j=0;j<p.length;j++){const k=(j+1)%p.length,a=[p[j][0],y0,p[j][1]],b=[p[k][0],y0,p[k][1]],c=[q[k][0],y1,q[k][1]],d=[q[j][0],y1,q[j][1]];out.push(...a,...c,...b,...a,...d,...c);}}
function addCap(out,points,y,holes=[]){const rings=[points,...holes],flat=rings.flat(),triangles=ShapeUtils.triangulateShape(points.map(([x,z])=>new Vector2(x,z)),holes.map(h=>h.map(([x,z])=>new Vector2(x,z))));for(const t of triangles)for(const i of [t[0],t[2],t[1]])out.push(flat[i][0],y,flat[i][1]);}
function addPlate(out,region,y,thickness=.23){addCap(out,region[0],y,region.slice(1));const bottom=[];addCap(bottom,region[0],y-thickness,region.slice(1));for(let i=0;i<bottom.length;i+=9)out.push(...bottom.slice(i,i+3),...bottom.slice(i+6,i+9),...bottom.slice(i+3,i+6));for(const ring of region)addBand(out,ring,ring,y-thickness,y);}

// Match the analysis mass geometry, including floor edges and podium, at Float32 precision.
export function savedMassTriangles(s){
 const d=modelData(s),skin=Array.from(envelopeMesh(s,d).positions),slabs=[];
 for(const r of d.rings)for(const region of [...r.regions,...r.balconies])addPlate(slabs,region,r.y);
 if(s.podium){const p=footprint('rectangle',s.podiumWidth,s.podiumDepth);addBand(skin,p,p,0,d.base);for(let i=0;i<=s.podiumFloors;i++){addCap(slabs,p,i*s.storey);addBand(slabs,p,p,Math.max(0,i*s.storey-.3),i*s.storey);}}
 return new Float32Array([...skin,...slabs]);
}
export function savedFacadeCells(result){
 if(result.settings?.target!=='facade'||!['facade-grid-v1','imported-facade-grid-v1'].includes(result.sampling)||!result.project)throw Error('This saved run does not contain a supported façade grid.');
 const grid=facadeGrid(result.receiverTriangles||savedMassTriangles(result.project),result.settings.gridWidth,result.settings.gridHeight);
 if(grid.samples.length!==result.samples?.length||result.values.length!==grid.samples.length)throw Error('Saved grid does not match the reconstructed geometry. Recalculate and save this design to view its façade.');
 // Never assign historical values to newly generated cells unless sample positions and normals match.
 for(let i=0;i<grid.samples.length;i++)for(const field of ['position','normal']){
 const old=result.samples[i][field],fresh=grid.samples[i][field];
 if(!old||old.length!==3||old.some((v,k)=>!Number.isFinite(v)||Math.abs(v-fresh[k])>1e-6))throw Error('Saved sample locations no longer match this geometry version. Recalculate and save the design.');
 }
 return {positions:grid.cellPositions,indices:grid.cellSamples};
}
