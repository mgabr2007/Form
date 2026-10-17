import {spaceElement} from './structure-3d.js';

// Symmetric band Cholesky, equilibrated by diagonal stiffness. All restraints zero.
export function analyzeBanded(model) {
  const n=model.nodes.length*6;
  if(n>9000)throw Error('Maximum 1,500 structural joints. Reduce the structural bay count.');
  const fixed=new Set(model.fixed),free=[],index=Array(n).fill(-1);
  for(let i=0;i<n;i++)if(!fixed.has(i)){index[i]=free.length;free.push(i);}
  let bandwidth=0;
  const elements=model.members.map(m=>{
    const d=[...Array.from({length:6},(_,i)=>m.a*6+i),...Array.from({length:6},(_,i)=>m.b*6+i)];
    const ids=d.map(i=>index[i]).filter(i=>i>=0);
    if(ids.length)bandwidth=Math.max(bandwidth,Math.max(...ids)-Math.min(...ids));
    return {d,e:spaceElement(model.nodes[m.a].p,model.nodes[m.b].p,m)};
  });
  if(bandwidth>600)throw Error('Structural connectivity exceeds the band solver limit. Reduce the bay count.');
  const size=free.length,stride=bandwidth+1,K=new Float64Array(size*stride),F=model.loads.slice();
  for(const {d,e} of elements)d.forEach((i,r)=>{
    F[i]+=e.fg[r];const ii=index[i];if(ii<0)return;
    d.forEach((j,c)=>{const jj=index[j];if(jj>=0&&ii>=jj)K[ii*stride+ii-jj]+=e.kg[r][c];});
  });
  const scale=free.map((_,i)=>1/Math.sqrt(K[i*stride]));
  if(scale.some(x=>!Number.isFinite(x)))throw Error('Unrestrained degree of freedom or invalid stiffness.');
  for(let i=0;i<size;i++)for(let d=0;d<=Math.min(i,bandwidth);d++)K[i*stride+d]*=scale[i]*scale[i-d];
  for(let i=0;i<size;i++){
    for(let j=Math.max(0,i-bandwidth);j<=i;j++){
      let value=K[i*stride+i-j];
      for(let k=Math.max(0,i-bandwidth,j-bandwidth);k<j;k++)value-=K[i*stride+i-k]*K[j*stride+j-k];
      if(i===j){if(!(value>1e-12))throw Error('Frame is unstable or too ill-conditioned for this solver.');K[i*stride]=Math.sqrt(value);}
      else K[i*stride+i-j]=value/K[j*stride];
    }
  }
  const v=Float64Array.from(free,(i,j)=>F[i]*scale[j]);
  for(let i=0;i<size;i++){for(let j=Math.max(0,i-bandwidth);j<i;j++)v[i]-=K[i*stride+i-j]*v[j];v[i]/=K[i*stride];}
  for(let i=size-1;i>=0;i--){for(let j=i+1;j<=Math.min(size-1,i+bandwidth);j++)v[i]-=K[j*stride+j-i]*v[j];v[i]/=K[i*stride];}
  const u=Array(n).fill(0);free.forEach((i,j)=>u[i]=v[j]*scale[j]);
  if(u.some(v=>!Number.isFinite(v)))throw Error('Non-finite structural response.');
  const reactions=model.loads.map(v=>-v),results=[];
  for(const {d,e} of elements){
    const ul=e.T.map(row=>row.reduce((sum,v,j)=>sum+v*u[d[j]],0)),forces=e.k.map((row,i)=>row.reduce((sum,v,j)=>sum+v*ul[j],0)-e.f[i]);
    for(let i=0;i<12;i++)for(let j=0;j<12;j++)reactions[d[i]]+=e.T[j][i]*forces[j];
    results.push({L:e.L,R:e.R,q:e.q,points:e.points,ul,forces});
  }
  const residual=Math.max(0,...free.map(i=>Math.abs(reactions[i]))),peak=Math.max(1,...F.map(Math.abs));
  if(residual>1e-5*peak)throw Error('Structural equilibrium residual exceeds tolerance.');
  return {u,reactions,residual,elements:results,solver:'equilibrated-band-cholesky-1',bandwidth};
}
