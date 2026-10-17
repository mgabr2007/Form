// Move existing controls: never clone them or install duplicate action handlers.
export function arrangeStructurePanel(panel){
  const q=s=>panel.querySelector(s),form=q('#st-form');
  if(form.dataset.arranged)return;
  form.dataset.arranged='true';
  const make=(title,id,open=true)=>{const d=document.createElement('details'),h=document.createElement('summary');d.id=id;d.className='structure-section';d.open=open;h.textContent=title;d.append(h);return d;};
  const setup=make('1 · Frame layout','st-setup'),material=make('2 · Material & member sections','st-material',false),loads=make('3 · Loads & calculation','st-loads');
  const mode=q('#st-frame-mode').closest('label'),guidance=mode.nextElementSibling;
  setup.append(mode,guidance);
  const grids=[setup,material,loads].map(s=>{const g=document.createElement('div');g.className='solar-fields';s.append(g);return g;});
  const setupKeys=['frameWidth','frameDepth','frameX','frameZ','frameAngle','nx','nz'],materialKeys=['E','nu','columnB','columnD','beamB','beamD','density'];
  for(const input of form.querySelectorAll('[data-st]')){const key=input.dataset.st;grids[setupKeys.includes(key)?0:materialKeys.includes(key)?1:2].append(input.closest('label'));}
  const actions=[q('#st-case').closest('label'),q('#st-resolution').closest('label'),q('#st-accept').closest('label'),form.querySelector('button[type=submit]'),q('#st-cancel')];
  loads.append(...actions,q('#st-status'));
  form.replaceChildren(setup,material,loads);
  // Open a collapsed section before native validation attempts to focus its input.
  form.addEventListener('invalid',e=>{for(let p=e.target.parentElement;p&&p!==form;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;},true);
  const results=make('4 · Model display & results','st-results'),history=make('Saved structural runs','st-history-section',false);
  const response=q('#st-table').closest('details');
  results.append(q('#st-display').closest('label'),q('#st-scale').closest('label'),q('#st-shell').closest('label'),q('#st-warning'),q('#st-summary'),q('#st-selected'),response,q('#st-save'),q('#st-export'));
  history.append(q('#st-history').closest('label'),q('#st-restore'));
  form.after(results,history);
}

export function structureDisplayState(hasResult,mode){return {mode:hasResult?mode:'frame',showMagnification:hasResult&&mode==='deformed',allowResults:hasResult};}
