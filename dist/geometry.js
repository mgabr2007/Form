import {solarSettings} from './solar.js';
import clipping from './vendor/polygon-clipping.js';
export const defaults = () => ({version:1,name:'Untitled tower',shape:'rounded',width:36,depth:30,floors:48,storey:3.6,orientation:0,podium:true,podiumFloors:3,podiumWidth:64,podiumDepth:52,modifiers:[{id:'twist-1',type:'twist',value:65,start:1,end:48,enabled:true},{id:'taper-1',type:'taper',value:22,start:1,end:48,enabled:true}]});
export const specs={twist:{name:'Twist',unit:'°',min:-180,max:180,step:1,value:45,description:'Rotate progressively around the tower centre.'},taper:{name:'Taper',unit:'%',min:-40,max:65,step:1,value:25,description:'Narrow the tower toward the top. Negative values widen it.'},leanX:{name:'Lean · X',unit:'m',min:-50,max:50,step:1,value:15,description:'Shift the centreline horizontally along X.'},leanZ:{name:'Lean · Y',unit:'m',min:-50,max:50,step:1,value:15,description:'Shift the centreline horizontally along Y.'},bend:{name:'Bend',unit:'m',min:-40,max:40,step:1,value:15,description:'Create a smooth bow along X, returning at the end.'},bulge:{name:'Bulge / pinch',unit:'%',min:-45,max:60,step:1,value:25,description:'Expand the middle of a range. Negative values pinch it.'},setback:{name:'Setback',unit:'%',min:5,max:45,step:1,value:20,description:'Reduce the footprint from the selected starting floor upward.'}};
Object.assign(specs,{
 morph:{name:'Shape transition',unit:'%',min:0,max:100,step:1,value:100,description:'Blend the footprint toward another shape over a floor range.',options:{target:{label:'Target shape',choices:['rectangle','rounded','ellipse','hexagon'],value:'ellipse'}}},
 corners:{name:'Corner treatment',unit:'%',min:0,max:100,step:1,value:60,description:'Progressively round rectangular corners. 100% uses half the shorter side.'},
 wave:{name:'Wave',unit:'m',min:-20,max:20,step:.5,value:6,description:'Repeat a smooth horizontal displacement within the floor range.',options:{direction:{label:'Direction',choices:['x','y'],value:'x'},cycles:{label:'Cycles',min:1,max:8,step:1,value:2},phase:{label:'Phase (degrees)',min:0,max:360,step:15,value:0}}},
 terraces:{name:'Stepped terraces',unit:'m',min:.1,max:3,step:.1,value:1,description:'Inset selected sides every group of floors; retains at least 20% of the original width/depth.',options:{every:{label:'Floors per step',min:1,max:20,step:1,value:8},side:{label:'Inset sides',choices:['all','x+','x-','y+','y-'],value:'all'}}},
 offsets:{name:'Floor offsets',unit:'m',min:-20,max:20,step:.5,value:5,description:'Alternate shifted and unshifted groups within the floor range.',options:{every:{label:'Floors per group',min:1,max:20,step:1,value:4},direction:{label:'Direction',choices:['x','y'],value:'x'}}}
});
Object.assign(specs,{
 atrium:{name:'Atrium / courtyard',unit:'m',min:1,max:40,step:.5,value:8,description:'Cut a vertical opening. Width and depth use plan X/Y; position follows each floor centre.',options:{depth:{label:'Depth (m)',min:1,max:40,step:.5,value:8},shape:{label:'Opening shape',choices:['rectangle','ellipse'],value:'rectangle'},x:{label:'X offset (m)',min:-30,max:30,step:.5,value:0},y:{label:'Y offset (m)',min:-30,max:30,step:.5,value:0}}},
 notch:{name:'Façade cut-out',unit:'m',min:1,max:30,step:.5,value:6,description:'Remove a recess from a selected plan-axis side over a floor range.',options:{width:{label:'Opening width (m)',min:1,max:60,step:.5,value:10},side:{label:'Plan-axis side',choices:['x+','x-','y+','y-'],value:'x+'},position:{label:'Along side (m)',min:-30,max:30,step:.5,value:0}}},
 localRotate:{name:'Local rotation',unit:'°',min:-180,max:180,step:1,value:30,description:'Rotate only the selected floor group; upper floors return to their original orientation.'},
 balcony:{name:'Balconies',unit:'m',min:.5,max:6,step:.5,value:2,description:'Add separate external slab extensions on selected floors. Areas are reported separately.',options:{side:{label:'Plan-axis side',choices:['all','x+','x-','y+','y-'],value:'all'},every:{label:'Every N floors',min:1,max:20,step:1,value:1}}},
 slender:{name:'Slenderness',unit:'×',min:.5,max:2,step:.05,value:1.3,description:'Multiply width/depth ratio progressively while preserving footprint area.'}
});
export const curves={linear:'Linear',easeIn:'Ease in',easeOut:'Ease out',smooth:'Smooth S-curve'};
export const progressiveTypes=['twist','taper','leanX','leanZ','bend','bulge','morph','corners','wave','slender'];
export function transition(t,curve='linear'){t=Math.max(0,Math.min(1,t));return curve==='easeIn'?t*t:curve==='easeOut'?1-(1-t)**2:curve==='smooth'?t*t*(3-2*t):t;}
export function modifierStage(type){return ['morph','corners','slender','terraces'].includes(type)?'1 · Outline — list order': ['taper','bulge','setback'].includes(type)?'2 · Scale': ['twist','localRotate'].includes(type)?'3 · Rotate': ['leanX','leanZ','bend','wave','offsets'].includes(type)?'4 · Shift': ['atrium','notch'].includes(type)?'5 · Openings':'6 · Balconies';}
export function moveModifier(modifiers,from,to){if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=modifiers.length||to>=modifiers.length||from===to)return false;const [m]=modifiers.splice(from,1);modifiers.splice(to,0,m);return true;}
export function duplicateModifier(modifiers,index,id){if(modifiers.length>=12||!modifiers[index])return false;modifiers.splice(index+1,0,{...structuredClone(modifiers[index]),id});return true;}
export function modifierOptions(m){const out={};for(const [key,p]of Object.entries(specs[m.type]?.options||{})){const v=m[key]??p.value;out[key]=p.choices?(p.choices.includes(v)?v:p.value):Math.min(p.max,Math.max(p.min,Number.isFinite(+v)?Math.round(+v/p.step)*p.step:p.value));}return out;}
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function normalize(raw){
 if(!raw||raw.version!==1||typeof raw!=='object')throw Error('Choose a FORM project JSON file (version 1).');
 const s=defaults();
 const n=(key,a,b,integer=false)=>{if(raw[key]!==undefined){const v=Number(raw[key]);if(!Number.isFinite(v))throw Error('Invalid '+key);s[key]=integer?Math.round(clamp(v,a,b)):clamp(v,a,b);}};
 s.name=String(raw.name||s.name).slice(0,70);s.shape=['rectangle','rounded','ellipse','hexagon'].includes(raw.shape)?raw.shape:s.shape;
 n('width',12,80);n('depth',12,80);n('floors',5,100,true);n('storey',2.8,5.5);n('orientation',-180,180);n('podiumFloors',1,8,true);n('podiumWidth',25,110);n('podiumDepth',25,110);s.podium=raw.podium===undefined?s.podium:!!raw.podium;
 s.modifiers=(Array.isArray(raw.modifiers)?raw.modifiers:[]).slice(0,12).map((m,i)=>{const p=specs[m.type];if(!p)throw Error('Unknown modifier');const v=Number(m.value);if(!Number.isFinite(v))throw Error('Invalid modifier value');const start=clamp(Math.round(Number(m.start)||1),1,s.floors);return{id:'mod-'+i,type:m.type,value:clamp(v,p.min,p.max),start,end:clamp(Math.round(Number(m.end)||s.floors),start,s.floors),enabled:m.enabled!==false,...(progressiveTypes.includes(m.type)?{curve:Object.hasOwn(curves,m.curve)?m.curve:'linear'}:{}),...modifierOptions(m)};});
 if(raw.solar)s.solar=solarSettings(raw.solar);
 return s;
}
export function footprint(shape,w,d,radius=Math.min(w,d)*.18){
 const pts=[],segments=48;
 for(let i=0;i<segments;i++){
  let x,z;const a=i/segments*Math.PI*2;
  if(shape==='ellipse'){x=Math.cos(a)*w/2;z=Math.sin(a)*d/2;}
  else if(shape==='rounded'){
   const corner=Math.floor(i/12),t=(i%12)/12*Math.PI/2,r=Math.max(.001,Math.min(radius,Math.min(w,d)/2));
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
 let points=footprint(s.shape,s.width,s.depth);
 let scale=1,angle=s.orientation*Math.PI/180,x=0,z=0;
 for(const m of s.modifiers){if(!m.enabled)continue;
  const begin=m.start-1,end=Math.max(begin+1,m.end),t=transition((level-begin)/(end-begin),m.curve);
  const o=modifierOptions(m);
  if(m.type==='morph'||m.type==='corners'){
   const target=footprint(m.type==='corners'?'rounded':o.target,s.width,s.depth,m.value/100*Math.min(s.width,s.depth)/2);
   const blend=m.type==='corners'?t:m.value/100*t;
   points=points.map((p,i)=>p.map((v,j)=>v+(target[i][j]-v)*blend));
  }
  if(m.type==='wave'&&level>=begin&&level<=end){
   const offset=m.value*Math.sin(Math.PI*t)**2*Math.sin(2*Math.PI*o.cycles*t+o.phase*Math.PI/180);
   if(o.direction==='x')x+=offset;else z+=offset;
  }
  if(m.type==='terraces'){
   const l=Math.min(level-(before?1e-7:0),end),steps=Math.max(0,Math.floor((l-begin)/o.every));
   const dx=Math.min(s.width*.4,steps*m.value),dz=Math.min(s.depth*.4,steps*m.value);
   points=points.map(([a,b])=>[o.side==='all'?a*(1-2*dx/s.width):o.side.startsWith('x')?a*(1-dx/s.width)+(o.side==='x+'?-dx:dx)/2:a,o.side==='all'?b*(1-2*dz/s.depth):o.side.startsWith('y')?b*(1-dz/s.depth)+(o.side==='y+'?-dz:dz)/2:b]);
  }
  if(m.type==='offsets'){
   const l=level-(before?1e-7:0);
   if(l>=begin&&l<end&&Math.floor((l-begin)/o.every)%2===1){if(o.direction==='x')x+=m.value;else z+=m.value;}
  }
  if(m.type==='slender'){const factor=Math.sqrt(1+(m.value-1)*t);points=points.map(([a,b])=>[a*factor,b/factor]);}
  if(m.type==='localRotate'){const l=level-(before?1e-7:0);if(l>=begin&&l<end)angle+=m.value*Math.PI/180;}
  if(m.type==='taper')scale*=1-m.value/100*t;
  if(m.type==='bulge')scale*=1+m.value/100*Math.sin(Math.PI*t)**2;
  if(m.type==='twist')angle+=m.value*Math.PI/180*t;
  if(m.type==='leanX')x+=m.value*t;
  if(m.type==='leanZ')z+=m.value*t;
  if(m.type==='bend')x+=m.value*Math.sin(Math.PI*t)**2;
  if(m.type==='setback'&&(level>begin||level===begin&&!before))scale*=1-m.value/100;
 }
 const c=Math.cos(angle),sn=Math.sin(angle);
 return points.map(([a,b])=>[scale*(a*c-b*sn)+x,scale*(a*sn+b*c)+z]);
}
export const regionArea=regions=>regions.reduce((sum,r)=>sum+area(r[0])-r.slice(1).reduce((a,h)=>a+area(h),0),0);
const clean=regions=>regions.map(r=>r.map(p=>p.length>1&&p[0][0]===p.at(-1)[0]&&p[0][1]===p.at(-1)[1]?p.slice(0,-1):p)).filter(r=>area(r[0])>1e-8);
export function sectionAt(s,level,before=false){
 const points=ringAt(s,level,before),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
 let regions=[[points]],balconies=[];const activeLevel=level-(before?1e-7:0),active=m=>m.enabled&&activeLevel>=m.start-1&&(activeLevel<m.end||level===s.floors&&m.end===s.floors);
 for(const m of s.modifiers.filter(active)){
  const o=modifierOptions(m);let cut;
  if(m.type==='atrium')cut=footprint(o.shape,m.value,o.depth).map(([x,y])=>[x+cx+o.x,y+cy+o.y]);
  if(m.type==='notch'){
   const vertical=o.side.startsWith('x'),w=vertical?m.value:o.width,h=vertical?o.width:m.value;
   const x=vertical?(o.side==='x+'?maxX-m.value/2:minX+m.value/2):cx+o.position,y=vertical?cy+o.position:(o.side==='y+'?maxY-m.value/2:minY+m.value/2);
   cut=footprint('rectangle',w,h).map(([a,b])=>[a+x,b+y]);
  }
  if(cut&&regions.length)regions=clean(clipping.difference(regions,[[cut]]));
 }
 for(const m of s.modifiers.filter(active))if(m.type==='balcony'&&level<s.floors){const o=modifierOptions(m);if((level-m.start+1)%o.every)continue;
  const expanded=points.map(([x,y])=>{const sx=o.side==='all'?1+2*m.value/(maxX-minX):o.side.startsWith('x')?1+m.value/(maxX-minX):1,sy=o.side==='all'?1+2*m.value/(maxY-minY):o.side.startsWith('y')?1+m.value/(maxY-minY):1;return[cx+(x-cx)*sx+(o.side==='x+'?m.value/2:o.side==='x-'?-m.value/2:0),cy+(y-cy)*sy+(o.side==='y+'?m.value/2:o.side==='y-'?-m.value/2:0)];});
  balconies=clean(clipping.union(balconies,clipping.difference([[expanded]],[[points]])));
 }
 return {points,regions,balconies,area:regionArea(regions),balconyArea:regionArea(balconies)};
}
export function modelData(s){
 const base=s.podium?s.podiumFloors*s.storey:0;
 const rings=Array.from({length:s.floors+1},(_,i)=>({y:base+i*s.storey,...sectionAt(s,i)}));
 const layers=[];for(let i=0;i<rings.length;i++){if(i>0&&s.modifiers.some(m=>{if(!m.enabled)return false;const begin=m.start-1,o=modifierOptions(m);return m.type==='localRotate'&&(i===begin||i===m.end)||m.type==='setback'&&begin===i||m.type==='terraces'&&i>begin&&i<=m.end&&(i-begin)%o.every===0||m.type==='offsets'&&i>begin&&i<=m.end&&((i-begin)%o.every===0||i===m.end);}))layers.push({y:rings[i].y,points:ringAt(s,i,true)});layers.push(rings[i]);}
 const areas=rings.slice(0,-1).map(r=>r.area),podiumArea=s.podium?s.podiumWidth*s.podiumDepth:0;
 const emptyFloors=areas.flatMap((a,i)=>a<1e-6?[i+1]:[]),splitFloors=rings.slice(0,-1).flatMap((r,i)=>r.regions.length>1?[i+1]:[]);
 return{rings,layers,areas,emptyFloors,splitFloors,balconyArea:rings.reduce((a,r)=>a+r.balconyArea,0),hasCuts:s.modifiers.some(m=>m.enabled&&['atrium','notch'].includes(m.type)),base,height:base+s.floors*s.storey,towerArea:areas.reduce((a,b)=>a+b,0),totalArea:areas.reduce((a,b)=>a+b,0)+podiumArea*(s.podium?s.podiumFloors:0),podiumArea};
}
