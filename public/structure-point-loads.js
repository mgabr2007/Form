// Consistent nodal loads for concentrated forces/couples at an interior section.
export function consistentPointLoads(member,R,L,f){
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const points=(member.pointLoads||[]).map(p=>({t:p.t,P:R.map(r=>dot(r,p.force)),M:R.map(r=>dot(r,p.moment||[0,0,0]))}));
  for(const {t,P,M} of points){
    if(!(t>=0&&t<=1))throw Error('Point load lies outside its member.');
    const N=[1-3*t*t+2*t**3,L*(t-2*t*t+t**3),3*t*t-2*t**3,L*(-t*t+t**3)],D=[(-6*t+6*t*t)/L,1-4*t+3*t*t,(6*t-6*t*t)/L,-2*t+3*t*t];
    f[0]+=P[0]*(1-t);f[6]+=P[0]*t;f[3]+=M[0]*(1-t);f[9]+=M[0]*t;
    [1,5,7,11].forEach((id,i)=>f[id]+=P[1]*N[i]+M[2]*D[i]);
    [2,4,8,10].forEach((id,i)=>f[id]+=(i%2?-1:1)*(P[2]*N[i]-M[1]*D[i]));
  }
  return points;
}

// Fixed-end particular displacement, superposed on nodal Hermite interpolation.
export function pointDisplacement(e,m,x){
  const t=x/e.L,L=e.L,N3=3*t*t-2*t**3,N4=L*(-t*t+t**3),v=[0,0,0];
  for(const p of e.points||[]){
    const a=p.t*L;
    v[0]+=p.P[0]*(Math.min(x,a)-t*a)/(m.E*m.A);
    for(const k of [1,2]){
      const EI=m.E*(k===1?m.Iz:m.Iy),P=p.P[k],M=k===1?p.M[2]:-p.M[1];
      const force=(x<=a?x*x*(3*a-x):a*a*(3*x-a))/6;
      const moment=(x<=a?x*x:a*(2*x-a))/2;
      const end=P*a*a*(3*L-a)/6+M*a*(2*L-a)/2;
      const slope=P*a*a/2+M*a;
      v[k]+=(P*force+M*moment-N3*end-N4*slope)/EI;
    }
  }
  return v;
}
