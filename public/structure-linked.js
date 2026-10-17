import clipping from './vendor/polygon-clipping.js';
import {ShapeUtils,Vector2} from './vendor/three.module.js';
import {modelData,footprint,regionArea} from './geometry.js';
import {defaultStructure,section} from './structure-3d.js';

export const ENGINE_LINKED='form-linked-frame-1';
export const linkedDefaults=()=>({...defaultStructure(),frameMode:'auto',frameWidth:12,frameDepth:12,frameX:0,frameZ:0,frameAngle:0,loadResolution:1});
export const linkedGeometryKey=s=>JSON.stringify([s.shape,s.width,s.depth,s.floors,s.storey,s.orientation,s.podium,s.podiumFloors,s.podiumWidth,s.podiumDepth,s.modifiers]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const rect=(x,z,w,d)=>[[[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]]]];
const open=ring=>ring.length>1&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1]?ring.slice(0,-1):ring;
const mapRegions=(regions,fn)=>regions.map(region=>region.map(ring=>open(ring).map(fn)));
const bounds=regions=>{const pts=regions.flat(2);return {xmin:Math.min(...pts.map(p=>p[0])),xmax:Math.max(...pts.map(p=>p[0])),zmin:Math.min(...pts.map(p=>p[1])),zmax:Math.max(...pts.map(p=>p[1]))};};

export function floorGeometry(s){
  const data=modelData(s),floors=[],ground=s.podium?[[footprint('rectangle',s.podiumWidth,s.podiumDepth)]]:data.rings[0].regions;
  if(s.podium)for(let i=1;i<=s.podiumFloors;i++)floors.push({y:i*s.storey,regions:[[footprint('rectangle',s.podiumWidth,s.podiumDepth)]],label:'Podium '+i});
  for(let i=1;i<data.rings.length;i++){const r=data.rings[i];floors.push({y:r.y,regions:r.balconies.length?clipping.union(r.regions,r.balconies):r.regions,label:'Tower '+i});}
  if(s.podium){const top=floors[s.podiumFloors-1],r=data.rings[0];top.regions=clipping.union(top.regions,r.regions,r.balconies);}
  for(const [i,f]of floors.entries())if(f.regions.length!==1||regionArea(f.regions)<.01)throw Error('Floor '+(i+1)+' is empty or disconnected. A separate support/transfer scheme is required.');
  return {ground,floors};
}

export function supportLayout(s,c){
  const g=floorGeometry(s),angle=(s.orientation+c.frameAngle)*Math.PI/180,cs=Math.cos(angle),sn=Math.sin(angle),toLocal=([x,z])=>[x*cs+z*sn,-x*sn+z*cs],toWorld=([x,z])=>[x*cs-z*sn,x*sn+z*cs];
  const floors=g.floors.map(f=>({...f,regions:mapRegions(f.regions,toLocal)})),ground=mapRegions(g.ground,toLocal);
  let common=ground;
  for(const f of floors){common=clipping.intersection(common,f.regions);if(!common.length)throw Error('No common floor overlap supports a continuous rectangular frame. A transfer structure or alternative column scheme is required.');}
  const b=bounds(common),margin=Math.max(c.columnB,c.columnD)/2;
  const fits=(x,z,w,d)=>w>=1&&d>=1&&regionArea(clipping.difference(rect(x,z,w+2*margin,d+2*margin),common))<1e-6;
  let frame;
  if(c.frameMode==='manual'){
    frame={x:c.frameX,z:c.frameZ,width:c.frameWidth,depth:c.frameDepth};
    if(!fits(frame.x,frame.z,frame.width,frame.depth))throw Error('The proposed internal frame crosses a floor edge or opening. Adjust its size/location; column clearance is included.');
  }else{
    const aspect=s.width/s.depth,candidates=[[0,0]];
    for(let i=1;i<8;i++)for(let j=1;j<8;j++)candidates.push([b.xmin+(b.xmax-b.xmin)*i/8,b.zmin+(b.zmax-b.zmin)*j/8]);
    let best=0;
    for(const [x,z]of candidates){let low=0,high=Math.min(b.xmax-b.xmin,(b.zmax-b.zmin)*aspect);for(let k=0;k<20;k++){const w=(low+high)/2;if(fits(x,z,w,w/aspect))low=w;else high=w;}if(low*low/aspect>best){best=low*low/aspect;frame={x,z,width:low*.94,depth:low/aspect*.94};}}
    if(!frame||!fits(frame.x,frame.z,frame.width,frame.depth))throw Error('No usable common rectangle was found. Try a manual frame position/angle or use a different structural scheme.');
  }
  return {floors,ground,frame,toWorld,angle,commonArea:regionArea(common)};
}

