import {readProjects} from './projects.js';
import {weightedResult} from './decision-metrics.js';
import {createFacadeUnfold} from './facade-unfold.js';
import {savedFacadeCells} from './saved-facade.js';
import {Color} from './vendor/three.core.js';
import {renderComparisonCharts} from './comparison-charts.js';
import {snapshot,summarize,compare,metrics,readHistory,writeHistory,comparisonCSV} from './analysis-history.js';
import {periodLabel} from './analysis-period.js';
export function createComparisonDashboard(){
 const dialog=document.createElement('main');dialog.id='comparison-dashboard';dialog.setAttribute('aria-labelledby','history-title');
 dialog.innerHTML=`<div class="dialog-head"><div><span class="eyebrow">FORM / DESIGN INSIGHTS</span><h2 id="history-title">See the difference.</h2><p class="compare-subtitle">Your designs. Their exposure. One clear picture.</p></div><a class="button" href="./studio.html">← Design studio</a></div>
 <p data-status role="status" aria-live="polite"></p>
 <p data-save-location class="save-status" role="status"></p><div class="compare-toolbar"><label>Project<select data-design><option value="">All designs</option></select></label><label>Compare against<select data-baseline></select></label><label>View<select data-filter><option value="all">All saved studies</option><option value="matching">Matching baseline conditions</option></select></label><label>Order<select data-sort><option value="saved">Saved order</option><option value="high">Mean: high to low (within each metric)</option><option value="low">Mean: low to high (within each metric)</option></select></label></div>
 <div data-overview class="compare-overview"></div>
 <section data-chart class="compare-chart"></section><section data-facades class="compare-chart" hidden></section><div data-insights class="insight-grid"></div>
 <div class="compare-section-title"><h3>Design options</h3><span data-count></span></div><div data-cards class="compare-cards"></div>
 <div class="compare-foot"><p>Descriptive sample means—not area-weighted façade totals or point-by-point differences. Higher exposure is not automatically better. Match the calculation period, weather and grid spacing before interpreting changes.</p><div><button class="button" data-csv>Export comparison CSV ↗</button><button class="button" data-json>Export full results JSON ↗</button></div><small>Saved in this browser, up to 100 runs. Export JSON to keep a backup.</small></div>`;
 document.body.append(dialog);const $=s=>dialog.querySelector(s);
 let runs=[],baseline='',storage,error='',savedMessage='';try{storage=window.localStorage;runs=readHistory(storage);}catch(e){error='Saved results unavailable: '+e.message;}const readable=!error;
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const signed=v=>(v>0?'+':'')+v.toFixed(2);
 let projectRecords=[];try{projectRecords=readProjects().projects;}catch{}
 const projectKey=run=>run.result.project?.projectId||projectRecords.find(p=>p.legacyRunIds?.includes(run.id))?.id||'legacy:'+run.id;
 const projectLabel=key=>projectRecords.find(p=>p.id===key)?.name||runs.find(r=>projectKey(r)===key)?.result.project?.name||'Unnamed design';
 let facadeData=null;
 const facadeView=createFacadeUnfold(()=>facadeData,()=>{}),facadeCache=new Map();
 function openFacade(run){
  try{
   const r=run.result;let cells=facadeCache.get(run.id);if(!cells){cells=savedFacadeCells(r);facadeCache.set(run.id,cells);}
   const group=runs.filter(other=>!compare(other,run).reasons.length),values=group.flatMap(other=>other.result.values);
   let low=Infinity,high=-Infinity;for(const v of values){low=Math.min(low,v);high=Math.max(high,v);}
   const scale={low,high,ratio:v=>high-low<1e-8?.5:Math.max(0,Math.min(1,(v-low)/(high-low)))};
   facadeData={result:r,...cells,north:r.settings.north||0,scale,color:v=>new Color().setHSL(.66*(1-v),.85,.5).getStyle(),unit:metrics[r.settings.analysis][1],title:run.name+' · '+metrics[r.settings.analysis][0]+(['daylight','sky'].includes(r.settings.analysis)?'':' · '+periodLabel(r.settings))+' · shared colour scale across '+group.length+' compatible saved run(s)'};
   facadeView.open();
  }catch(e){$('[data-status]').textContent='Façade view unavailable: '+e.message;$('[data-status]').scrollIntoView({block:'center'});}
 }

 function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 function render(){
  const requestedDesign=$('[data-design]').value;const designRuns=runs.filter(r=>(projectKey(r))===requestedDesign);if(requestedDesign&&designRuns.length&&!designRuns.some(r=>r.id===baseline))baseline=designRuns[0].id;
  if(!runs.some(r=>r.id===baseline))baseline=runs[0]?.id||'';
  const base=runs.find(r=>r.id===baseline);
  $('[data-baseline]').replaceChildren(...runs.map(r=>new Option(r.name,r.id)));$('[data-baseline]').value=baseline;
  for(const selector of ['[data-baseline]','[data-filter]','[data-sort]','[data-csv]','[data-json]'])$(selector).disabled=!runs.length;

  const designFilter=$('[data-design]'),selectedDesign=designFilter.value;const names=[...new Set(runs.map(r=>projectKey(r)))].sort();designFilter.replaceChildren(new Option('All designs',''),...names.map(n=>new Option(projectLabel(n),n)));if(names.includes(selectedDesign))designFilter.value=selectedDesign;
  $('[data-save-location]').textContent='Saved in this browser only · '+(runs.length?'latest analysis '+new Date(runs.map(r=>r.savedAt).sort().at(-1)).toLocaleString():'no analyses saved yet')+'. Grouped by stable project ID; legacy runs keep separate identities.';
  $('[data-status]').textContent=error||savedMessage||'Charts use saved analyses with matching calculation conditions. Select a baseline to change the comparison group.';
  for(const selector of ['[data-overview]','[data-chart]','[data-cards]','[data-insights]','[data-facades]'])$(selector).replaceChildren();
  $('[data-chart]').hidden=!runs.length;$('[data-overview]').hidden=!runs.length;$('[data-count]').textContent=runs.length+' saved';
  $('[data-facades]').hidden=true;
  if(!base){$('[data-cards]').append(el('div','compare-empty','Your first comparison starts here. In the Design studio, calculate a study and click Save analysis. Return here to compare saved options; no new calculation is needed to reopen this dashboard.'));return;}
  const stats=new Map(runs.map(r=>[r.id,summarize(r.result.values)])),comparisons=new Map(runs.map(r=>[r.id,compare(r,base)])),compatible=runs.filter(r=>!comparisons.get(r.id).reasons.length&&(!designFilter.value||(projectKey(r))===designFilter.value));
  const [title,unit]=metrics[base.result.settings.analysis],baseStats=stats.get(base.id);
  renderComparisonCharts($('[data-insights]'),compatible,unit);
  const facadeRuns=compatible.filter(run=>run.result.settings.target==='facade'&&['facade-grid-v1','imported-facade-grid-v1'].includes(run.result.sampling));
  if(facadeRuns.length){const atlas=$('[data-facades]');atlas.hidden=false;atlas.append(el('h3','','Explore the façades'),el('p','compare-muted','Open a saved study’s North / East / South / West projections. Compatible saved runs share a colour scale. Values come from the saved calculation; no weather request or analysis rerun.'));
   const buttons=el('div','facade-dashboard-actions');for(const run of facadeRuns){const b=el('button','button','▥ '+run.name);b.onclick=()=>openFacade(run);buttons.append(b);}atlas.append(buttons);
  }

  $('[data-status]').textContent=error||title+' · '+base.result.settings.target+' · '+(['daylight','sky'].includes(base.result.settings.analysis)?'Geometry-only study':periodLabel(base.result.settings))+' · '+compatible.length+' compatible saved run(s). '+(compatible.length===1?'Save another run with matching settings for a comparison. ':'')+'Charts describe sampled points, not area-weighted façade totals. Higher values are not automatically better.';
  for(const [label,value,detail]of [['Baseline',base.name,title],['Baseline sample mean',baseStats.mean.toFixed(2),unit],['Matching conditions',String(compatible.length),runs.length+' saved runs total']]){
   const box=el('div','compare-kpi');box.append(el('span','',label),el('strong','',value),el('small','',detail));$('[data-overview]').append(box);
  }
  const chart=$('[data-chart]');chart.append(el('h3','','Exposure at a glance'),el('p','compare-muted',title+' · '+unit+' · shared scale from zero. Bars show sample means; dots mark minimum and maximum.'));
  const maximum=Math.max(...compatible.map(r=>stats.get(r.id).max),1e-9);
  for(const run of compatible){
   const s=stats.get(run.id),row=el('div','compare-chart-row'),name=el('button','compare-chart-name',run.name+(run.id===baseline?' · baseline':''));
   name.type='button';name.title='Use '+run.name+' as baseline';name.onclick=()=>{baseline=run.id;render();};
   const track=el('div','compare-track'),bar=el('span','compare-bar'),range=el('span','compare-range'),minimum=el('i','compare-dot'),max=el('i','compare-dot');
   bar.style.width=s.mean/maximum*100+'%';range.style.left=s.min/maximum*100+'%';range.style.width=(s.max-s.min)/maximum*100+'%';
   minimum.style.left=s.min/maximum*100+'%';max.style.left=s.max/maximum*100+'%';
   track.setAttribute('role','img');track.setAttribute('aria-label',run.name+': minimum '+s.min.toFixed(2)+', mean '+s.mean.toFixed(2)+', maximum '+s.max.toFixed(2)+' '+unit);track.title=track.getAttribute('aria-label');
   track.append(range,bar,minimum,max);row.append(name,track,el('b','',s.mean.toFixed(2)));if(run.id===baseline)row.classList.add('is-baseline');chart.append(row);
  }
  if(runs.length>compatible.length)chart.append(el('p','compare-muted',(runs.length-compatible.length)+' run(s) excluded from this chart because their calculation conditions or selected design differ.'));
  let visible=$('[data-filter]').value==='matching'?[...compatible]:[...runs];
  if($('[data-sort]').value!=='saved'){const sign=$('[data-sort]').value==='high'?-1:1;visible.sort((a,b)=>a.result.settings.analysis.localeCompare(b.result.settings.analysis)||sign*(stats.get(a.id).mean-stats.get(b.id).mean));}
  if(designFilter.value)visible=visible.filter(r=>(projectKey(r))===designFilter.value);
  visible.sort((a,b)=>(projectKey(a)).localeCompare(projectKey(b)));
  if(!visible.length)$('[data-cards]').append(el('p','compare-empty','No saved analyses match this selection.'));
  let previousDesign=null;
  for(const run of visible){
   const designName=projectKey(run);if(designName!==previousDesign){$('[data-cards]').append(el('h3','design-analysis-group','Project: '+projectLabel(designName)));previousDesign=designName;}
   const r=run.result,s=stats.get(run.id),c=comparisons.get(run.id),[metric,u]=metrics[r.settings.analysis],isBase=run.id===baseline,card=el('article','compare-card'+(isBase?' is-baseline':''));
   const head=el('div','compare-card-head');head.append(el('span','compare-badge',isBase?'BASELINE':c.reasons.length?'DIFFERENT CONDITIONS':'MATCHING CONDITIONS'),el('small','',new Date(run.savedAt).toLocaleString()));
   card.append(head,el('h3','',run.name),el('p','compare-muted',metric+' · '+r.settings.target));
   const value=el('div','compare-value');value.append(el('strong','',s.mean.toFixed(2)),el('span','',u+' sample mean'));card.append(value);
   const delta=el('div','compare-delta');
   delta.textContent=isBase?'Reference for all differences':c.reasons.length?'Comparison withheld: '+c.reasons.join(', '):signed(c.delta)+' '+(u==='%'?'percentage points':u)+(c.relative===null?' · relative change unavailable': ' · '+signed(c.relative)+'%')+' vs baseline';
   card.append(delta);const w=weightedResult(r.values,r.areaData);if(w)card.append(el('p','compare-muted','Area-weighted mean '+w.mean.toFixed(3)+' '+u+' · represented '+w.area.toFixed(1)+' m² · mesh coverage '+w.coverage.toFixed(1)+'%'+(r.settings.analysis==='radiation'?' · incident '+w.integral.toFixed(2)+' kWh on represented cells':'')));
   const mini=el('div','compare-mini');for(const [label,value]of [['Minimum',s.min.toFixed(2)],['Maximum',s.max.toFixed(2)],['Samples',s.count.toLocaleString()]]){const item=el('div');item.append(el('small','',label),el('b','',value));mini.append(item);}card.append(mini);
   card.append(el('p','compare-period',['daylight','sky'].includes(r.settings.analysis)?'Geometry-only study':periodLabel(r.settings)+' · UTC'+(r.settings.utc>=0?'+':'')+r.settings.utc));
   for(const warning of c.warnings)card.append(el('p','compare-warning',warning));
   const details=el('details','compare-details'),summary=el('summary','','Inputs and provenance'),pre=el('pre','',JSON.stringify({engine:run.engine,settings:r.settings,weather:r.weather?{source:r.weather.source,retrieved:r.weather.retrieved,gridLatitude:r.weather.gridLatitude,gridLongitude:r.weather.gridLongitude}:null},null,2));details.append(summary,pre);card.append(details);
   const actions=el('div','compare-card-actions'),choose=el('button','button',isBase?'Selected baseline':'Use as baseline'),remove=el('button','button compare-delete','Delete');
   choose.disabled=isBase;choose.onclick=()=>{baseline=run.id;render();};
   remove.setAttribute('aria-label','Delete '+run.name);remove.onclick=()=>{if(!window.confirm('Delete saved solution “'+run.name+'”?\n\nThis removes its saved analysis results from this browser and cannot be undone. Export a backup first if needed.'))return;try{const next=runs.filter(v=>v.id!==run.id);writeHistory(storage,next);runs=next;error='';render();}catch(e){error='Could not delete: '+e.message;render();}};
   if(r.settings.target==='facade'&&['facade-grid-v1','imported-facade-grid-v1'].includes(r.sampling)){const unfold=el('button','button','View unfolded façades');unfold.onclick=()=>openFacade(run);actions.append(unfold);}
   actions.append(choose,remove);card.append(actions);$('[data-cards]').append(card);
  }
 }
 for(const selector of ['[data-filter]','[data-sort]','[data-design]'])$(selector).onchange=render;
 $('[data-baseline]').onchange=e=>{baseline=e.target.value;render();};
 $('[data-csv]').onclick=()=>download(comparisonCSV(runs,runs.find(r=>r.id===baseline)),'text/csv','form-analysis-comparison.csv');
 $('[data-json]').onclick=()=>download(JSON.stringify({schema:'form-analysis-history-v1',runs},null,2),'application/json','form-analysis-results.json');
 const requested=new URLSearchParams(location.search).get('design');render();if(requested){const select=$('[data-design]');if([...select.options].some(o=>o.value===requested)){select.value=requested;render();}else $('[data-status]').textContent='No saved analyses found for “'+requested+'”. Showing all saved designs.';}
 window.addEventListener('storage',e=>{if(e.key==='form-analysis-history-v1'){try{runs=readHistory(storage);error='';}catch(e){error=e.message;}render();}});
}
createComparisonDashboard();
