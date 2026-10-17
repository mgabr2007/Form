export function exposureScale(values,daylight,mode='results'){
 const min=Math.min(...values),max=Math.max(...values),mean=values.reduce((a,v)=>a+v,0)/values.length,uniform=Math.abs(max-min)<1e-8;
 const low=mode==='daylight'?0:min,high=mode==='daylight'?daylight:max;
 return{min,max,mean,uniform,low,high,ratio(value){return high-low<1e-8?.5:Math.max(0,Math.min(1,(value-low)/(high-low)));}};
}
// An auto-expanded narrow range must not display five identical rounded ticks.
export function scaleLabels(scale){
 const span=scale.high-scale.low,precision=span>0?Math.max(2,Math.min(10,Math.ceil(-Math.log10(span/4))+1)):2;
 return Array.from({length:5},(_,i)=>(scale.low+span*i/4).toFixed(precision));
}
export function sampleDescription(index,sample,hours,unit='h direct sun'){const [x,height,y]=sample.position;return `Sample ${index+1} · ${hours.toFixed(unit==='kWh/m²'?4:2)} ${unit}\nX ${x.toFixed(2)} m · Y ${y.toFixed(2)} m · height ${height.toFixed(2)} m`;}