function insideRing(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function inside(p,regions){return regions.some(r=>insideRing(p,r[0])&&!r.slice(1).some(h=>insideRing(p,h)));}
function transferClear(a,b,regions){
  const dx=b[0]-a[0],dz=b[1]-a[1],cuts=[0,1];if(Math.hypot(dx,dz)<1e-8)return true;
  for(const ring of regions.flat())for(let i=0;i<ring.length;i++){
    const p=ring[i],q=ring[(i+1)%ring.length],ex=q[0]-p[0],ez=q[1]-p[1],den=dx*ez-dz*ex;if(Math.abs(den)<1e-12)continue;
    const px=p[0]-a[0],pz=p[1]-a[1],t=(px*ez-pz*ex)/den,u=(px*dz-pz*dx)/den;
    if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
  }
  cuts.sort((a,b)=>a-b);for(let i=1;i<cuts.length;i++){const t=(cuts[i]+cuts[i-1])/2;if(!inside([a[0]+t*dx,a[1]+t*dz],regions))return false;}return true;
}
function lineExtent(regions,axis,value,requiredMin,requiredMax){
  const hits=[];for(const ring of regions.flat())for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if((a[1-axis]>value)!==(b[1-axis]>value)){const t=(value-a[1-axis])/(b[1-axis]-a[1-axis]);hits.push(a[axis]+t*(b[axis]-a[axis]));}}
  hits.sort((a,b)=>a-b);const intervals=[];
  for(let i=1;i<hits.length;i++){if(hits[i]-hits[i-1]<1e-7)continue;const p=axis===0?[(hits[i]+hits[i-1])/2,value]:[value,(hits[i]+hits[i-1])/2];if(inside(p,regions))intervals.push([hits[i-1],hits[i]]);}
  const valid=intervals.find(([a,b])=>a<=requiredMin+1e-6&&b>=requiredMax-1e-6);
  if(!valid)throw Error('A proposed beam crosses an opening or disconnected region. Change the frame layout.');return valid;
}

function triangles(regions){const out=[];for(const region of regions){const rings=region.map(open),points=rings.flat(),faces=ShapeUtils.triangulateShape(rings[0].map(p=>new Vector2(...p)),rings.slice(1).map(r=>r.map(p=>new Vector2(...p))));for(const face of faces)out.push(face.map(i=>points[i]));}return out;}
function subdivide(t,level,out){if(!level){out.push(t);return;}const [a,b,c]=t,ab=a.map((v,i)=>(v+b[i])/2),bc=b.map((v,i)=>(v+c[i])/2),ca=c.map((v,i)=>(v+a[i])/2);for(const tri of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])subdivide(tri,level-1,out);}

