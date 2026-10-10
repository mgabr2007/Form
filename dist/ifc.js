import {modelData,footprint,area} from './geometry.js';
import {floorPlans} from './plans.js';
const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
function guid(){let n=0n;for(const b of crypto.getRandomValues(new Uint8Array(16)))n=(n<<8n)|BigInt(b);let s='';for(let i=0;i<22;i++){s=chars[Number(n&63n)]+s;n>>=6n;}return "'"+s+"'";}
function str(value){let s='';for(let i=0;i<String(value).length;i++){const c=String(value)[i],n=c.charCodeAt(0);s+=n<32||n>126?'\\X2\\'+n.toString(16).toUpperCase().padStart(4,'0')+'\\X0\\':c==="'"?"''":c==='\\'?'\\\\':c;}return "'"+s+"'";}
const num=n=>{if(!Number.isFinite(n))throw Error('Invalid IFC coordinate');const s=Number(n.toFixed(8)).toString();return /[.e]/i.test(s)?s:s+'.';};
export function exportIFC(state){
 const lines=[],add=s=>{lines.push('#'+(lines.length+1)+'='+s+';');return '#'+lines.length;},list=a=>'('+a.join(',')+')';
 const person=add("IFCPERSON($,'Gabr','Mostafa A.',$,$,$,$,$)"),org=add("IFCORGANIZATION($,'Mostafa A. Gabr',$,$,$)"),actor=add(`IFCPERSONANDORGANIZATION(${person},${org},$)`),app=add(`IFCAPPLICATION(${org},'1.3','FORM Parametric Tower Studio','FORM')`),owner=add(`IFCOWNERHISTORY(${actor},${app},$,.ADDED.,${Math.floor(Date.now()/1000)},${actor},${app},${Math.floor(Date.now()/1000)})`);
 const point=(x,y,z)=>add('IFCCARTESIANPOINT(('+[x,y,z].map(num).join(',')+'))');
 const origin=point(0,0,0),up=add('IFCDIRECTION((0.,0.,1.))'),down=add('IFCDIRECTION((0.,0.,-1.))'),axisX=add('IFCDIRECTION((1.,0.,0.))'),axis=add(`IFCAXIS2PLACEMENT3D(${origin},${up},${axisX})`);
 const context=add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,0.00001,${axis},$)`);
 const units=add(`IFCUNITASSIGNMENT((${add('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)')},${add('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)')},${add('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)')}))`);
 const placement=(parent='$',z=0)=>add(`IFCLOCALPLACEMENT(${parent},${z===0?axis:add(`IFCAXIS2PLACEMENT3D(${point(0,0,z)},${up},${axisX})`)})`);
 const project=add(`IFCPROJECT(${guid()},${owner},${str(state.name)},'Conceptual massing model',$,$,$,(${context}),${units})`),sitePos=placement(),site=add(`IFCSITE(${guid()},${owner},'Site',$,$,${sitePos},$,$,.ELEMENT.,$,$,$,$,$)`),buildingPos=placement(sitePos),building=add(`IFCBUILDING(${guid()},${owner},${str(state.name)},'FORM concept building',$,${buildingPos},$,$,.ELEMENT.,$,$,$)`);
 const aggregate=(parent,children)=>add(`IFCRELAGGREGATES(${guid()},${owner},$,$,${parent},${list(children)})`);
 aggregate(project,[site]);aggregate(site,[building]);
 const prop=(name,type,value)=>add(`IFCPROPERTYSINGLEVALUE(${str(name)},$,${type}(${typeof value==='number'?num(value):str(value)}),$)`);
 const properties=(object,name,props)=>{const set=add(`IFCPROPERTYSET(${guid()},${owner},${str(name)},$,${list(props)})`);add(`IFCRELDEFINESBYPROPERTIES(${guid()},${owner},$,$,(${object}),${set})`);};
 properties(building,'FORM_Design',[prop('Copyright','IFCTEXT','© 2026 Mostafa A. Gabr. All rights reserved.'),prop('ModelStatus','IFCLABEL','Concept massing; no structural or regulatory validation'),prop('EditableParametersJSON','IFCTEXT',JSON.stringify(state)),prop('ModelledFloorArea','IFCAREAMEASURE',modelData(state).totalArea)]);
 const plans=floorPlans(state),storeys=[];let lastStorey,lastPlacement;
 const slab=(p,storey,pos,roof=false)=>{
  const thickness=p.id.startsWith('podium')?.3:.23;
  const points=p.points.map(([x,y])=>add(`IFCCARTESIANPOINT((${num(x)},${num(y)}))`));
  const poly=add(`IFCPOLYLINE(${list([...points,points[0]])})`),profile=add(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${poly})`),solid=add(`IFCEXTRUDEDAREASOLID(${profile},${axis},${down},${num(thickness)})`),rep=add(`IFCSHAPEREPRESENTATION(${context},'Body','SweptSolid',(${solid}))`),shape=add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${rep}))`);
  const el=add(`IFCSLAB(${guid()},${owner},${str(p.name+' slab')},'Concept slab; nominal thickness, not structural design',$,${pos},${shape},$,.${roof?'ROOF':'FLOOR'}.)`);
  add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${guid()},${owner},$,$,(${el}),${storey})`);
  properties(el,'FORM_Slab',[prop('NominalThickness','IFCLENGTHMEASURE',thickness),prop('ModelledArea','IFCAREAMEASURE',p.area),prop('BaseLevel','IFCLENGTHMEASURE',p.elevation)]);
 };
 for(const p of plans){const pos=placement(buildingPos,p.elevation),storey=add(`IFCBUILDINGSTOREY(${guid()},${owner},${str(p.name)},$,$,${pos},$,$,.ELEMENT.,${num(p.elevation)})`);storeys.push(storey);lastStorey=storey;lastPlacement=pos;slab(p,storey,placement(pos));if(state.podium&&p.id==='podium-'+state.podiumFloors)slab({...p,name:'Podium roof',elevation:p.elevation+state.storey},storey,placement(pos,state.storey),true);}
 aggregate(building,storeys);
 const d=modelData(state);slab({id:'roof',name:'Tower roof',points:d.rings.at(-1).points,elevation:d.height,area:area(d.rings.at(-1).points)},lastStorey,placement(lastPlacement,state.storey),true);
 // Open concept envelope as an explicitly identified proxy, not fabricated walls.
 const coords=[],faces=[];
 const band=(a,b,y0,y1)=>{const offset=coords.length;for(const [x,y]of a)coords.push([x,y,y0]);for(const [x,y]of b)coords.push([x,y,y1]);const n=a.length;for(let i=0;i<n;i++){const j=(i+1)%n;faces.push([offset+i+1,offset+j+1,offset+n+j+1],[offset+i+1,offset+n+j+1,offset+n+i+1]);}};
 for(let i=0;i<d.layers.length-1;i++){const a=d.layers[i],b=d.layers[i+1];band(a.points,b.points,a.y,b.y);}
 if(state.podium){const p=footprint('rectangle',state.podiumWidth,state.podiumDepth);band(p,p,0,d.base);}
 const vertices=add(`IFCCARTESIANPOINTLIST3D(${list(coords.map(p=>list(p.map(num))))})`),mesh=add(`IFCTRIANGULATEDFACESET(${vertices},$,.F.,${list(faces.map(list))},$)`),rep=add(`IFCSHAPEREPRESENTATION(${context},'Body','Tessellation',(${mesh}))`),shape=add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${rep}))`),proxy=add(`IFCBUILDINGELEMENTPROXY(${guid()},${owner},'Concept envelope','Open massing surface, not a detailed wall system','Concept envelope',${placement(buildingPos)},${shape},$,.USERDEFINED.)`);
 add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${guid()},${owner},$,$,(${proxy}),${building})`);
 return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('FORM conceptual BIM export'),'2;1');\nFILE_NAME(${str(state.name+'.ifc')},${str(new Date().toISOString())},('Mostafa A. Gabr'),('FORM'),'FORM IFC exporter','FORM','Copyright 2026 Mostafa A. Gabr. All rights reserved.');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`;
}
