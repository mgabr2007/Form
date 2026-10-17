import test from 'node:test';
import assert from 'node:assert/strict';
import {distribution,histogram,orientationMeans,componentMeans} from '../public/comparison-data.js';
test('quartiles use linear interpolation and preserve input',()=>{const v=[4,1,3,2];assert.deepEqual(distribution(v),{min:1,q1:1.75,median:2.5,q3:3.25,max:4,mean:2.5,count:4});assert.deepEqual(v,[4,1,3,2]);assert.equal(distribution([0]).median,0);});
test('shared histogram includes upper edge and normalizes unequal sample counts',()=>{assert.deepEqual(histogram([0,1,2],0,2,2),[100/3,200/3]);assert.deepEqual(histogram([2,2],2,2,1),[100]);assert.equal(histogram([0,0,1,1],0,1,2).reduce((a,b)=>a+b),100);});
test('orientation means use normals and north rotation; missing sector stays null',()=>{const r={settings:{target:'facade',north:90},values:[2,4],samples:[{normal:[1,0,0]},{normal:[0,0,1]}]};assert.deepEqual(orientationMeans(r),[{mean:2,count:1},{mean:null,count:0},{mean:null,count:0},{mean:4,count:1}]);assert.equal(orientationMeans({...r,settings:{target:'roof'}}),null);});
test('direct and diffuse are sample means; missing components do not become zero',()=>{const r={settings:{analysis:'radiation'},values:[3,7],components:[{direct:2,diffuse:1},{direct:4,diffuse:3}]};assert.deepEqual(componentMeans(r),{direct:3,diffuse:2});assert.equal(componentMeans({...r,components:[{}]}),null);});