export function generateLinked(s,raw){
  const c={...linkedDefaults(),...raw};
  for(const [k,v]of Object.entries(c))if(k!=='loadCase'&&k!=='frameMode'&&!Number.isFinite(v))throw Error('Enter finite structural inputs.');
  if(!Number.isInteger(c.nx)||!Number.isInteger(c.nz)||c.nx<1||c.nz<1||c.nx>4||c.nz>4)throw Error('Use 1–4 bays per direction.');
  if(c.E<=0||c.nu<=-1||c.nu>=.5||[c.columnB,c.columnD,c.beamB,c.beamD].some(v=>v<=0)||[c.density,c.dead,c.live].some(v=>v<0))throw Error('Invalid material, section or load values.');
  if(!['auto','manual'].includes(c.frameMode)||!['gravity','lateral','combined'].includes(c.loadCase)||![0,1,2].includes(c.loadResolution))throw Error('Invalid structural mode or load resolution.');
  const layout=supportLayout(s,c),{frame,floors,toWorld}=layout,nodes=[],members=[],fixed=[],loads=[],gravity=c.loadCase!=='lateral',lateral=c.loadCase!=='gravity',E=c.E*1e6,G=E/(2*(1+c.nu));
  const xs=Array.from({length:c.nx+1},(_,i)=>frame.x-frame.width/2+i*frame.width/c.nx),zs=Array.from({length:c.nz+1},(_,i)=>frame.z-frame.depth/2+i*frame.depth/c.nz),grid=[],floorReports=[];
  const world=(x,y,z)=>{const p=toWorld([x,z]);return[p[0],y,p[1]];};
  function node(x,y,z,floor,primary=false){const id=nodes.length;nodes.push({p:world(x,y,z),floor,primary,local:[x,z]});loads.push(0,0,0,0,0,0);return id;}
  function member(a,b,kind,floor){const sec=section(kind==='column'?c.columnB:c.beamB,kind==='column'?c.columnD:c.beamD);members.push({a,b,kind,floor,...sec,E,G,reference:kind==='column'?world(1,0,0):[0,1,0],q:[0,gravity?-sec.A*c.density:0,0],pointLoads:[]});return members.length-1;}
  const groundGrid=xs.map(x=>zs.map(z=>node(x,0,z,0,true)));grid.push(groundGrid);for(let i=0;i<nodes.length*6;i++)fixed.push(i);
  let maxCantilever=0,maxTransferOffset=0,patchCount=0;
  for(let f=0;f<floors.length;f++){
    const floor=floors[f],row=xs.map(x=>zs.map(z=>node(x,floor.y,z,f+1,true))),floorMembers=[];grid.push(row);
    for(let i=0;i<xs.length;i++)for(let j=0;j<zs.length;j++)member(grid[f][i][j],row[i][j],'column',f+1);
    for(let j=0;j<zs.length;j++){
      const [lo,hi]=lineExtent(floor.regions,0,zs[j],xs[0],xs.at(-1));
      for(let i=1;i<xs.length;i++)floorMembers.push(member(row[i-1][j],row[i][j],'beam X',f+1));
      for(const [x,i]of [[lo,0],[hi,xs.length-1]])if(Math.abs(x-xs[i])>1e-5){const end=node(x,floor.y,zs[j],f+1);floorMembers.push(member(row[i][j],end,'cantilever X',f+1));maxCantilever=Math.max(maxCantilever,Math.abs(x-xs[i]));}
    }
    for(let i=0;i<xs.length;i++){
      const [lo,hi]=lineExtent(floor.regions,1,xs[i],zs[0],zs.at(-1));
      for(let j=1;j<zs.length;j++)floorMembers.push(member(row[i][j-1],row[i][j],'beam Y',f+1));
      for(const [z,j]of [[lo,0],[hi,zs.length-1]])if(Math.abs(z-zs[j])>1e-5){const end=node(xs[i],floor.y,z,f+1);floorMembers.push(member(row[i][j],end,'cantilever Y',f+1));maxCantilever=Math.max(maxCantilever,Math.abs(z-zs[j]));}
    }
    const patches=[];for(const triangle of triangles(floor.regions))subdivide(triangle,c.loadResolution,patches);
    let sampledArea=0,mx=0,mz=0;
    for(const t of patches){
      const area=Math.abs((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[2][0]-t[0][0])*(t[1][1]-t[0][1]))/2;if(area<1e-10)continue;
      const center=[0,1].map(k=>(t[0][k]+t[1][k]+t[2][k])/3),p=world(center[0],floor.y,center[1]);sampledArea+=area;mx+=area*p[0];mz+=area*p[2];
      let best;
      for(const id of floorMembers){const m=members[id],a=nodes[m.a].p,b=nodes[m.b].p,d=b.map((v,i)=>v-a[i]),L2=d.reduce((sum,v)=>sum+v*v,0),u=Math.max(0,Math.min(1,d.reduce((sum,v,i)=>sum+v*(p[i]-a[i]),0)/L2)),projection=a.map((v,i)=>v+u*d[i]),offset=p.map((v,i)=>v-projection[i]),distance=Math.hypot(...offset),localA=nodes[m.a].local,localB=nodes[m.b].local,localTarget=localA.map((v,k)=>v+u*(localB[k]-v));if((!best||distance<best.distance)&&transferClear(center,localTarget,floor.regions))best={id,u,offset,distance};}
      if(!best)throw Error('Floor '+(f+1)+' has an area without an unobstructed tributary route to a beam. A transfer/slab model is required.');
      maxTransferOffset=Math.max(maxTransferOffset,best.distance);
      if(gravity){const force=[0,-area*(c.dead+c.live),0];members[best.id].pointLoads.push({t:best.u,force,moment:cross(best.offset,force),area,centroid:p});}
      patchCount++;
    }
    const actualArea=regionArea(floor.regions);if(Math.abs(sampledArea-actualArea)>1e-7*Math.max(1,actualArea))throw Error('Floor triangulation area check failed; loads not assigned.');
    const centroid=[mx/actualArea,floor.y,mz/actualArea];
    if(lateral){const h=world(c.hx,0,c.hz),ids=row.flat(),mean=[0,1,2].map(k=>ids.reduce((sum,i)=>sum+nodes[i].p[k],0)/ids.length),torque=cross(centroid.map((v,k)=>v-mean[k]),h);for(const id of ids)for(let k=0;k<3;k++){loads[id*6+k]+=h[k]/ids.length;loads[id*6+3+k]+=torque[k]/ids.length;}}
    floorReports.push({label:floor.label,y:floor.y,area:actualArea,centroid,patches:patches.length});
  }
  if(nodes.length>1500)throw Error('Generated frame exceeds 1,500 joints. Reduce bays; the form will not be truncated.');
  return {nodes,members,loads,fixed,metadata:{engine:ENGINE_LINKED,frame,frameAngle:layout.angle*180/Math.PI,commonArea:layout.commonArea,geometryUnchanged:true,maxCantilever,maxTransferOffset,patchCount,floors:floorReports,totalFloorArea:floorReports.reduce((sum,r)=>sum+r.area,0),loadMethod:'Triangle-centroid patches to nearest beam, including eccentricity couples. Approximate tributary distribution, not a slab solution.',loadResolution:c.loadResolution}};
}
