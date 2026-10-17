import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {projectedNorth} from '../public/north-compass.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6, a+' != '+b);
function camera(position,up=[0,1,0],perspective=false){
 const c=perspective?new THREE.PerspectiveCamera(45,1,.1,1000):new THREE.OrthographicCamera(-10,10,10,-10,.1,1000);
 c.position.set(...position);c.up.set(...up);c.lookAt(0,0,0);return c;
}
test('top-view compass follows world north and selected rotation',()=>{
 const c=camera([0,10,0],[0,0,-1]);
 near(Math.abs(projectedNorth(c,0).angle),180);
 near(projectedNorth(c,90).angle,90);
 near(projectedNorth(c,-90).angle,-90);
});
test('camera orbit changes projected north in perspective',()=>{
 const a=projectedNorth(camera([10,10,10],[0,1,0],true),0);
 const b=projectedNorth(camera([-10,10,10],[0,1,0],true),0);
 assert.ok(a.angle<0);assert.ok(b.angle>0);near(a.angle,-b.angle);
});
test('elevation with north along view axis does not invent an upward bearing',()=>{
 const a=projectedNorth(camera([0,0,10]),0);
 assert.equal(a.edgeOn,true);assert.equal(a.towardViewer,true);
 assert.equal(projectedNorth(camera([0,0,-10]),0).towardViewer,false);
 near(projectedNorth(camera([0,0,10]),90).angle,90);
});
