import {blocked} from './solar.js';
// CIE standard overcast: relative luminance L = 1 + 2 sin(altitude).
// VSC reference horizontal illuminance = integral L*u*dOmega = 7*pi/3.
// https://publications.ibpsa.org/proceedings/esim/2002/papers/esim2002_o2.pdf
export function skyExposure(sample,tris,bvh,resolution=32){
 if(![16,32,64].includes(resolution))throw Error('Unsupported sky resolution');
 const length=Math.hypot(...sample.normal);if(!Number.isFinite(length)||length<1e-9)throw Error('Invalid surface normal');
 const normal=sample.normal.map(v=>v/length),h=Math.hypot(normal[0],normal[2]),vertical=h>1e-8?[normal[0]/h,0,normal[2]/h]:null,origin=sample.position.map((v,i)=>v+.02*normal[i]);
 let visible=0,horizontal=0,verticalLight=0;const count=2*resolution*resolution;
 for(let j=0;j<resolution;j++){const u=(j+.5)/resolution,r=Math.sqrt(1-u*u);for(let k=0;k<2*resolution;k++){const a=2*Math.PI*(k+.5)/(2*resolution),d=[r*Math.cos(a),u,r*Math.sin(a)];if(blocked(origin,d,tris,bvh))continue;visible++;horizontal+=u;if(vertical)verticalLight+=(1+2*u)*Math.max(0,vertical[0]*d[0]+vertical[2]*d[2]);}}
 return{vsc:vertical?100*6*verticalLight/(7*count):null,skyView:100*2*horizontal/count,visibleSky:100*visible/count,rays:count};
}
