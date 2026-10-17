// Keep the existing calculation controls and handlers; only relocate their presentation.
export function createSolarNavigation(panel){
 const stages=[...panel.querySelectorAll('.solar-stage')],nav=document.createElement('nav');
 nav.className='solar-step-nav';nav.setAttribute('aria-label','Solar workflow steps');
 const names=['Study','Site / time','Sampling','Weather','Calculate','Results'];
 const hints=['Choose what to measure: sun, irradiation or sky.','Set the location, north direction and calculation period.','Choose surfaces, grid spacing and neighbouring buildings.','Choose the weather source used for irradiation.','Review the inputs; use the bottom button to run.','Inspect colours and values, then save or export.'];
 const help=document.createElement('p');help.className='solar-nav-help';help.id='solar-nav-help';help.textContent='Choose a step. Hover, focus or tap for a quick hint.';
 const showHint=i=>{help.textContent=names[i]+': '+hints[i];};
 const buttons=stages.map((stage,i)=>{const b=document.createElement('button');b.type='button';b.textContent=names[i];b.title=hints[i];b.setAttribute('aria-describedby','solar-nav-help');b.addEventListener('mouseenter',()=>showHint(i));b.addEventListener('focus',()=>showHint(i));b.onclick=()=>{showHint(i);stage.scrollIntoView({block:'start',behavior:'smooth'});stage.querySelector('h3').focus({preventScroll:true});};stage.querySelector('h3').tabIndex=-1;nav.append(b);return b;});
 nav.append(help);panel.prepend(nav);
 new ResizeObserver(()=>{for(const stage of stages)stage.style.scrollMarginTop=(nav.offsetHeight+16)+'px';}).observe(nav);
 const dock=document.createElement('div');dock.className='solar-action-dock';dock.setAttribute('aria-label','Calculation actions');
 const run=panel.querySelector('#solar-run'),cancel=panel.querySelector('#solar-cancel'),status=panel.querySelector('#solar-status');
 dock.append(run,cancel,status);panel.after(dock);
 const sync=()=>{dock.hidden=panel.hidden;stages.forEach((s,i)=>{if(buttons[i].hidden!==s.hidden)buttons[i].hidden=s.hidden;});};
 new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['hidden']});
 for(const s of stages)new MutationObserver(sync).observe(s,{attributes:true,attributeFilter:['hidden']});
 panel.addEventListener('scroll',()=>{const top=panel.getBoundingClientRect().top+nav.offsetHeight+16;let current=stages.find(s=>!s.hidden);for(const s of stages)if(!s.hidden&&s.getBoundingClientRect().top<=top)current=s;buttons.forEach((b,i)=>{if(stages[i]===current)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});},{passive:true});
 sync();
}
export function revealSolarInput(input){
 for(let parent=input.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
 input.scrollIntoView({block:'center'});input.focus({preventScroll:true});input.reportValidity();
}
