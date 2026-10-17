// Cardinal sectors follow the same north/east basis as solarPosition.
export function facadeSector(normal,north=0){
 const a=north*Math.PI/180,e=normal[0]*Math.cos(a)-normal[2]*Math.sin(a),n=normal[0]*Math.sin(a)+normal[2]*Math.cos(a);
 const azimuth=(Math.atan2(e,n)*180/Math.PI+360)%360;
 return {index:Math.floor((azimuth+45)/90)%4,azimuth};
}
export function facadePanels(result,positions,indices,north){
 const panels=['North','East','South','West'].map((name,index)=>({name,index,triangles:[],samples:new Set()}));
 for(let t=0;t<indices.length;t++){
  const index=indices[t],sample=result.samples[index],sector=facadeSector(sample.normal,north).index,a=(north+sector*90)*Math.PI/180;
  const points=[];for(let k=0;k<3;k++){const p=t*9+k*3;points.push([-positions[p]*Math.cos(a)+positions[p+2]*Math.sin(a),positions[p+1]]);}
  panels[sector].triangles.push({index,points});panels[sector].samples.add(index);
 }
 return panels;
}
export function createFacadeUnfold(getData,onSelect){
 const dialog=document.createElement('dialog');dialog.id='facade-unfold';dialog.setAttribute('aria-labelledby','unfold-title');
 dialog.innerHTML=`<div class="dialog-head"><div><span class="eyebrow">FORM / FAÇADE ATLAS</span><h2 id="unfold-title">Unfolded façade views</h2><p data-subtitle></p></div><button class="icon" data-close aria-label="Close façade views">×</button></div><p class="note">Four projected elevations, grouped by outward-facing direction (±45°). Shared height and colour scales. Curved and twisted faces are foreshortened; recessed surfaces may overlap. This is not a fabrication unfolding. Only sampled cells are shown.</p><div class="unfold-scroll" data-drawing></div><p class="sample-readout" data-readout role="status">Select a coloured cell to inspect its result.</p><button class="button" data-export>Export façade SVG ↗</button>`;
 document.body.append(dialog);const $=s=>dialog.querySelector(s),NS='http://www.w3.org/2000/svg';let svg;
 const node=(tag,attrs={},text)=>{const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
 $('[data-close]').onclick=()=>dialog.close();
 function render(){const d=getData();if(!d||d.result.settings.target!=='facade'){if(dialog.open)dialog.close();return;}
 const {result,positions,indices,north,scale,color,title,unit}=d,panels=facadePanels(result,positions,indices,north);
 $('[data-subtitle]').textContent=title+' · North rotation '+north+'°';
 let minY=Infinity,maxY=-Infinity;for(const p of panels){p.minX=Infinity;p.maxX=-Infinity;for(const t of p.triangles)for(const [x,y]of t.points){p.minX=Math.min(p.minX,x);p.maxX=Math.max(p.maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}if(!p.triangles.length){p.minX=0;p.maxX=1;}}
 if(!Number.isFinite(minY)){minY=0;maxY=1;}
 const factor=Math.min(430/Math.max(1,maxY-minY),230/Math.max(1,...panels.map(p=>p.maxX-p.minX))),bottom=535;
 svg=node('svg',{xmlns:NS,viewBox:'0 0 1160 655',role:'img','aria-label':'Four façade analysis elevations: North, East, South and West'});svg.append(node('rect',{width:1160,height:655,fill:'#f8faf7'}));
 svg.append(node('text',{x:30,y:28,fill:'#244334','font-size':15},title+' · north '+north+'°'));
 for(let j=0;j<=4;j++){const y=bottom-(maxY-minY)*factor*j/4;svg.append(node('line',{x1:53,x2:1135,y1:y,y2:y,stroke:'#dce4dc','stroke-dasharray':'3 5'}));svg.append(node('text',{x:48,y:y+4,'text-anchor':'end','font-size':10,fill:'#607066'},(minY+(maxY-minY)*j/4).toFixed(1)+' m'));}
 for(const p of panels){const left=60+p.index*270,centre=left+130;
 svg.append(node('text',{x:centre,y:63,'text-anchor':'middle','font-size':21,'font-weight':600,fill:'#244334'},p.name.toUpperCase()));
 svg.append(node('text',{x:centre,y:84,'text-anchor':'middle','font-size':11,fill:'#607066'},p.samples.size+' sample points'));
 if(p.index)svg.append(node('line',{x1:left-7,x2:left-7,y1:45,y2:570,stroke:'#587460','stroke-width':1.5,'stroke-dasharray':'6 5'}));
 for(const t of p.triangles){const value=result.values[t.index],path=node('polygon',{points:t.points.map(([x,y])=>[centre+(x-(p.minX+p.maxX)/2)*factor,bottom-(y-minY)*factor].join(',')).join(' '),fill:color(scale.ratio(value)),stroke:'#405347','stroke-width':.25,'data-sample':t.index});path.append(node('title',{},p.name+' · Sample '+(t.index+1)+' · '+value.toFixed(3)+' '+unit));svg.append(path);}
 if(!p.triangles.length)svg.append(node('text',{x:centre,y:300,'text-anchor':'middle','font-size':13,fill:'#607066'},'No sampled cells'));
 }
 for(let i=0;i<100;i++)svg.append(node('rect',{x:350+i*4.6,y:596,width:4.7,height:12,fill:color(scale.high-scale.low<1e-8?.5:i/99)}));
 svg.append(node('text',{x:340,y:607,'text-anchor':'end','font-size':12,fill:'#244334'},scale.low.toFixed(2)));
 svg.append(node('text',{x:820,y:607,'font-size':12,fill:'#244334'},scale.high.toFixed(2)+' '+unit));
 svg.append(node('text',{x:580,y:637,'text-anchor':'middle','font-size':11,fill:'#607066'},'Cell colours represent centre-point estimates • Elevation in metres • Projected views, not developed surface widths'));
 svg.onclick=e=>{const id=e.target.getAttribute('data-sample');if(id===null)return;const i=Number(id),s=result.samples[i],sector=facadeSector(s.normal,north);$('[data-readout]').textContent='Sample '+(i+1)+' · '+result.values[i].toFixed(3)+' '+unit+' · facing '+sector.azimuth.toFixed(1)+'° from north · elevation '+s.position[1].toFixed(2)+' m';onSelect(i);};
 $('[data-drawing]').replaceChildren(svg);
 }
 $('[data-export]').onclick=()=>{if(!svg)return;const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'})),a=document.createElement('a');a.href=url;a.download='form-facade-elevations.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);};
 return {open(){render();if(svg){$('[data-readout]').textContent='Select a coloured cell to inspect its result.';dialog.showModal();}},refresh(){if(dialog.open)render();},clear(){if(dialog.open)dialog.close();svg=null;}};
}
