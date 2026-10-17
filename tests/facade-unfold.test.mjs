import test from 'node:test';
import assert from 'node:assert/strict';
import {facadeSector,facadePanels} from '../public/facade-unfold.js';
test('cardinal directions match the solar north rotation convention',()=>{
 for(const [n,index] of [[[0,0,1],0],[[1,0,0],1],[[0,0,-1],2],[[-1,0,0],3]])assert.equal(facadeSector(n,0).index,index);
 assert.equal(facadeSector([1,0,0],90).index,0);
 assert.equal(facadeSector([0,0,1],90).index,3);
 assert.equal(facadeSector([-1,0,0],-90).index,0);
});
test('triangles retain result indices and shared elevations while grouping by normal',()=>{
 const r={samples:[{normal:[0,0,1]},{normal:[1,0,0]}]};
 const p=facadePanels(r,[0,2,3,4,2,3,0,8,3,4,2,3,4,8,3,4,2,0],[0,1],0);
 assert.deepEqual(p.map(x=>x.triangles.length),[1,1,0,0]);
 assert.equal(p[1].triangles[0].index,1);
 assert.deepEqual(p[0].triangles[0].points,[[0,2],[-4,2],[0,8]]);
 assert.equal(p[1].triangles[0].points[1][1],8);
});
