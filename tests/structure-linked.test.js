import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../public/geometry.js';
import {generateLinked,linkedDefaults,supportLayout} from '../public/structure-linked.js';
import {analyzeBanded} from '../public/structure-banded.js';
import {analyze3D,section,sampleMember} from '../public/structure-3d.js';
const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const state=()=>({...defaults(),shape:'rectangle',width:18,depth:14,floors:5,podium:false,modifiers:[]});
test('interior point forces reproduce cantilever tip displacement in both planes',()=>{
 for(const axis of [1,2]){
  const P=10,a=2,L=4,m={a:0,b:1,E:200e6,G:80e6,...section(.2,.4),pointLoads:[{t:a/L,force:[0,axis===1?-P:0,axis===2?-P:0]}]},model={nodes:[{p:[0,0,0]},{p:[L,0,0]}],members:[m],loads:Array(12).fill(0),fixed:[0,1,2,3,4,5]},r=analyzeBanded(model),EI=m.E*(axis===1?m.Iz:m.Iy);
  near(r.u[6+axis],-P*a*a*(3*L-a)/(6*EI));near(sampleMember(model,r,0,.25).displacement[axis],-P*(3*a-1)/(6*EI));near(sampleMember(model,r,0,.75).M,0);
 }
});
test('interior point couples and eccentricity preserve cantilever reactions',()=>{
 const m={a:0,b:1,E:200e6,G:80e6,...section(.2,.4),pointLoads:[{t:.5,force:[0,-10,0],moment:[7,3,5]}]},model={nodes:[{p:[0,0,0]},{p:[4,0,0]}],members:[m],loads:Array(12).fill(0),fixed:[0,1,2,3,4,5]},r=analyzeBanded(model);
 near(r.reactions[1],10);near(r.reactions[3],-7);near(r.reactions[4],-3);near(r.reactions[5],15);
});
test('band solver matches dense solver for all displacements and reactions',()=>{
 const m=generateLinked({...state(),floors:2},{...linkedDefaults(),nx:1,nz:1}),a=analyze3D(m),b=analyzeBanded(m);a.u.forEach((v,i)=>near(b.u[i],v));a.reactions.forEach((v,i)=>near(b.reactions[i],v));
});
test('actual modified floors preserved with connected cantilever members',()=>{
 const s={...state(),modifiers:[{type:'twist',value:30,start:1,end:5,enabled:true},{type:'taper',value:15,start:1,end:5,enabled:true}]},before=JSON.stringify(s),m=generateLinked(s,linkedDefaults());
 assert.equal(JSON.stringify(s),before);assert.ok(m.members.some(m=>m.kind.startsWith('cantilever')));assert.equal(m.metadata.floors.length,5);assert.ok(m.metadata.floors[4].area<m.metadata.floors[0].area);assert.ok(m.metadata.maxCantilever>0);
 const r=analyzeBanded(m);assert.ok(r.u.every(Number.isFinite));
});
test('global floor load force and moment conservation including eccentricities',()=>{
 const s={...state(),orientation:31,modifiers:[{type:'leanX',value:2,start:1,end:5,enabled:true}]},c={...linkedDefaults(),loadCase:'gravity',density:0},m=generateLinked(s,c),r=analyzeBanded(m),force=[0,0,0],moment=[0,0,0];
 for(let n=0;n<m.nodes.length;n++)if(m.fixed.includes(n*6)){const [x,y,z]=m.nodes[n].p,[fx,fy,fz,mx,my,mz]=r.reactions.slice(n*6,n*6+6);force[0]+=fx;force[1]+=fy;force[2]+=fz;moment[0]+=mx+y*fz-z*fy;moment[1]+=my+z*fx-x*fz;moment[2]+=mz+x*fy-y*fx;}
 const pressure=c.dead+c.live;near(force[1],m.metadata.totalFloorArea*pressure);near(force[0],0);near(force[2],0);near(moment[0],-m.metadata.floors.reduce((sum,f)=>sum+f.area*pressure*f.centroid[2],0));near(moment[2],m.metadata.floors.reduce((sum,f)=>sum+f.area*pressure*f.centroid[0],0));
});
test('manual frame outside overlap is blocked; no silent building replacement',()=>{
 assert.throws(()=>generateLinked(state(),{...linkedDefaults(),frameMode:'manual',frameWidth:30,frameDepth:20}),/crosses/);
 const s={...state(),modifiers:[{type:'leanX',value:80,start:1,end:5,enabled:true}]};assert.throws(()=>supportLayout(s,linkedDefaults()),/common/);
});
test('default 48-storey twisted tower and podium generate without truncation',()=>{
 const m=generateLinked(defaults(),linkedDefaults());assert.equal(m.metadata.floors.length,51);near(Math.max(...m.nodes.map(n=>n.p[1])),51*3.6);assert.ok(m.nodes.length>160&&m.nodes.length<=1500);
});
test('floor openings excluded from load area and frame cannot cross them',()=>{
 const s={...state(),modifiers:[{type:'atrium',value:3,start:1,end:5,enabled:true,depth:3,shape:'rectangle',x:0,y:0}]};
 assert.throws(()=>generateLinked(s,{...linkedDefaults(),frameMode:'manual',frameWidth:12,frameDepth:8}),/crosses/);
});
test('load refinement changes neither total floor area nor its first moments',()=>{
 const s={...state(),modifiers:[{type:'twist',value:40,start:1,end:5,enabled:true}]};
 const a=generateLinked(s,{...linkedDefaults(),loadResolution:0}),b=generateLinked(s,{...linkedDefaults(),loadResolution:2});
 near(a.metadata.totalFloorArea,b.metadata.totalFloorArea);assert.ok(b.metadata.patchCount>a.metadata.patchCount);
 a.metadata.floors.forEach((f,i)=>f.centroid.forEach((v,k)=>near(v,b.metadata.floors[i].centroid[k])));
});
test('saved manual assignment survives project normalization',async()=>{
 const {normalize}=await import('../public/geometry.js');const s=normalize({...state(),structure:{...linkedDefaults(),frameMode:'manual',frameWidth:8,frameDepth:6,frameX:1,frameAngle:12,loadResolution:2}});
 assert.equal(s.structure.frameMode,'manual');assert.equal(s.structure.frameWidth,8);assert.equal(s.structure.frameX,1);assert.equal(s.structure.loadResolution,2);
});
test('overhang includes rotation of its supporting span, not an artificial fixed root',()=>{
 const sec={E:200e6,G:80e6,...section(.2,.4)},L=4,a=2,P=10,loads=Array(18).fill(0);loads[13]=-P;
 const model={nodes:[{p:[0,0,0]},{p:[L,0,0]},{p:[L+a,0,0]}],members:[{a:0,b:1,...sec},{a:1,b:2,...sec}],loads,fixed:[0,1,2,3,7,8]},r=analyzeBanded(model);
 near(r.u[13],-P*a*a*(L+a)/(3*sec.E*sec.Iz));
 assert.ok(Math.abs(r.u[13])>Math.abs(P*a**3/(3*sec.E*sec.Iz)));
});
