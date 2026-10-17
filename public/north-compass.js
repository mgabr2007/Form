import * as THREE from './vendor/three.module.js';

// Geographic north uses the same plan +Y / world +Z convention as solarPosition.
export function projectedNorth(camera,northDegrees){
 camera.updateMatrixWorld(true);
 const angle=northDegrees*Math.PI/180;
 const direction=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle))
  .transformDirection(camera.matrixWorldInverse);
 const length=Math.hypot(direction.x,direction.y);
 return {angle:Math.atan2(direction.x,direction.y)*180/Math.PI,
  edgeOn:length<1e-5,towardViewer:direction.z>0};
}
export function createNorthCompass(element,getCamera,getNorth){
 const arrow=element.querySelector('path'),label=element.querySelector('span');
 element.removeAttribute('aria-hidden');element.setAttribute('role','img');
 let previous='';
 return function update(){
  const north=getNorth(),p=projectedNorth(getCamera(),north);
  const text=p.edgeOn?'North points '+(p.towardViewer?'toward':'away from')+' the viewer':
   'North projected into the current camera view';
  const key=[p.angle.toFixed(3),p.edgeOn,p.towardViewer,north].join('|');
  if(key===previous)return;previous=key;
  arrow.setAttribute('transform','rotate('+p.angle+' 23 23)');
  arrow.style.display=p.edgeOn?'none':'';
  label.textContent=p.edgeOn?(p.towardViewer?'N ⊙':'N ⊗'):'N';
  element.title=text+' · north rotation '+north+'°';
  element.setAttribute('aria-label',element.title);
 };
}
