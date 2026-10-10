import test from 'node:test';
import assert from 'node:assert/strict';
import {exposureScale,sampleDescription} from '../dist/solar-display.js';
test('narrow actual range retains absolute values and spans colour range',()=>{const s=exposureScale([7,7.25,7.5],14);assert.equal(s.min,7);assert.equal(s.max,7.5);assert.equal(s.mean,7.25);assert.equal(s.ratio(7),0);assert.equal(s.ratio(7.25),.5);assert.equal(s.ratio(7.5),1);});
test('uniform and zero daylight results have finite consistent colours',()=>{for(const value of [0,7]){const s=exposureScale([value,value],14);assert.equal(s.uniform,true);assert.equal(s.ratio(value),.5);}assert.equal(exposureScale([0],0,'daylight').ratio(0),.5);});
test('daylight scale preserves common bounds across samples',()=>{const s=exposureScale([7,7.5],14,'daylight');assert.equal(s.low,0);assert.equal(s.high,14);assert.equal(s.ratio(7),.5);});
test('sample readout maps vertical coordinate to height and uses hours',()=>{assert.equal(sampleDescription(2,{position:[10,36,-8]},7.25),'Sample 3 · 7.25 h direct sun\nX 10.00 m · Y -8.00 m · height 36.00 m');});
