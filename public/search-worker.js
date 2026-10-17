import {loadAsset} from './model-assets.js';
import {normalizeImports,transformedTriangles,IMPORT_LIMITS,importSignature} from './imported-model.js';
import {BoxGeometry} from './vendor/three.core.js';
import {savedMassTriangles} from './saved-facade.js';
import {facadeGrid} from './facade-grid.js';
import {facadeAreas,architecturalMetrics,weightedResult} from './decision-metrics.js';
import {buildBVH,sunSteps,sunlightHours} from './solar.js';
import {skyExposure} from './daylight.js';
import {radiationSteps,irradiation} from './radiation.js';
import {checkContextAnchor} from './site-context.js';
self.onmessage=async({data})=>{try{const {state,settings,weather,minArea,maxHeight,maxCoverage}=data;checkContextAnchor(state.siteContext,settings);const metrics=architecturalMetrics(state);if(metrics.floorArea<minArea||metrics.height>maxHeight||(maxCoverage!==null&&metrics.coveragePercent!==null&&metrics.coveragePercent>maxCoverage)){self.postMessage({skipped:true,metrics});return;}
 const manifest=normalizeImports(state.imports);if(manifest.nativeRole!=='target')throw Error('Parameter search requires the FORM building as target');const own=savedMassTriangles(state),grid=facadeGrid(own,settings.gridWidth,settings.gridHeight),all=Array.from(own);for(const b of settings.context){const g=new BoxGeometry(b.width,b.height,b.depth).toNonIndexed(),p=g.attributes.position.array;for(let i=0;i<p.length;i+=3)all.push(p[i]+b.x,p[i+1]+b.height/2,p[i+2]+b.y);g.dispose();}if(state.siteContext?.included)for(const v of state.siteContext.positions)all.push(v);
 for(const item of manifest.items){if(item.role==='reference')continue;const asset=await loadAsset(item.assetId);const t=transformedTriangles(asset,item).triangles;if((all.length+t.length)/9>IMPORT_LIMITS.sceneTriangles)throw Error('Scene triangle limit exceeded');for(const v of t)all.push(v);}
 if(!grid.samples.length)throw Error('No sampled facade cells');const triangles=new Float64Array(all),tree=buildBVH(triangles),sky=['daylight','sky'].includes(settings.analysis),steps=sky?[]:weather?radiationSteps(weather.records,settings):sunSteps(settings),values=[],components=[];
 for(let i=0;i<grid.samples.length;i++){if(sky){const c=skyExposure(grid.samples[i],triangles,tree,settings.skyResolution);components.push(c);values.push(settings.analysis==='daylight'?c.vsc:c.skyView);}else if(weather){const c=irradiation(grid.samples[i],steps,triangles,tree,settings.skyPatches);components.push(c);values.push(c.total);}else values.push(sunlightHours(grid.samples[i],steps,triangles,tree));if(i%25===0)self.postMessage({progress:i/grid.samples.length});}
 const areaData=facadeAreas(own,grid),result={project:state,settings,triangles:Array.from(triangles),receiverTriangles:Array.from(own),...(manifest.items.length?{importProvenance:{models:importSignature(manifest),context:importSignature(manifest,{contextOnly:true}),target:{modelId:'native'}}}:{}),samples:grid.samples,values,components,areaData,sampling:'facade-grid-v1',daylight:steps.filter(s=>s.altitude>0).reduce((a,s)=>a+s.hours,0)};self.postMessage({result,metrics,weighted:weightedResult(values,areaData)});
 }catch(e){self.postMessage({error:e.message});}};
