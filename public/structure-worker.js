import {generateLinked,ENGINE_LINKED} from './structure-linked.js';
import {analyzeBanded} from './structure-banded.js';
self.onmessage=({data})=>{try{
 const model=generateLinked(data.state,data.config),result=analyzeBanded(model);
 const height=Math.max(...model.nodes.map(n=>n.p[1])),maxTranslation=Math.max(...model.nodes.map((_,i)=>Math.hypot(...result.u.slice(i*6,i*6+3)))),maxRotation=Math.max(...model.nodes.map((_,i)=>Math.hypot(...result.u.slice(i*6+3,i*6+6))));
 result.screening={maxTranslation,maxRotation,largeResponse:maxRotation>.05||maxTranslation/Math.max(height,1)>.01,criteria:'Heuristic small-deformation warning: rotation > 0.05 rad or maximum displacement / height > 1%. Not a code limit or safety check.'};
 self.postMessage({engine:ENGINE_LINKED,model,result});
}catch(e){self.postMessage({error:e.message});}};
