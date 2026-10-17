import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,modelData} from '../public/geometry.js';
import {floorPlans,planSVG,planDXF} from '../public/plans.js';
test('plan selector includes podium and tower floors but excludes roof',()=>{
 const s=defaults(),plans=floorPlans(s);assert.equal(plans.length,51);assert.equal(plans[0].id,'podium-1');assert.equal(plans[3].id,'tower-1');assert.equal(plans[3].elevation,3*s.storey);assert.equal(plans.at(-1).id,'tower-48');
 assert.deepEqual(plans[3].points,modelData(s).rings[0].points);
});
test('no-podium plans start at ground and match calculated floor areas',()=>{
 const s={...defaults(),podium:false},plans=floorPlans(s),d=modelData(s);assert.equal(plans.length,48);assert.equal(plans[0].elevation,0);assert.deepEqual(plans.map(p=>p.area),d.areas);
});
test('plan drawing includes accurate dimensions and escapes project names',()=>{
 const s={...defaults(),shape:'rectangle',width:30,depth:20,modifiers:[],podium:false};
 const plan=floorPlans(s)[0],svg=planSVG(plan,{project:'A < B & C'});
 assert.ok(svg.includes('30.00 m'));assert.ok(svg.includes('20.00 m'));assert.ok(svg.includes('600.00 m²'));assert.ok(svg.includes('A &lt; B &amp; C'));assert.ok(!svg.includes('A < B'));
 const overlay=planSVG(plan,{below:plan,dimensions:false});assert.ok(overlay.includes('one floor below'));assert.ok(!overlay.includes('30.00 m</text>'));
});
test('selected DXF contains only selected floor, closed polyline and metre units',()=>{
 const plans=floorPlans(defaults()),text=planDXF(plans[10]);assert.ok(text.includes('$INSUNITS\n70\n6'));assert.ok(text.includes('TOWER_8'));assert.equal((text.match(/LWPOLYLINE/g)||[]).length,1);assert.ok(text.includes('\n90\n48\n70\n1\n'));assert.ok(text.endsWith('0\nEOF\n'));
});
