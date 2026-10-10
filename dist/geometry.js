export const defaults = () => ({version:1,name:'Untitled tower',shape:'rounded',width:36,depth:30,floors:48,storey:3.6,orientation:0,podium:true,podiumFloors:3,podiumWidth:64,podiumDepth:52,modifiers:[{id:'twist-1',type:'twist',value:65,start:1,end:48,enabled:true},{id:'taper-1',type:'taper',value:22,start:1,end:48,enabled:true}]});
export const specs={twist:{name:'Twist',unit:'°',min:-180,max:180,step:1,value:45,description:'Rotate progressively around the tower centre.'},taper:{name:'Taper',unit:'%',min:-40,max:65,step:1,value:25,description:'Narrow the tower toward the top. Negative values widen it.'},leanX:{name:'Lean · X',unit:'m',min:-50,max:50,step:1,value:15,description:'Shift the centreline horizontally along X.'},leanZ:{name:'Lean · Y',unit:'m',min:-50,max:50,step:1,value:15,description:'Shift the centreline horizontally along Y.'},bend:{name:'Bend',unit:'m',min:-40,max:40,step:1,value:15,description:'Create a smooth bow along X, returning at the end.'},bulge:{name:'Bulge / pinch',unit:'%',min:-45,max:60,step:1,value:25,description:'Expand the middle of a range. Negative values pinch it.'},setback:{name:'Setback',unit:'%',min:5,max:45,step:1,value:20,description:'Reduce the footprint from the selected starting floor upward.'}};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function normalize(raw){
 if(!raw||raw.version!==1||typeof raw!=='object')throw Error('Choose a FORM project JSON file (version 1).');
 const s=defaults();
 const n=(key,a,b,integer=false)=>{if(raw[key]!==undefined){const v=Number(raw[key]);if(!Number.isFinite(v))throw Error('Invalid '+key);s[key]=integer?Math.round(clamp(v,a,b)):clamp(v,a,b);}};
 s.name=String(raw.name||s.name).slice(0,70);s.shape=['rectangle','rounded','ellipse','hexagon'].includes(raw.shape)?raw.shape:s.shape;
 n('width',12,80);n('depth',12,80);n('floors',5,100,true);n('storey',2.8,5.5);n('orientation',-180,180);n('podiumFloors',1,8,true);n('podiumWidth',25,110);n('podiumDepth',25,110);s.podium=raw.podium===undefined?s.podium:!!raw.podium;
 s.modifiers=(Array.isArray(raw.modifiers)?raw.modifiers:[]).slice(0,12).map((m,i)=>{const p=specs[m.type];if(!p)throw Error('Unknown modifier');const v=Number(m.value);if(!Number.isFinite(v))throw Error('Invalid modifier value');const start=clamp(Math.round(Number(m.start)||1),1,s.floors);return{id:'mod-'+i,type:m.type,value:clamp(v,p.min,p.max),start,end:clamp(Math.round(Number(m.end)||s.floors),start,s.floors),enabled:m.enabled!==false};});
 return s;
}
export function footprint(shape,w,d){
 const pts=[],segments=48;
 for(let i=0;i<segments;i++){
  let x,z;const a=i/segments*Math.PI*2;
  if(shape==='ellipse'){x=Math.cos(a)*w/2;z=Math.sin(a)*d/2;}
  else if(shape==='rounded'){
   const corner=Math.floor(i/12),t=(i%12)/12*Math.PI/2,r=Math.min(w,d)*.18;
   const angle=corner*Math.PI/2+t;
   const cx=[w/2-r,-w/2+r,-w/2+r,w/2-r][corner],cz=[d/2-r,d/2-r,-d/2+r,-d/2+r][corner];
   x=cx+r*Math.cos(angle);z=cz+r*Math.sin(angle);
  }else{
   const sides=shape==='hexagon'?6:4,per=segments/sides,k=Math.floor(i/per),t=(i%per)/per;
   const vertices=shape==='hexagon'?Array.from({length:6},(_,j)=>[Math.cos(j*Math.PI/3)*w/2,Math.sin(j*Math.PI/3)*d/2]):[[w/2,d/2],[-w/2,d/2],[-w/2,-d/2],[w/2,-d/2]];
   const p=vertices[k],q=vertices[(k+1)%sides];x=p[0]+(q[0]-p[0])*t;z=p[1]+(q[1]-p[1])*t;
  }pts.push([x,z]);
 }return pts;
}
export function area(points){let a=0;for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a)/2;}
export function ringAt(s,level,before=false){
 let scale=1,angle=s.orientation*Math.PI/180,x=0,z=0;
 for(const m of s.modifiers){if(!m.enabled)continue;
  const begin=m.start-1,end=Math.max(begin+1,m.end),t=clamp((level-begin)/(end-begin),0,1);
  if(m.type==='taper')scale*=1-m.value/100*t;
  if(m.type==='bulge')scale*=1+m.value/100*Math.sin(Math.PI*t)**2;
  if(m.type==='twist')angle+=m.value*Math.PI/180*t;
  if(m.type==='leanX')x+=m.value*t;
  if(m.type==='leanZ')z+=m.value*t;
  if(m.type==='bend')x+=m.value*Math.sin(Math.PI*t)**2;
  if(m.type==='setback'&&(level>begin||level===begin&&!before))scale*=1-m.value/100;
 }
 const c=Math.cos(angle),sn=Math.sin(angle);
 return footprint(s.shape,s.width,s.depth).map(([a,b])=>[scale*(a*c-b*sn)+x,scale*(a*sn+b*c)+z]);
}
export function modelData(s){
 const base=s.podium?s.podiumFloors*s.storey:0;
 const rings=Array.from({length:s.floors+1},(_,i)=>({y:base+i*s.storey,points:ringAt(s,i)}));
 const layers=[];for(let i=0;i<rings.length;i++){if(i>0&&s.modifiers.some(m=>m.enabled&&m.type==='setback'&&m.start-1===i))layers.push({y:rings[i].y,points:ringAt(s,i,true)});layers.push(rings[i]);}
 const areas=rings.slice(0,-1).map(r=>area(r.points)),podiumArea=s.podium?s.podiumWidth*s.podiumDepth:0;
 return{rings,layers,areas,base,height:base+s.floors*s.storey,towerArea:areas.reduce((a,b)=>a+b,0),totalArea:areas.reduce((a,b)=>a+b,0)+podiumArea*(s.podium?s.podiumFloors:0),podiumArea};
}
