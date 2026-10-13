export function resolutionSummary(coarse,fine){
 const stats=values=>{if(!values.length||values.some(v=>!Number.isFinite(v)))throw Error('Invalid resolution results');return {count:values.length,min:Math.min(...values),max:Math.max(...values),mean:values.reduce((a,b)=>a+b,0)/values.length};};
 const a=stats(coarse.values),b=stats(fine.values);return {coarse:a,fine:b,meanChange:b.mean-a.mean,relativeChange:a.mean===0?null:100*(b.mean-a.mean)/a.mean};
}
