import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../dist/vendor/three.module.js';

// Exercise the actual camera setup with real Three.js cameras and bounds.
// Only the DOM and OrbitControls event bindings are substituted; no WebGL needed.
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const fitSource=source.slice(source.indexOf('function fit('),source.indexOf('function init3D('));
function fixture(){
 const instances=[];
 class Controls{
  constructor(camera,element){this.camera=camera;this.element=element;this.target=new THREE.Vector3();this.disposed=false;instances.push(this);}
  update(){this.camera.lookAt(this.target);}
  dispose(){this.disposed=true;}
 }
 const group=new THREE.Group();group.add(new THREE.Mesh(new THREE.BoxGeometry(36,180,30)));
 const dom={clientWidth:900,clientHeight:650,classList:{remove(){},toggle(){}}};
 const context=vm.createContext({THREE,OrbitControls:Controls,renderer:{domElement:{}},group,reference:null,view:'perspective',controls:undefined,camera:undefined,perspective:new THREE.PerspectiveCamera(34,900/650,.1,6000),ortho:new THREE.OrthographicCamera(),$:()=>dom,$$:()=>[]});
 vm.runInContext(fitSource,context);return{context,instances};
}
test('first viewer setup creates controls without disposing an undefined instance',()=>{
 const {context,instances}=fixture();vm.runInContext('fit()',context);
 assert.equal(instances.length,1);assert.equal(context.camera,context.perspective);assert.equal(context.controls,instances[0]);assert.ok(context.camera.position.toArray().every(Number.isFinite));
});
test('view switches dispose existing controls and create usable replacements',()=>{
 const {context,instances}=fixture();vm.runInContext("fit(); fit('front'); fit('top'); fit('perspective');",context);
 assert.equal(instances.length,4);assert.ok(instances.slice(0,-1).every(c=>c.disposed));assert.equal(instances.at(-1).disposed,false);assert.equal(context.camera,context.perspective);assert.ok(context.camera.projectionMatrix.elements.every(Number.isFinite));
});
