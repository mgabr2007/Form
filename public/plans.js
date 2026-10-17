import {modelData,footprint,area} from './geometry.js';
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function floorPlans(state){
 const d=modelData(state),plans=[];
 if(state.podium)for(let i=0;i<state.podiumFloors;i++)plans.push({id:'podium-'+(i+1),name:'Podium · Floor '+(i+1),points:footprint('rectangle',state.podiumWidth,state.podiumDepth),elevation:i*state.storey,area:d.podiumArea});
 d.rings.slice(0,-1).forEach((r,i)=>plans.push({id:'tower-'+(i+1),name:'Tower · Floor '+(i+1),points:r.points,regions:r.regions,balconies:r.balconies,balconyArea:r.balconyArea,elevation:r.y,area:r.area}));
 return plans;
}
export function planSVG(plan,{project='FORM',dimensions=true,below=null}={}){
 const lower=Array.isArray(below)?below:below?[below]:[];
 const regions=p=>[...(p.regions||[[p.points]]),...(p.balconies||[])];
 const pts=regions(plan).flat(2),all=[...(pts.length?pts:plan.points),...lower.flatMap(p=>regions(p).flat(2))];
 if(!pts.length)pts.push(...plan.points);
 const xs=all.map(p=>p[0]),ys=all.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min(660/Math.max(maxX-minX,1),460/Math.max(maxY-minY,1));
 const cx=(minX+maxX)/2,cy=(minY+maxY)/2,X=x=>500+(x-cx)*scale,Y=y=>350-(y-cy)*scale;
 const points=p=>p.map(([x,y])=>`${X(x).toFixed(3)},${Y(y).toFixed(3)}`).join(' ');
 const path=r=>r.map(p=>'M'+p.map(([x,y])=>`${X(x).toFixed(3)},${Y(y).toFixed(3)}`).join('L')+'Z').join(' ');
 const left=X(Math.min(...pts.map(p=>p[0]))),right=X(Math.max(...pts.map(p=>p[0]))),top=Y(Math.max(...pts.map(p=>p[1]))),bottom=Y(Math.min(...pts.map(p=>p[1])));
 const dimY=bottom+35,dimX=right+35;
 const dim=dimensions?`<g stroke="#839476" stroke-width="1" fill="none"><path d="M${left} ${bottom+8}V${dimY+8} M${right} ${bottom+8}V${dimY+8} M${left} ${dimY}H${right} M${right+8} ${top}H${dimX+8} M${right+8} ${bottom}H${dimX+8} M${dimX} ${top}V${bottom}"/><path d="M${left-4} ${dimY+4}l8 -8 M${right-4} ${dimY+4}l8 -8 M${dimX-4} ${top+4}l8 -8 M${dimX-4} ${bottom+4}l8 -8"/></g><g fill="#526347" font-size="13" text-anchor="middle"><text x="${(left+right)/2}" y="${dimY+21}">${((right-left)/scale).toFixed(2)} m</text><text transform="translate(${dimX+21},${(top+bottom)/2}) rotate(-90)">${((bottom-top)/scale).toFixed(2)} m</text></g>`:'';
 const unit=10**Math.floor(Math.log10(140/scale)),barMetres=Number(([1,2,5].filter(v=>v*unit*scale<=160).at(-1)*unit).toPrecision(3)),barWidth=barMetres*scale;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="760" viewBox="0 0 1000 760" role="img" aria-label="${xml(plan.name)} floor outline" font-family="Arial,sans-serif"><rect width="1000" height="760" fill="#fbfcf8"/><defs><pattern id="planGrid" width="${scale*5}" height="${scale*5}" patternUnits="userSpaceOnUse" x="${X(0)}" y="${Y(0)}"><path d="M${scale*5} 0H0V${scale*5}" fill="none" stroke="#e8ecdf" stroke-width=".7"/></pattern></defs><rect x="70" y="80" width="860" height="550" fill="url(#planGrid)"/><text x="45" y="33" font-size="10" letter-spacing="2" fill="#89957c">FORM / 2D PLAN</text><text x="45" y="60" font-size="21" fill="#2c3d27">${xml(plan.name)}</text><text x="955" y="40" text-anchor="end" font-size="12" fill="#708160">Base elevation +${plan.elevation.toFixed(2)} m</text>${lower.flatMap(p=>regions(p).map(r=>`<path data-floor-below="${xml(p.id)}" d="${path(r)}" fill="none" stroke="#737c70" stroke-width="1.5"><title>${xml(p.name)}</title></path>`)).join('')}${regions(plan).map((r,i)=>`<path data-selected-floor="true" d="${path(r)}" fill-rule="evenodd" fill="${i<(plan.regions||[[plan.points]]).length?'#e6eddb':'#f3ead6'}" stroke="#2c4327" stroke-width="2.8" stroke-linejoin="round"/>`).join('')}${dim}<g transform="translate(890,100)" stroke="#758868" fill="#758868"><path d="M0 40V0 M0 40H40" fill="none"/><path d="M-3 6L0 0L3 6 M34 37L40 40L34 43" fill="none"/><text x="-8" y="-8" stroke="none" font-size="10">+Y</text><text x="44" y="44" stroke="none" font-size="10">+X</text></g><path d="M40 655H960" stroke="#dce4d1"/><text x="45" y="682" font-size="15" fill="#2c3d27">${xml(project)}</text><text x="45" y="705" font-size="11" fill="#7c8c6c">Floor outline · ${plan.area.toFixed(2)} m²${plan.balconyArea?` + ${plan.balconyArea.toFixed(2)} m² balconies`:""} · dimensions are axis-aligned overall extents</text><text x="45" y="729" font-size="10" fill="#8a967e">Concept massing plan. No internal partitions, core, doors, or structural layout. © 2026 Mostafa A. Gabr.</text><g transform="translate(760,704)" stroke="#536b42" fill="#536b42"><path d="M0 -5V5 M0 0H${barWidth} M${barWidth} -5V5"/><text x="0" y="19" stroke="none" font-size="10">0</text><text x="${barWidth}" y="19" text-anchor="end" stroke="none" font-size="10">${barMetres} m</text></g>${lower.length?`<text x="955" y="630" text-anchor="end" font-size="13" fill="#596452">Thin grey: ${lower.length===1?'one floor below':lower.length+' floors below'} · Bold green: selected floor</text>`:''}</svg>`;
}
export function planDXF(plan){
 const out=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','9','$INSUNITS','70','6','0','ENDSEC','0','SECTION','2','ENTITIES'];
 for(const [j,r]of [...(plan.regions||[[plan.points]]),...(plan.balconies||[])].entries())for(const [k,points]of r.entries()){
 out.push('0','LWPOLYLINE','100','AcDbEntity','8',plan.id.toUpperCase().replaceAll('-','_')+(j?'_REGION_'+j:'')+(k?'_VOID_'+k:''),'100','AcDbPolyline','90',String(points.length),'70','1');
 for(const [x,y]of points)out.push('10',String(x),'20',String(y));}
 out.push('0','ENDSEC','0','EOF');return out.join('\n')+'\n';
}
