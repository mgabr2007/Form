import test from 'node:test';import assert from 'node:assert/strict';import {resolutionSummary} from '../public/grid-resolution.js';
test('resolution study compares summaries without implying paired points',()=>{const r=resolutionSummary({values:[2,4]},{values:[2,3,4,5]});assert.equal(r.meanChange,.5);assert.equal(r.fine.count,4);assert.ok(Math.abs(r.relativeChange-100/6)<1e-9);});
test('zero coarse mean has no relative change',()=>{assert.equal(resolutionSummary({values:[0]},{values:[1]}).relativeChange,null);assert.throws(()=>resolutionSummary({values:[]},{values:[1]}));});
