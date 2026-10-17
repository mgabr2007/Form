import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {buildBVH} from '../public/solar.js';import {skyFactor,DEFAULT_SKY_PATCHES} from '../public/radiation.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../validation/'+name,import.meta.url)));
const scenes=read('radiance/scenes.json').scenes,initial=read('radiance/results.json').sky;
const refined=[...read('radiance/refinement.json').sky,...read('release/sky-refinement.json')];
function box(b){const v=[];for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++)v.push([x?b.max[0]:b.min[0],y?b.max[1]:b.min[1],z?b.max[2]:b.min[2]]);return [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]].flatMap(([a,b,c,d])=>[...v[a],...v[b],...v[c],...v[a],...v[c],...v[d]]);}
test('default sky sampling meets unchanged frozen native Radiance limits at all 35 architectural probes',()=>{
 assert.equal(DEFAULT_SKY_PATCHES,8192);
 for(const c of scenes){const triangles=c.boxes.flatMap(box),tree=buildBVH(triangles);for(const s of c.sensors){const same=r=>r.scene===c.id&&r.sensor===s.id,reference=refined.find(same)?.radiance65536??initial.find(same).radiance16384;assert.ok(Math.abs(skyFactor(s,triangles,tree)-reference)<=.005,`${c.id}/${s.id}`);}}
});
