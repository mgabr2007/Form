import {defaults,modelData} from '../public/geometry.js';
import {writeFileSync} from 'node:fs';
const frames=Array.from({length:160},(_,i)=>{const t=(1-Math.cos(i/160*Math.PI*2))/2,s=defaults();s.floors=32;s.modifiers[0].end=32;s.modifiers[1].end=32;s.modifiers[0].value=t*105;s.modifiers[1].value=8+22*t;return modelData(s).rings.map(r=>({y:r.y,points:r.points}));});
writeFileSync(process.argv[2],JSON.stringify(frames));
