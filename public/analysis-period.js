const DAY=86400000;
export function periodDates(s){
 const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 if(!valid(s.date))throw Error('Choose a valid start date.');
 const end=s.period==='range'?s.endDate:s.date;
 if(!valid(end)||end<s.date)throw Error('End date must be on or after the start date.');
 if(end.slice(0,4)!==s.date.slice(0,4))throw Error('Choose a range within one calendar year.');
 if(s.period==='hour'&&(!Number.isInteger(s.analysisHour)||s.analysisHour<0||s.analysisHour>23))throw Error('Select an hour from 00 to 23.');
 const dates=[];for(let t=Date.parse(s.date);t<=Date.parse(end);t+=DAY)dates.push(new Date(t).toISOString().slice(0,10));
 return dates;
}
export function periodWindow(s){
 const dates=periodDates(s),start=Date.parse(s.date)/1000-s.utc*3600+(s.period==='hour'?s.analysisHour*3600:0);
 return {start,end:start+(s.period==='hour'?3600:dates.length*86400)};
}
export function periodLabel(s){
 if(s.period==='hour')return s.date+' · '+String(s.analysisHour).padStart(2,'0')+':00–'+String(s.analysisHour+1).padStart(2,'0')+':00';
 if(s.period==='range')return s.date+' through '+s.endDate+' (inclusive)';
 return s.date+' · full day';
}
