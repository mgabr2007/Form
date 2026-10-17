import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../public/geometry.js';
import {facadeGrid} from '../public/facade-grid.js';
import {savedMassTriangles,savedFacadeCells} from '../public/saved-facade.js';
function fixture(){const project={...defaults(),floors:5,modifiers:[]};const grid=facadeGrid(savedMassTriangles(project),10,5);return {project,sampling:'facade-grid-v1',settings:{target:'facade',gridWidth:10,gridHeight:5},samples:grid.samples,values:grid.samples.map(()=>2)};}
test('saved facade reconstructs coloured cells without changing historical values',()=>{const r=fixture(),before=JSON.stringify(r),g=savedFacadeCells(r);assert.ok(g.positions.length>0);assert.equal(g.positions.length,g.indices.length*9);assert.ok(g.indices.every(i=>i>=0&&i<r.values.length));assert.equal(JSON.stringify(r),before);});
test('refuses assigning historical values to mismatched sample locations',()=>{const r=fixture();r.samples[0].position[0]+=.1;assert.throws(()=>savedFacadeCells(r),/no longer match/);});
test('non facade and mismatched sample counts give explicit errors',()=>{const r=fixture();assert.throws(()=>savedFacadeCells({...r,settings:{target:'roof'}}),/supported/);r.values.pop();assert.throws(()=>savedFacadeCells(r),/does not match/);});
