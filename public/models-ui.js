import {normalizeImports,IMPORT_LIMITS,transformedTriangles,normalOf} from './imported-model.js';
import {parseModel,saveAsset,loadAsset,loadProjectAssets,exportPackage,importPackage} from './model-assets.js';
const $=s=>document.querySelector(s);
const node=(tag,text,attrs={})=>{const e=document.createElement(tag);if(text!==null)e.textContent=text;Object.assign(e,attrs);return e;};
const button=(text,fn)=>{const b=node('button',text,{type:'button',className:'button'});b.onclick=fn;return b;};
function field(text,control){const l=node('label',text,{className:'model-field'});l.append(control);return l;}
function select(options,value,change){const s=node('select',null);for(const [v,t]of options)s.add(new Option(t,v));s.value=value;s.onchange=()=>change(s.value);return s;}
function check(text,value,change){const l=node('label',null,{className:'model-check'}),c=node('input',null,{type:'checkbox',checked:value});c.onchange=()=>change(c.checked);l.append(c,document.createTextNode(text));return l;}
export function createModelsUI({getState,setImports,getScene,fit,replaceProject,normalizeProject,notify}){
  const panel=$('#panel-models');let active=null,controller=null,draft=null,serial=0;
  panel.innerHTML='<p class="panel-intro">Import a static building or surrounding context. Files are processed in this browser.</p><button id="model-import" class="button add">＋ Import GLB / IFC</button><input id="model-file" type="file" accept=".glb,.ifc" hidden><button id="model-package-open" class="button add">Open FORM package</button><input id="model-package-file" type="file" accept=".formpkg" hidden><button id="model-package-save" class="button add">Download FORM package</button><button id="model-cancel" class="button" hidden>Cancel operation</button><p id="model-status" class="model-status" role="status" aria-live="polite"></p><div id="model-draft" hidden></div><div id="model-native"></div><div id="model-list"></div><div id="model-editor"></div><p class="note">GLB: static, uncompressed triangles and material colours. IFC: selected schema/geometry support; source properties are not verified quantities. 25 MiB/model; 150,000 triangles/model; 300,000 triangles/analysis scene. Simplify larger files before import. <a href="./limitations.html" target="_blank" rel="noopener">Validation &amp; limitations</a></p>';
  const status=(s)=>{$('#model-status').textContent=s;};
  const busy=(value)=>{for(const id of ['model-import','model-package-open','model-package-save'])$('#'+id).disabled=value;$('#model-cancel').hidden=!value;};
  const manifest=()=>normalizeImports(getState().imports);
  function edit(id,change,analysis=true){const m=manifest(),item=id==='native'?m:m.items.find(x=>x.id===id);if(!item)return;change(item,m);setImports(normalizeImports(m),analysis);render();}
  function role(id,value){edit(id,(item,m)=>{
    if(value==='target'){if(id!=='native'&&m.nativeRole==='target'){m.nativeRole='reference';m.nativeVisible=false;}if(id==='native')m.nativeVisible=true;for(const x of m.items)if(x.id!==id&&x.role==='target')x.role='reference';}
    else if((id==='native'?m.nativeRole:item.role)==='target'){if(id==='native')throw Error('Choose an imported analysis building first.');m.nativeRole='target';}
    if(id==='native')m.nativeRole=value;else item.role=value;
  });}
  function catchAction(fn){return async()=>{try{await fn();}catch(e){status(e.message);}};}
  $('#model-import').onclick=()=>$('#model-file').click();$('#model-package-open').onclick=()=>$('#model-package-file').click();
  $('#model-cancel').onclick=()=>controller?.abort();
  $('#model-file').onchange=async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    controller=new AbortController();busy(true);draft=null;getScene()?.clearPreview();$('#model-draft').hidden=true;
    try{draft=await parseModel(file,{signal:controller.signal,onProgress:status});showDraft();status('Review dimensions, placement and the opaque-surface assumption before importing.');}
    catch(error){status(error.message);}finally{busy(false);controller=null;}
  };
  function showDraft(){
    const box=$('#model-draft');box.hidden=false;box.replaceChildren();const asset=draft,m=manifest();
    box.append(node('h3','Import preview'),node('b',asset.name),node('p',asset.bounds.size.map(v=>v.toFixed(3)).join(' × ')+' m · '+asset.triangleCount.toLocaleString()+' triangles · '+asset.meshes.length+' meshes'));
    box.append(node('p','Source origin: '+asset.sourceOrigin.map(v=>v.toFixed(3)).join(', ')+' m. Source units: '+asset.sourceUnits));
    for(const warning of asset.warnings)box.append(node('p',warning,{className:'model-warning'}));
    let placement='shared',roleValue='context',accepted=false;
    const preview=()=>{const position=placement==='centre'?[0,0,0]:placement==='original'?[...asset.sourceOrigin]:asset.sourceOrigin.map((v,i)=>v-(m.origin?.[i]??asset.sourceOrigin[i]));getScene()?.preview(asset,position);fit('preview');};preview();
    box.append(field('Placement',select([['shared',m.origin?'Align with the project’s source origin':'Use this file as the shared source origin'],['centre','Centre this model and place on ground'],['original','Keep original source coordinates']],placement,v=>{placement=v;preview();})));
    box.append(field('Model role',select([['context','Surrounding context'],['reference','Reference only'],['target','Analysis building']],roleValue,v=>roleValue=v)));
    const add=button('Add model',catchAction(async()=>{
      if(!accepted)return;const next=manifest();
      const existingAssets=await loadProjectAssets(getState());
      if(next.items.length>=IMPORT_LIMITS.instances)throw Error('Maximum 12 imported models per project.');
      if(existingAssets.reduce((n,a)=>n+a.sourceBytes,0)+(existingAssets.some(a=>a.id===asset.id)?0:asset.sourceBytes)>95*1024*1024)throw Error('Project model sources exceed the portable backup budget.');
      const persisted=await saveAsset(asset);
      if(!next.origin)next.origin=[...asset.sourceOrigin];
      const position=placement==='centre'?[0,0,0]:placement==='original'?[...asset.sourceOrigin]:asset.sourceOrigin.map((v,i)=>v-next.origin[i]);
      if(roleValue==='target'){if(next.nativeRole==='target'){next.nativeRole='reference';next.nativeVisible=false;}for(const x of next.items)if(x.role==='target')x.role='reference';}
      active=crypto.randomUUID();next.items.push({id:active,assetId:asset.id,name:asset.name,role:roleValue,visible:true,position,rotation:0,scale:1,receivers:{},reviewed:false});
      getScene()?.clearPreview();setImports(next,true);draft=null;box.hidden=true;render();getScene()?.select(active);fit(active);
      status(persisted?'Model imported. Download a FORM package for a portable backup.':'Model loaded for this session only: browser storage failed. Download a FORM package now.');
    }));add.disabled=true;add.id='model-add-confirm';
    box.append(check('I checked the dimensions and placement. All imported surfaces will be opaque in analysis.',false,v=>{accepted=v;add.disabled=!v;}),add,button('Discard preview',()=>{draft=null;box.hidden=true;getScene()?.clearPreview();fit();status('Import preview discarded.');}));
  }
  $('#model-package-save').onclick=catchAction(async()=>{
    controller=new AbortController();busy(true);status('Preparing portable backup…');
    try{const buffer=await exportPackage(getState(),{signal:controller.signal}),url=URL.createObjectURL(new Blob([buffer],{type:'application/zip'})),a=node('a',null,{href:url,download:(getState().name.replace(/[^a-z0-9_-]+/gi,'-')||'FORM')+'.formpkg'});a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);status('Package downloaded: includes original model files and project settings.');}finally{busy(false);controller=null;}
  });
  $('#model-package-file').onchange=async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;controller=new AbortController();busy(true);
    try{
      const result=await importPackage(file,{signal:controller.signal,onProgress:status}),project=normalizeProject(result.project);
      for(const item of project.imports?.items||[]){const asset=result.assets.find(a=>a.id===item.assetId);if(!asset)throw Error('Missing model in package.');for(const id of Object.keys(item.receivers))if(!asset.meshes.some(m=>m.id===id))throw Error('Receiver selection no longer matches the decoded file.');}
      let persisted=true;for(const asset of result.assets)persisted=await saveAsset(asset)&&persisted;
      getScene()?.clearPreview();draft=null;$('#model-draft').hidden=true;replaceProject(project);active=null;render();fit();status(persisted?'Project package restored.':'Package restored for this session; browser model storage failed. Retain your package backup.');
    }catch(error){status(error.message);}finally{busy(false);controller=null;}
  };
  async function render(){
    const token=++serial,m=manifest(),native=$('#model-native');native.replaceChildren(node('h3','FORM parametric building'));
    const roles=[['target','Analysis building'],['context','Surrounding context'],['reference','Reference only']];
    native.append(field('Role',select(roles,m.nativeRole,v=>{try{role('native',v);}catch(e){status(e.message);render();}})),check('Show parametric building',m.nativeVisible,v=>edit('native',x=>x.nativeVisible=v,false)));
    const list=$('#model-list');list.replaceChildren(node('h3','Imported models'));
    if(!m.items.length)list.append(node('p','No imported models yet.'));
    for(const item of m.items){const b=button(item.name+' · '+item.role,()=>{active=item.id;getScene()?.select(active);render();});b.classList.add('model-list-item');b.setAttribute('aria-pressed',String(active===item.id));list.append(b);}
    const editor=$('#model-editor');editor.replaceChildren();const item=m.items.find(x=>x.id===active);if(!item)return;
    let asset;try{asset=await loadAsset(item.assetId);}catch(error){if(token===serial)status(error.message);return;}if(token!==serial)return;
    const name=node('input',null,{value:item.name,maxLength:160});name.onchange=()=>edit(item.id,x=>x.name=name.value,false);
    editor.append(node('h3','Selected model'),field('Name',name),field('Role',select(roles,item.role,v=>role(item.id,v))),check('Visible in viewer',item.visible,v=>edit(item.id,x=>x.visible=v,false)));
    const actions=node('div',null,{className:'model-actions'});actions.append(button('Fit',()=>fit(item.id)),button('Isolate / restore',()=>getScene()?.isolate(item.id)),button('Remove',()=>{edit(item.id,(_,next)=>{next.items=next.items.filter(x=>x.id!==item.id);if(item.role==='target'){next.nativeRole='target';next.nativeVisible=true;}});active=null;render();}));editor.append(actions);
    const placement=node('div',null,{className:'model-placement'});
    for(const [label,key,index,value,step]of [['X (m)','position',0,item.position[0],.1],['Elevation (m)','position',1,item.position[1],.1],['Plan Y (m)','position',2,item.position[2],.1],['Rotation (°)','rotation',null,item.rotation,1],['Uniform scale','scale',null,item.scale,.01]]){
      const input=node('input',null,{type:'number',value,step});input.dataset.modelTransform=key+(index??'');if(key==='scale')input.min=.0001;
      input.onchange=()=>{try{edit(item.id,x=>{if(index===null)x[key]=input.valueAsNumber;else x[key][index]=input.valueAsNumber;});}catch(e){status(e.message);render();}};placement.append(field(label,input));
    }
    editor.append(placement,button('Place on ground',()=>edit(item.id,x=>x.position[1]=-asset.bounds.min[1]*x.scale)),button('Reset placement',()=>edit(item.id,x=>{x.position=asset.sourceOrigin.map((v,i)=>v-(m.origin?.[i]??0));x.scale=1;x.rotation=0;})));
    editor.append(node('p',asset.format+(asset.schema?' · '+asset.schema:'')+' · '+asset.triangleCount.toLocaleString()+' triangles',{className:'note'}));
    if(item.role==='target'){
      editor.append(node('h3','Exterior receiver surfaces'),node('p','Choose only exterior meshes. Blue = façade, yellow = roof. A mesh with internal floors should be split in the source model before analysis. Orientation filtering alone does not identify the exterior.',{className:'model-warning'}));
      editor.append(button('Suggest by orientation',()=>edit(item.id,x=>{
        for(const mesh of asset.meshes){let facade=0,roof=0,total=0;for(let i=0;i<mesh.positions.length;i+=9){const n=normalOf(mesh.positions,i);if(!n)continue;total++;if(Math.abs(n[1])<=.7)facade++;if(n[1]>=.7)roof++;}x.receivers[mesh.id]={type:total&&facade/total>.95?'facade':total&&roof/total>.95?'roof':'none',flip:false};}x.reviewed=false;
      })));
    }
    const filter=node('input',null,{type:'search',placeholder:'Find mesh, IFC class or storey…',ariaLabel:'Find imported element'}),elements=node('div',null,{className:'model-elements'});editor.append(filter,elements);
    const renderElements=()=>{
      elements.replaceChildren();const found=asset.meshes.filter(mesh=>[mesh.name,mesh.properties?.class,mesh.properties?.storey,mesh.elementId].some(v=>String(v||'').toLowerCase().includes(filter.value.toLowerCase())));
      for(const mesh of found.slice(0,80)){
        const row=node('details',null,{className:'model-element'});row.append(node('summary',mesh.name+(mesh.properties?.storey?' · '+mesh.properties.storey:'')));
        if(item.role==='target'){
          const choice=item.receivers[mesh.id]||{type:'none',flip:false};
          row.append(field('Receiver use',select([['none','Not a receiver'],['facade','Exterior façade faces'],['roof','Exterior upward / roof faces']],choice.type,v=>edit(item.id,x=>{x.receivers[mesh.id]={...choice,type:v};x.reviewed=false;}))),check('Reverse receiver normals',choice.flip,v=>edit(item.id,x=>{x.receivers[mesh.id]={...choice,flip:v};x.reviewed=false;})));
          row.append(button('Highlight element',()=>{const root=getScene()?.getRoot(item.id);for(const o of root?.children||[])o.material.emissive.set(o.userData.meshId===mesh.id?0x993f00:0);fit(item.id);}));
        }
        row.append(node('pre',JSON.stringify(mesh.properties||{meshId:mesh.id},null,2)));elements.append(row);
      }
      if(found.length>80)elements.append(node('p','Showing 80 of '+found.length+' elements. Narrow the search.'));
    };filter.oninput=renderElements;renderElements();
    if(item.role==='target'){
      const counts=['facade','roof'].map(type=>type+': '+transformedTriangles(asset,item,{receiver:type}).triangles.length/9+' triangles').join(' · ');
      editor.append(node('p',counts),check('I reviewed the selected exterior surfaces and their outward normals.',item.reviewed,v=>edit(item.id,x=>x.reviewed=v)));
    }
  }
  render();return {render,status,downloadPackage:()=>$('#model-package-save').click()};
}
