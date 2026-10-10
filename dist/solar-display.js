export function exposureScale(values,daylight,mode='results'){
 const min=Math.min(...values),max=Math.max(...values),mean=values.reduce((a,v)=>a+v,0)/values.length,uniform=Math.abs(max-min)<1e-8;
 const low=mode==='daylight'?0:min,high=mode==='daylight'?daylight:max;
 return{min,max,mean,uniform,low,high,ratio(value){return high-low<1e-8?.5:Math.max(0,Math.min(1,(value-low)/(high-low)));}};
}
export function sampleDescription(index,sample,hours){const [x,height,y]=sample.position;return `Sample ${index+1} · ${hours.toFixed(2)} h direct sun\nX ${x.toFixed(2)} m · Y ${y.toFixed(2)} m · height ${height.toFixed(2)} m`;}
