import {exportIFC} from './ifc.js';
import {floorPlans,planSVG,planDXF} from './plans.js';
import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {GLTFExporter} from './vendor/GLTFExporter.js';
import {defaults,specs,normalize,modelData,footprint,modifierOptions} from './geometry.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let state=defaults(),mode='facade',data,group,reference=null,referenceState=null,renderer,scene,camera,controls,perspective,ortho,view='perspective';
let history=[],future=[],pending=false,toastTimer,storageAvailable=true;
const KEY='form-studio-v1',SAVED='form-studio-saved-v1';
const copy=x=>structuredClone(x),fmt=n=>Math.round(n).toLocaleString('en-US'),safeName=()=>state.name.replace(/[^a-z0-9_-]+/gi,'-').toLowerCase()||'form-tower';
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
try{const previous=localStorage.getItem(KEY);if(previous)state=normalize(JSON.parse(previous));}catch{storageAvailable=false;}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{if(storageAvailable)toast('Browser storage unavailable. Export JSON to save.');storageAvailable=false;}}
function remember(){history.push(copy(state));if(history.length>60)history.shift();future=[];}
function replace(next,record=true){if(record)remember();state=normalize(next);renderControls();schedule();}
function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;rebuild();persist();});}
const defs={base:[['width','Width',12,80,1,'m'],['depth','Depth',12,80,1,'m'],['orientation','Orientation',-180,180,1,'°']],height:[['floors','Tower storeys',5,100,1,''],['storey','Floor-to-floor',2.8,5.5,.1,'m']],podium:[['podiumFloors','Podium storeys',1,8,1,''],['podiumWidth','Width',25,110,1,'m'],['podiumDepth','Depth',25,110,1,'m']]};
function controlHTML(key,label,min,max,step,unit,value){return `<div class="control"><div class="control-row"><label for="n-${key}">${label}</label><div class="number-wrap"><input id="n-${key}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" data-key="${key}"><span>${unit}</span></div></div><input type="range" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${value}" data-key="${key}" style="--fill:${(value-min)/(max-min)*100}%"></div>`;}
function bindControl(container,onValue){
 container.querySelectorAll('[data-key]').forEach(el=>{
  el.addEventListener('focus',()=>{el.dataset.before=JSON.stringify(state);});
  el.addEventListener('pointerdown',()=>{el.dataset.before=JSON.stringify(state);});
  el.addEventListener('input',()=>{if(el.value===''||!Number.isFinite(+el.value))return;const v=Math.max(+el.min,Math.min(+el.max,+el.value));onValue(el.dataset.key,v);container.querySelectorAll('[data-key="'+el.dataset.key+'"]').forEach(other=>{if(other!==el)other.value=v;if(other.type==='range')other.style.setProperty('--fill',((v-+el.min)/(+el.max-+el.min)*100)+'%');});schedule();});
  el.addEventListener('change',()=>{if(el.dataset.before){history.push(JSON.parse(el.dataset.before));if(history.length>60)history.shift();future=[];el.dataset.before=JSON.stringify(state);}if(container.id==='height-controls'){renderModifiers();}renderMetrics();});
  el.addEventListener('blur',()=>{if(el.value==='')renderControls();else el.value=onRead(el.dataset.key);});
 });
}
function onRead(key){if(key.startsWith('mod-'))return state.modifiers[+key.slice(4)]?.value??0;return state[key];}
function renderControls(){
 $('#project-name').value=state.name;
 for(const [name,definition]of Object.entries(defs)){const container=$('#'+name+'-controls');container.innerHTML=definition.map(d=>controlHTML(...d,state[d[0]])).join('');bindControl(container,(key,v)=>{state[key]=['floors','podiumFloors'].includes(key)?Math.round(v):v;if(key==='floors')for(const m of state.modifiers){m.start=Math.min(m.start,state.floors);m.end=Math.max(m.start,Math.min(m.end,state.floors));}});}
 $$('#shapes button').forEach(b=>b.classList.toggle('selected',b.dataset.shape===state.shape));$('#podium-toggle').checked=state.podium;$('#podium-controls').hidden=!state.podium;renderModifiers();renderSaved();
}
const symbols={twist:'⤨',taper:'⋀',leanX:'↗',leanZ:'↖',bend:'⌒',bulge:'◈',setback:'⌑',morph:'◇',corners:'▢',wave:'∿',terraces:'▱',offsets:'⇆',atrium:'▣',notch:'⊏',localRotate:'↻',balcony:'⊞',slender:'↔'};
function modifierFields(m,i){const values=modifierOptions(m);return Object.entries(specs[m.type].options||{}).map(([key,p])=>`<label class="modifier-option">${p.label}${p.choices?`<select data-option="${key}" data-index="${i}">${p.choices.map(v=>`<option value="${v}" ${values[key]===v?'selected':''}>${v}</option>`).join('')}</select>`:`<input type="number" data-option="${key}" data-index="${i}" min="${p.min}" max="${p.max}" step="${p.step}" value="${values[key]}">`}</label>`).join('');}
function renderModifiers(){
 $('#mod-count').textContent=state.modifiers.length;
 $('#modifier-list').innerHTML=state.modifiers.length?state.modifiers.map((m,i)=>{const p=specs[m.type];return `<div class="mod-card ${m.enabled?'':'disabled'}"><div class="mod-head"><span class="mod-symbol">${symbols[m.type]}</span><b>${p.name}</b><label class="switch"><input data-toggle="${i}" type="checkbox" ${m.enabled?'checked':''} aria-label="Enable ${p.name}"><span></span></label><button class="delete-mod" data-delete="${i}" aria-label="Remove ${p.name}">×</button></div>${controlHTML('mod-'+i,({setback:'Reduction',atrium:'Opening width',notch:'Cut depth',balcony:'Projection',slender:'Width/depth multiplier',localRotate:'Rotation'}[m.type]||'Amount'),p.min,p.max,p.step,p.unit,m.value)}${modifierFields(m,i)}<div class="range-pair"><label>From tower floor<input type="number" min="1" max="${state.floors}" value="${m.start}" data-floor="start" data-index="${i}"></label>${m.type!=='setback'?`<label>To tower floor<input type="number" min="${m.start}" max="${state.floors}" value="${m.end}" data-floor="end" data-index="${i}"></label>`:'<label>Continues to roof</label>'}</div></div>`;}).join(''):'<p class="note">A clean starting point. Add a modifier to begin shaping.</p>';
 bindControl($('#modifier-list'),(key,v)=>{state.modifiers[+key.slice(4)].value=v;});
 $$('[data-toggle]').forEach(b=>b.onchange=()=>{remember();state.modifiers[+b.dataset.toggle].enabled=b.checked;renderModifiers();schedule();});
 $$('[data-delete]').forEach(b=>b.onclick=()=>{remember();state.modifiers.splice(+b.dataset.delete,1);renderModifiers();schedule();});
 $$('[data-floor]').forEach(b=>b.onchange=()=>{remember();const m=state.modifiers[+b.dataset.index];m[b.dataset.floor]=Math.max(1,Math.min(state.floors,Math.round(+b.value)||1));if(m.end<m.start)m.end=m.start;renderModifiers();schedule();});
 $$('[data-option]').forEach(b=>b.onchange=()=>{remember();const m=state.modifiers[+b.dataset.index];m[b.dataset.option]=b.value;Object.assign(m,modifierOptions(m));renderModifiers();schedule();});
 $('#add-modifier').disabled=state.modifiers.length>=12;
}
function renderMetrics(){data=modelData(state);renderPlans();$('#metric-height').innerHTML=data.height.toFixed(1)+'<em>m</em>';$('#metric-floors').textContent=state.floors+(state.podium?state.podiumFloors:0);$('#floor-breakdown').textContent=state.floors+' tower'+(state.podium?' + '+state.podiumFloors+' podium':'');$('#metric-area').innerHTML=fmt(data.totalArea)+'<em>m²</em>';$('#metric-footprint').innerHTML=fmt(data.areas[0])+'<em>m²</em>';}
function geometry(pos){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;}
function addBand(out,p,q,y0,y1){for(let j=0;j<p.length;j++){const k=(j+1)%p.length,a=[p[j][0],y0,p[j][1]],b=[p[k][0],y0,p[k][1]],c=[q[k][0],y1,q[k][1]],d=[q[j][0],y1,q[j][1]];out.push(...a,...c,...b,...a,...d,...c);}}
function addCap(out,points,y,holes=[]){const rings=[points,...holes],flat=rings.flat(),triangles=THREE.ShapeUtils.triangulateShape(points.map(([x,z])=>new THREE.Vector2(x,z)),holes.map(h=>h.map(([x,z])=>new THREE.Vector2(x,z))));for(const t of triangles)for(const i of [t[0],t[2],t[1]])out.push(flat[i][0],y,flat[i][1]);}
function addPlate(out,region,y,thickness=.23){addCap(out,region[0],y,region.slice(1));const bottom=[];addCap(bottom,region[0],y-thickness,region.slice(1));for(let i=0;i<bottom.length;i+=9)out.push(...bottom.slice(i,i+3),...bottom.slice(i+6,i+9),...bottom.slice(i+3,i+6));for(const ring of region)addBand(out,ring,ring,y-thickness,y);}
function building(s,isReference=false){
 const d=modelData(s),root=new THREE.Group();root.name=s.name;root.userData={units:'metres',towerStoreys:s.floors,podiumStoreys:s.podium?s.podiumFloors:0,parameters:JSON.stringify(s)};
 const glass=new THREE.MeshStandardMaterial({color:isReference?0xc9d2b7:0x9db2a6,roughness:.44,metalness:.22,side:THREE.DoubleSide,transparent:isReference,opacity:isReference?.45:1});
 const stone=new THREE.MeshStandardMaterial({color:isReference?0xb7c6a1:0xe0e5d3,roughness:.78,side:THREE.DoubleSide,transparent:isReference,opacity:isReference?.55:1});
 const mass=new THREE.MeshStandardMaterial({color:isReference?0xb7c6a1:0xbdcbb1,roughness:.85,side:THREE.DoubleSide,transparent:isReference,opacity:isReference?.5:1});
 const skin=[],slabs=[],lines=[],ribs=[];
 if(d.hasCuts){for(let i=0;i<s.floors;i++){const r=d.rings[i];for(const region of r.regions)for(const p of region){addBand(skin,p,p,r.y,r.y+s.storey);if(mode==='facade')for(const [x,z]of p)ribs.push(x,r.y,z,x,r.y+s.storey,z);}}}
 else for(let i=0;i<d.layers.length-1;i++){const a=d.layers[i],b=d.layers[i+1];addBand(skin,a.points,b.points,a.y,b.y);if(mode==='facade')for(let j=0;j<a.points.length;j++)ribs.push(a.points[j][0],a.y,a.points[j][1],b.points[j][0],b.y,b.points[j][1]);}
 for(const r of d.rings)for(const region of [...r.regions,...r.balconies]){addPlate(slabs,region,r.y);for(const p of region)for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];lines.push(a[0],r.y+.012,a[1],b[0],r.y+.012,b[1]);}}
 if(s.podium){const p=footprint('rectangle',s.podiumWidth,s.podiumDepth);addBand(skin,p,p,0,d.base);for(let i=0;i<=s.podiumFloors;i++){addCap(slabs,p,i*s.storey);addBand(slabs,p,p,Math.max(0,i*s.storey-.3),i*s.storey);for(let j=0;j<p.length;j++){const q=p[(j+1)%p.length];lines.push(p[j][0],i*s.storey+.01,p[j][1],q[0],i*s.storey+.01,q[1]);if(mode==='facade')ribs.push(p[j][0],0,p[j][1],p[j][0],d.base,p[j][1]);}}}
 if(mode!=='floors'){const mesh=new THREE.Mesh(geometry(skin),mode==='mass'?mass:glass);mesh.name='Envelope';root.add(mesh);}
 const deck=new THREE.Mesh(geometry(slabs),mode==='mass'?mass:stone);deck.name='Floor plates';root.add(deck);
 if(mode!=='mass'){const edges=new THREE.LineSegments(geometry(lines),new THREE.LineBasicMaterial({color:isReference?0x9aaf81:0x7b9279,transparent:true,opacity:.48}));edges.name='Floor edges';root.add(edges);}
 if(mode==='facade'){const fins=new THREE.LineSegments(geometry(ribs),new THREE.LineBasicMaterial({color:isReference?0xabb994:0xdde4d3,transparent:true,opacity:.6}));fins.name='Facade divisions';root.add(fins);}
 return root;
}
function dispose(root){root.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose();}});scene.remove(root);}
function rebuild(){renderMetrics();if(!scene)return;if(group)dispose(group);group=building(state);scene.add(group);if(reference){dispose(reference);reference=null;}if(referenceState){reference=building(referenceState,true);const a=new THREE.Box3().setFromObject(group),b=new THREE.Box3().setFromObject(reference);reference.position.x=a.max.x-b.min.x+30;scene.add(reference);}$('#build-status').textContent=reference?'Comparing two designs':'Geometry up to date';$('#compare-label').hidden=!reference;}
function fit(nextView=view){
 if(!renderer||!group)return;view=nextView;const box=new THREE.Box3().setFromObject(group);if(reference)box.union(new THREE.Box3().setFromObject(reference));const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),w=$('#viewport').clientWidth,h=$('#viewport').clientHeight,aspect=w/h;
 const radius=Math.max(size.y,size.x/aspect,size.z/aspect,30),distance=radius*1.95;
 controls?.dispose();camera=view==='perspective'?perspective:ortho;camera.up.set(0,1,0);
 if(view==='perspective')camera.position.copy(center).add(new THREE.Vector3(distance*.77,distance*.32,distance));
 else{const half=Math.max(size.y,size.x/aspect,size.z/aspect,30)*.64;ortho.left=-half*aspect;ortho.right=half*aspect;ortho.top=half;ortho.bottom=-half;ortho.zoom=1;if(view==='top'){camera.position.copy(center).add(new THREE.Vector3(0,distance*2,0));camera.up.set(0,0,-1);}else camera.position.copy(center).add(view==='front'?new THREE.Vector3(0,0,distance*2):new THREE.Vector3(distance*2,0,0));}
 camera.near=.1;camera.far=6000;camera.updateProjectionMatrix();controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(center);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=5;controls.maxDistance=3000;controls.maxPolarAngle=Math.PI*.51;controls.enableRotate=view==='perspective';controls.update();$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#rotate').classList.remove('active');
}
function init3D(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0xeff1e9);scene.fog=new THREE.Fog(0xeff1e9,850,2400);
 renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize($('#viewport').clientWidth,$('#viewport').clientHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;$('#canvas-wrap').appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','3D tower. Drag to orbit and scroll to zoom.');
 perspective=new THREE.PerspectiveCamera(34,$('#viewport').clientWidth/$('#viewport').clientHeight,.1,6000);ortho=new THREE.OrthographicCamera(-100,100,100,-100,.1,6000);
 scene.add(new THREE.HemisphereLight(0xffffff,0xabbf98,2.4));const sun=new THREE.DirectionalLight(0xfff6df,3.2);sun.position.set(-170,350,180);scene.add(sun);const fill=new THREE.DirectionalLight(0xd9e8f1,1.1);fill.position.set(200,100,-140);scene.add(fill);
 const grid=new THREE.GridHelper(1600,80,0xcbd4c0,0xd8dfce);grid.position.y=-.35;grid.material.transparent=true;grid.material.opacity=.42;scene.add(grid);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),new THREE.MeshBasicMaterial({color:0xeff1e9}));ground.rotation.x=-Math.PI/2;ground.position.y=-.5;scene.add(ground);
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,5,64,64,64);gradient.addColorStop(0,'rgba(73,91,55,0.26)');gradient.addColorStop(1,'rgba(73,91,55,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);const shadow=new THREE.Mesh(new THREE.PlaneGeometry(190,190),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.15;scene.add(shadow);
 rebuild();fit();$('#loading').hidden=true;
 new ResizeObserver(()=>{const w=$('#viewport').clientWidth,h=$('#viewport').clientHeight;renderer.setSize(w,h);perspective.aspect=w/h;perspective.updateProjectionMatrix();if(camera===ortho){const half=(ortho.top-ortho.bottom)/2;ortho.left=-half*w/h;ortho.right=half*w/h;ortho.updateProjectionMatrix();}}).observe($('#viewport'));
 renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function exportFile(type){
 if(type==='png'&&!$('#plans-panel').hidden){$('#export-dialog').close();$('[data-plan-export="png"]').click();return;}
 try{
 if(type==='ifc')download(new Blob([exportIFC(state)],{type:'application/x-step'}),safeName()+'.ifc');
 if(type==='json')download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),safeName()+'.json');
 if(type==='png'){if(!renderer)throw Error('3D rendering is unavailable on this browser.');renderer.render(scene,camera);const blob=await new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/png'));if(!blob)throw Error('Image export failed.');download(blob,safeName()+'.png');}
 if(type==='glb'){if(!group)throw Error('3D rendering is unavailable on this browser.');const result=await new GLTFExporter().parseAsync(group,{binary:true,onlyVisible:true});download(new Blob([result],{type:'model/gltf-binary'}),safeName()+'.glb');}
 if(type==='csv'){const quote=v=>'"'+String(v).replaceAll('"','""')+'"';const rows=[['FORM project',state.name],['Units','m / m² / degrees'],['Metric','Value'],['Overall height (m)',data.height],['Total modelled floor area (m²)',data.totalArea],['Balcony area (m²)',data.balconyArea],[],['Section','Floor','Base elevation (m)','Floor-to-floor (m)','Modelled floor area (m²)']];if(state.podium)for(let i=0;i<state.podiumFloors;i++)rows.push(['Podium',i+1,i*state.storey,state.storey,data.podiumArea]);data.areas.forEach((a,i)=>rows.push(['Tower',i+1,data.base+i*state.storey,state.storey,a.toFixed(3)]));rows.push([],['Parameter','Value']);for(const [k,v]of Object.entries(state))if(k!=='modifiers')rows.push([k,v]);rows.push([],['Modifier','Value','Unit','From floor','To floor','Enabled','Options JSON']);state.modifiers.forEach(m=>rows.push([specs[m.type].name,m.value,specs[m.type].unit,m.start,m.type==='setback'?state.floors:m.end,m.enabled,JSON.stringify(modifierOptions(m))]));download(new Blob(['\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),safeName()+'.csv');}
 if(type==='dxf'){let out=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','9','$INSUNITS','70','6','0','ENDSEC','0','SECTION','2','ENTITIES'];const add=(pts,layer)=>{out.push('0','LWPOLYLINE','100','AcDbEntity','8',layer,'100','AcDbPolyline','90',String(pts.length),'70','1');for(const [x,y]of pts)out.push('10',String(x),'20',String(y));};data.rings.slice(0,-1).forEach((r,i)=>[...r.regions,...r.balconies].forEach((region,j)=>region.forEach((pts,k)=>add(pts,'TOWER_FLOOR_'+String(i+1).padStart(3,'0')+'_REGION_'+j+(k?'_VOID_'+k:'')))));if(state.podium)for(let i=0;i<state.podiumFloors;i++)add(footprint('rectangle',state.podiumWidth,state.podiumDepth),'PODIUM_FLOOR_'+String(i+1).padStart(2,'0'));out.push('0','ENDSEC','0','EOF');download(new Blob([out.join('\n')+'\n'],{type:'application/dxf'}),safeName()+'.dxf');}
 $('#export-dialog').close();toast(type.toUpperCase()+' exported');
 }catch(e){toast('Export failed: '+e.message);}
}
function saved(){try{return JSON.parse(localStorage.getItem(SAVED)||'[]');}catch{return[];}}
function renderSaved(){const list=$('#saved-list');list.replaceChildren();const items=saved();if(!items.length){const p=document.createElement('p');p.className='note';p.textContent='Save a design to build your own collection.';list.append(p);}items.forEach((item,index)=>{const div=document.createElement('div');div.className='saved-card';const title=document.createElement('b');title.textContent=item.state.name;const desc=document.createElement('small');desc.textContent=item.state.floors+' tower storeys · '+new Date(item.date).toLocaleDateString();const actions=document.createElement('div');actions.className='saved-actions';for(const label of ['Load','Compare','Delete']){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{if(label==='Load'){replace(item.state);requestAnimationFrame(()=>fit());toast('Design loaded');}if(label==='Compare'){referenceState=normalize(item.state);rebuild();fit();toast('Saved design shown alongside current model');}if(label==='Delete'){try{const all=saved();all.splice(index,1);localStorage.setItem(SAVED,JSON.stringify(all));renderSaved();}catch{toast('Could not update browser storage.');}}};actions.append(b);}div.append(title,desc,actions);list.append(div);});}
const presets=[{name:'The Helix',sub:'Twist + taper',shape:'rounded',mods:[['twist',80],['taper',18]]},{name:'Quiet Monolith',sub:'Pure proportions',shape:'rectangle',mods:[]},{name:'Soft Contour',sub:'Curved silhouette',shape:'ellipse',mods:[['bulge',35],['taper',20]]},{name:'Sky Terraces',sub:'Stepped skyline',shape:'rectangle',mods:[['setback',18,17],['setback',22,33]]},{name:'The Arc',sub:'Bend + taper',shape:'rounded',mods:[['bend',22],['taper',30]]},{name:'Leaning Light',sub:'Offset centreline',shape:'hexagon',mods:[['leanX',22],['twist',25],['taper',15]]}];
function presetState(p){return{...defaults(),name:p.name,shape:p.shape,modifiers:p.mods.map(([type,value,start],i)=>({id:'preset-'+i,type,value,start:start||1,end:48,enabled:true}))};}
$('#presets').innerHTML=presets.map((p,i)=>{const d=modelData(presetState(p));const lines=d.rings.filter((_,j)=>j%3===0).map(r=>{const xs=r.points.map(a=>a[0]),left=Math.min(...xs),right=Math.max(...xs);return `<path d="M${50+left*.8} ${78-r.y*.38} L${50+right*.8} ${78-r.y*.38}"/>`;}).join('');return `<button class="preset" data-preset="${i}"><svg viewBox="0 0 100 80" fill="none" stroke="#8c9f75" stroke-width="1">${lines}</svg><b>${p.name}</b><small>${p.sub}</small></button>`;}).join('');
$$('[data-preset]').forEach(b=>b.onclick=()=>{replace(presetState(presets[+b.dataset.preset]));requestAnimationFrame(()=>fit());toast('Starting point loaded');});
$$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(t=>t.classList.toggle('active',t===b));$$('.panel-content').forEach(p=>p.hidden=p.id!=='panel-'+b.dataset.tab);});
$$('[data-shape]').forEach(b=>b.onclick=()=>{remember();state.shape=b.dataset.shape;renderControls();schedule();});
$('#project-name').onchange=e=>{remember();state.name=e.target.value.trim()||'Untitled tower';e.target.value=state.name;renderPlans();persist();};
$('#podium-toggle').onchange=e=>{remember();state.podium=e.target.checked;$('#podium-controls').hidden=!state.podium;schedule();};
$('#reset').onclick=()=>{replace(defaults());referenceState=null;requestAnimationFrame(()=>{rebuild();fit();});};
$('#modifier-library').innerHTML=Object.entries(specs).map(([key,p])=>`<button class="library-item" data-add="${key}"><span class="mod-symbol">${symbols[key]}</span><div><b>${p.name}</b><small>${p.description}</small></div><span>＋</span></button>`).join('');
$$('[data-add]').forEach(b=>b.onclick=()=>{if(state.modifiers.length>=12)return;remember();const type=b.dataset.add;state.modifiers.push({id:crypto.randomUUID(),type,value:specs[type].value,start:type==='setback'?Math.round(state.floors*.6):1,end:state.floors,enabled:true,...modifierOptions({type})});renderModifiers();schedule();$('#modifier-dialog').close();});
$('#add-modifier').onclick=()=>$('#modifier-dialog').showModal();$('#export').onclick=()=>$('#export-dialog').showModal();$('#help').onclick=()=>$('#help-dialog').showModal();$$('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$$('[data-export]').forEach(b=>b.onclick=()=>exportFile(b.dataset.export));
$$('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;$$('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));rebuild();});
$$('[data-view]').forEach(b=>b.onclick=()=>{if(renderer)fit(b.dataset.view);});$('#fit').onclick=()=>{if(renderer)fit();};$('#rotate').onclick=()=>{if(!controls)return;if(view!=='perspective')fit('perspective');controls.autoRotate=!controls.autoRotate;controls.autoRotateSpeed=.65;$('#rotate').classList.toggle('active',controls.autoRotate);};
$('#save').onclick=()=>{try{const all=saved();all.unshift({date:new Date().toISOString(),state:copy(state)});localStorage.setItem(SAVED,JSON.stringify(all.slice(0,30)));renderSaved();toast('Design saved on this browser');}catch{toast('Storage unavailable. Export project JSON instead.');}};
$('#clear-compare').onclick=()=>{referenceState=null;rebuild();fit();};$('#import').onclick=()=>$('#file-input').click();$('#file-input').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1e6)throw Error('Project file is too large.');replace(JSON.parse(await file.text()));requestAnimationFrame(()=>fit());toast('Project imported');}catch(err){toast(err.message);}e.target.value='';};
$('#mobile-controls').onclick=()=>$('#sidebar').classList.add('open');$('#sidebar-close').onclick=()=>$('#sidebar').classList.remove('open');
function undoRedo(redo=false){const from=redo?future:history,to=redo?history:future;if(from.length){to.push(copy(state));state=from.pop();renderControls();schedule();toast(redo?'Redo':'Undo');}else toast(redo?'Nothing to redo':'Nothing to undo');}
$('#undo').onclick=()=>undoRedo();$('#redo').onclick=()=>undoRedo(true);
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();const from=e.shiftKey?future:history,to=e.shiftKey?history:future;if(from.length){to.push(copy(state));state=from.pop();renderControls();schedule();toast(e.shiftKey?'Redo':'Undo');}}});
renderControls();renderMetrics();try{init3D();}catch(err){$('#loading').hidden=true;$('#error').hidden=false;$('#error').textContent='The 3D viewer encountered a startup error. Project controls and JSON/CSV exports remain available. Details: '+err.message;console.error(err);}

