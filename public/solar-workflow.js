import {periodDates,periodLabel} from './analysis-period.js';
// Visible input groups mirror the calculation dependencies.
export function studyControls(s){
 const sky=['daylight','sky'].includes(s.analysis);
 return {site:!sky,weather:s.analysis==='radiation',skySampling:sky,
 targets:s.analysis==='daylight'?['facade']:s.analysis==='radiation'?['roof','facade']:['ground','roof','facade'],
 targetChoice:s.analysis!=='daylight',grid:s.target==='facade',extent:s.target==='ground',timeStep:s.analysis==='sunlight'||s.analysis==='radiation'&&s.weatherSource!=='tmy'};
}
// Calculation dependencies only. Preview and display controls never enter this key.
export function analysisDependencies(s){
 const sky=['daylight','sky'].includes(s.analysis),out={analysis:s.analysis,target:s.target,context:s.context};
 if(s.target==='facade'){out.gridWidth=s.gridWidth;out.gridHeight=s.gridHeight;}
 if(s.target==='ground')out.extent=s.extent;
 if(sky)out.skyResolution=s.skyResolution;
 else{out.period=s.period||'day';if(s.period==='hour')out.analysisHour=s.analysisHour;if(s.period==='range')out.endDate=s.endDate;for(const k of ['lat','lon','utc','north','date'])out[k]=s[k];if(s.analysis==='sunlight')out.step=s.step;else {out.weatherSource=s.weatherSource;out.skyPatches=s.skyPatches;if(s.weatherSource!=='tmy')out.step=Math.min(1,s.step);}}
 return out;
}
export const analysisKey=s=>JSON.stringify(analysisDependencies(s));
export function integrationMethod(s){return s.analysis==='radiation'?(s.weatherSource==='tmy'?'Hourly quadrature at PVGIS irradiance timestamp':'Hourly mean irradiance; '+Math.min(1,s.step)+'-minute solar geometry'):s.analysis==='sunlight'?s.step+'-minute solar geometry':'Static sky integration; '+(2*s.skyResolution*s.skyResolution)+' rays per point';}
export function workflowSummary(s){
 const sample=s.target==='facade'?`${s.gridWidth} × ${s.gridHeight} m façade grid`:s.target==='roof'?'500 area-distributed roof samples':`25 × 25 ground samples over ${2*s.extent} × ${2*s.extent} m`;
 const context=`${s.context.length} neighbouring block${s.context.length===1?'':'s'}; target and context roles define included geometry`;
 if(['daylight','sky'].includes(s.analysis))return `${s.analysis==='daylight'?'Vertical sky component':'Horizontal sky-view factor'} · ${sample} · ${context}. Geometry and sky sampling only. No date, clock or weather dependency.`;
 return `${s.analysis==='sunlight'?'Direct-sun hours':s.weatherSource==='tmy'?'TMY irradiation':'Date-specific irradiation'} · ${periodLabel(s)} · UTC${s.utc>=0?'+':''}${s.utc} · ${sample} · ${context}. ${integrationMethod(s)}. Preview clock does not select the calculation period.`;
}
export function preflight(s){
 if(!['daylight','sky'].includes(s.analysis)){const dates=periodDates(s);if(s.analysis==='radiation'&&s.weatherSource==='tmy'&&dates.some(d=>d.slice(5)==='02-29'))throw Error('TMY excludes 29 February. Choose a non-leap year for ranges that cross February.');}

 if(s.analysis==='radiation'&&s.target==='ground')throw Error('Select façades or roofs for irradiation.');
 if(s.analysis==='daylight'&&s.target!=='facade')throw Error('Select façades for vertical sky component.');
 if(s.analysis==='radiation'&&s.weatherSource==='openweather'&&s.utc*4%1!==0)throw Error('OpenWeather requires a UTC offset in 15-minute increments.');
 if(s.analysis==='radiation'&&s.weatherSource==='tmy'&&s.date.slice(5)==='02-29')throw Error('TMY has no 29 February. Choose another day.');
}
export function arrangeSolarWorkflow(panel){
 const q=s=>panel.querySelector(s),label=k=>q('[data-solar='+k+']').closest('label');
 const intro=q('.panel-intro');intro.textContent='Choose a study, define its inputs, then calculate. Each stage shows what the selected study uses.';
 const guide=document.createElement('details');guide.className='solar-dependencies';guide.innerHTML=`<summary>What depends on what?</summary><div class="dependency-table"><table><thead><tr><th>Study</th><th>Inputs used</th><th>Output</th></tr></thead><tbody><tr><td>Sunlight</td><td>Geometry, samples, location, north, dates, period, UTC, time step</td><td>Direct-sun hours / selected period</td></tr><tr><td>Irradiation</td><td>Geometry, samples, location, north, dates, period, UTC, DNI + DHI weather</td><td>Direct + diffuse kWh/m² / selected period</td></tr><tr><td>Façade VSC</td><td>Geometry, façade grid, overcast sky sampling</td><td>Vertical sky component %</td></tr><tr><td>Sky exposure</td><td>Geometry, samples, isotropic sky sampling</td><td>Horizontal sky-view factor %</td></tr></tbody></table></div><p class="note">GHI is reported as a horizontal weather check; it is not added to DNI + DHI. Temperature, wind and humidity are retained in TMY downloads but do not enter these radiation calculations. Preview clock, visibility, opacity and colour scale change the view only. Changing a calculation input clears the active result; saved runs remain available.</p>`;
 const stages=[];function stage(n,title,items){const el=document.createElement('section');el.className='solar-stage';el.id='solar-stage-'+n;const h=document.createElement('h3');h.dataset.title=title;h.textContent=n+'. '+title;el.append(h,...items.filter(Boolean));stages.push(el);return el;}
 const analysis=label('analysis'),oldHeading=analysis.previousElementSibling;
 const site=q('.solar-fields'),siteNote=site.nextElementSibling,date=label('date'),clock=label('hour'),position=q('#solar-position'),enabled=q('#solar-enabled').closest('label'),context=q('#solar-context').closest('details'),lastNote=panel.lastElementChild;lastNote.id='solar-method-note';
 stage(1,'Choose the study',[analysis,guide,q('.validation-note')]);
 const preview=document.createElement('details');preview.id='solar-preview';preview.innerHTML='<summary>Sun and shadow preview</summary><p class="note">Visual preview at one clock time. This clock controls the preview only. Set the calculation period separately.</p>';preview.append(enabled,clock,position);
 const siteExplanation=document.createElement('p');siteExplanation.className='note';siteExplanation.id='solar-site-dependency';
 stage(2,'Site and time',[siteExplanation,site,siteNote,label('period'),date,label('analysisHour'),label('endDate'),q('#solar-period-note'),preview]);
 stage(3,'Geometry and sampling',[q('#solar-model-target'),context,label('target'),q('#facade-grid-controls'),label('extent'),label('step'),q('#sky-resolution-field'),q('#daylight-controls')]);
 stage(4,'Weather for irradiation',[q('#weather-source-field'),q('#radiation-note'),q('.weather-library')]);
 const summary=document.createElement('p');summary.id='solar-run-summary';summary.className='solar-run-summary';summary.setAttribute('aria-live','polite');
 stage(5,'Calculate',[summary,q('#solar-run'),q('#solar-cancel'),q('#solar-status')]);
 stage(6,'Inspect and save results',[q('.solar-results-tools'),q('#solar-refine'),q('#solar-resolution'),q('#solar-history'),q('#solar-csv'),lastNote]);
 oldHeading?.remove();panel.replaceChildren(intro,...stages);
}
