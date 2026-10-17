// Real-browser integration check. Weather is synthetic and intercepted explicitly.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {defaults} from '../../public/geometry.js';
import {replayAnalysisCSV} from '../replay_csv.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.FORM_PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../public/',import.meta.url)),out=process.env.FORM_BROWSER_OUTPUT||fileURLToPath(new URL('./',import.meta.url));
fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});fs.mkdirSync(path.join(out,'exports'),{recursive:true});
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.FORM_CHROMIUM_PATH||undefined,headless:true,args:process.env.FORM_CHROMIUM_MODULE?require(process.env.FORM_CHROMIUM_MODULE).default.args:['--no-sandbox','--use-angle=swiftshader','--use-gl=angle','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const checks=[],errors=[],consoleErrors=[];let page;
const record=(name,details={})=>{checks.push({name,pass:true,...details});console.log(name);};
const fixture=JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/pvlib-radiation.json',import.meta.url))).cases.find(c=>c.name==='Cairo_summer');
const project={...defaults(),name:'Browser release check',shape:'rectangle',width:12,depth:12,floors:5,storey:3,podium:false,modifiers:[],solar:{...fixture.settings,analysis:'radiation',target:'facade',step:1,gridWidth:3,gridHeight:3}};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 await context.addInitScript(s=>{if(location.protocol==='http:')localStorage.setItem('form-studio-v1',JSON.stringify(s));},project);
 let weatherCalls=0;
 await context.route(/https:\/\/(archive-api|api)\.open-meteo\.com\//,async route=>{weatherCalls++;const records=fixture.records;await route.fulfill({json:{latitude:fixture.settings.lat,longitude:fixture.settings.lon,hourly:{time:records.map(r=>r.end),shortwave_radiation:records.map(r=>r.ghi??0),direct_normal_irradiance:records.map(r=>r.dni),diffuse_radiation:records.map(r=>r.dhi)},hourly_units:{shortwave_radiation:'W/m²',direct_normal_irradiance:'W/m²',diffuse_radiation:'W/m²'}}});});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await page.goto(url);await page.locator('#loading').waitFor({state:'hidden'});assert.equal(await page.locator('#error').isVisible(),false);assert.equal(await page.locator('#canvas-wrap canvas').count(),1);record('WebGL2 viewer starts');
 await page.locator('[data-tab=solar]').click();assert.equal(await page.locator('[data-solar=skyPatches]').inputValue(),'8192');assert.equal(await page.locator('[data-solar=step]').inputValue(),'1');record('Default irradiation controls show 8192 rays and one minute');
 const run=async()=>{await page.locator('#solar-run').click();await page.waitForFunction(()=>!document.querySelector('#solar-csv').disabled,{},{timeout:120000});const status=await page.locator('#solar-status').innerText();assert.ok(status.includes('samples'),status);return status;};
 const exportCSV=async name=>{const event=page.waitForEvent('download');await page.locator('#solar-csv').click();const d=await event,file=path.join(out,'exports',name+'.csv');await d.saveAs(file);const replay=replayAnalysisCSV(fs.readFileSync(file,'utf8'));assert.equal(replay.passed,true);record(name+' downloaded CSV replays',replay);};
 const save=async name=>{await page.locator('#solar-history').click();await page.locator('#analysis-history [data-name]').fill(name);await page.locator('#analysis-history [data-save]').click();assert.ok((await page.locator('#analysis-history [data-status]').innerText()).includes('saved runs'));await page.locator('#analysis-history [data-close]').click();};
 record('Daily irradiation runs',{status:await run()});assert.equal(weatherCalls,1);await exportCSV('radiation');await save('Irradiation baseline');
 await page.locator('[data-view=front]').click();await page.locator('#solar-show-points').check();await page.locator('#solar-show-grid').uncheck();await page.locator('#solar-show-grid').check();await page.locator('#solar-show-cells').uncheck();await page.locator('#solar-show-cells').check();await page.locator('#solar-show-model').uncheck();await page.locator('#solar-show-model').check();await page.locator('#solar-scale').selectOption('results');record('Heatmap, point, grid, model and scale controls remain usable');
 const canvas=await page.locator('#canvas-wrap canvas').boundingBox();let selected=false;
 for(const dx of [0,-.08,.08,-.16,.16]){for(const dy of [0,-.12,.12]){await page.mouse.click(canvas.x+canvas.width*(.5+dx),canvas.y+canvas.height*(.5+dy));if((await page.locator('#solar-selected').innerText()).includes('Grid row')){selected=true;break;}}if(selected)break;}
 assert.ok(selected,'A rendered façade cell can be selected');record('Rendered cell selection shows coordinates, grid identity and direct/diffuse values');await page.screenshot({path:path.join(out,'screenshots','desktop-irradiation.png')});
 await page.locator('#solar-refine').click();await page.waitForFunction(()=>document.querySelector('#solar-resolution').textContent.includes('Resolution check'),{},{timeout:120000});assert.equal(weatherCalls,1);record('Finer grid recalculates with identical cached weather',{summary:await page.locator('#solar-resolution').innerText()});await save('Refined irradiation');
 await page.locator('#solar-history').click();assert.ok((await page.locator('#analysis-history [data-table]').innerText()).includes('Not comparable'));record('Saved comparison blocks different grid resolutions');await page.locator('#analysis-history [data-close]').click();
 await page.locator('[data-solar=step]').selectOption('0.25');await run();await exportCSV('radiation-15seconds');
 for(const mode of ['sunlight','daylight','sky']){await page.locator('[data-solar=analysis]').selectOption(mode);if(mode==='sunlight')await page.locator('[data-solar=step]').selectOption('15');record(mode+' runs',{status:await run()});await exportCSV(mode);await save(mode);}
 await page.locator('[data-solar=analysis]').selectOption('radiation');await page.locator('#solar-run').click();await page.locator('#solar-cancel').click();assert.ok((await page.locator('#solar-status').innerText()).includes('cancelled'));assert.equal(await page.locator('#solar-run').isEnabled(),true);record('Cancellation restores usable controls');
 for(const key of ['gridWidth','gridHeight']){await page.locator('[data-solar='+key+']').fill('0.25');await page.locator('[data-solar='+key+']').dispatchEvent('change');}
 await page.locator('#solar-run').click();await page.waitForFunction(()=>document.querySelector('#solar-status').textContent.includes('Grid exceeds'),{},{timeout:30000});record('Dense grids fail clearly without freezing UI');
 await page.locator('[data-view=perspective]').click();await page.locator('#tab-plans').click();assert.equal(await page.locator('#plans-panel').isVisible(),true);await page.locator('#tab-3d').click();record('3D and plan view switches remain usable');
 await page.setViewportSize({width:390,height:844});await page.locator('#mobile-controls').click();await page.locator('[data-tab=solar]').click();assert.ok(await page.locator('#solar-run').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:path.join(out,'screenshots','mobile-controls.png')});record('Mobile solar controls fit the viewport');
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);record('No browser page errors or console errors');
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({browser:browser.version(),renderer:'SwiftShader software WebGL2',weather:'intercepted synthetic pvlib fixture; not live provider validation',checks,errors,consoleErrors},null,2)+'\n');
}catch(e){if(page)await page.screenshot({path:path.join(out,'screenshots','failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({checks,errors,consoleErrors,failure:String(e)},null,2));throw e;}finally{await browser.close();server.close();}