function renderPlans(){
 const selector=$('#plan-floor'),previous=selector.value,plans=floorPlans(state);
 selector.replaceChildren(...plans.map(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;return o;}));
 selector.value=plans.some(p=>p.id===previous)?previous:plans.find(p=>p.id.startsWith('tower-')).id;
 const index=selector.selectedIndex,plan=plans[index];
 $('#plan-drawing').innerHTML=planSVG(plan,{project:state.name,dimensions:$('#plan-dimensions').checked,below:$('#plan-below').dataset.mode==='all'?plans.slice(0,index):$('#plan-below').dataset.mode==='one'&&index>0?[plans[index-1]]:[]});
 $('#plan-info').textContent=plan.name+' · +'+plan.elevation.toFixed(2)+' m · '+plan.area.toFixed(2)+' m²'+(plan.balconyArea?' + '+plan.balconyArea.toFixed(2)+' m² balconies':'');
 $('#plan-prev').disabled=index===0;$('#plan-next').disabled=index===plans.length-1;
 $$('[data-below]').forEach(b=>{b.disabled=index===0&&b.dataset.below!=='none';b.setAttribute('aria-pressed',String(b.dataset.below===(index===0?'none':$('#plan-below').dataset.mode)));});
}
function setWorkspace(plans){
 $('#viewport').classList.toggle('show-plans',plans);$('#plans-panel').hidden=!plans;
 for(const [id,selected]of [['tab-plans',plans],['tab-3d',!plans]]){const b=$('#'+id);b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));}
 if(plans)renderPlans();
}
$('#tab-plans').onclick=()=>setWorkspace(true);$('#tab-3d').onclick=()=>setWorkspace(false);
$('#plan-floor').onchange=renderPlans;$('#plan-dimensions').onchange=renderPlans;$$('[data-below]').forEach(b=>b.onclick=()=>{$('#plan-below').dataset.mode=b.dataset.below;renderPlans();});
$('#plan-prev').onclick=()=>{$('#plan-floor').selectedIndex--;renderPlans();};$('#plan-next').onclick=()=>{$('#plan-floor').selectedIndex++;renderPlans();};
$$('[data-plan-export]').forEach(button=>button.onclick=async()=>{
 const type=button.dataset.planExport,plan=floorPlans(state).find(p=>p.id===$('#plan-floor').value),name=safeName()+'-'+plan.id;
 try{
  if(type==='dxf')download(new Blob([planDXF(plan)],{type:'application/dxf'}),name+'.dxf');
  else{
   const svg=new XMLSerializer().serializeToString($('#plan-drawing svg'));
   if(type==='svg')download(new Blob([svg],{type:'image/svg+xml'}),name+'.svg');
   else{const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Could not render plan image'));img.src=url;});const c=document.createElement('canvas');c.width=2000;c.height=1520;c.getContext('2d').drawImage(img,0,0,c.width,c.height);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG export failed');download(blob,name+'.png');}finally{URL.revokeObjectURL(url);}}
  }toast('Selected floor exported as '+type.toUpperCase());
 }catch(e){toast('Plan export failed: '+e.message);}
});
