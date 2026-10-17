"""Evaluate real paired interval means; never generates or fills observations."""
import argparse,csv,json,math
from collections import defaultdict
from datetime import datetime,timedelta,timezone

def analyze(path):
 groups=defaultdict(list)
 with open(path,newline='') as f:
  for line,r in enumerate(csv.DictReader(f),2):
   try:
    sid=r['sensor_id'].strip();t=datetime.fromisoformat(r['start_utc'].replace('Z','+00:00'));dt=float(r['duration_seconds']);q=r['quality'].strip()
    if not sid or not q or t.utcoffset()!=timedelta(0) or not math.isfinite(dt) or dt<=0:raise ValueError('invalid identity, UTC time, quality or duration')
    end=t+timedelta(seconds=dt)
    if end>datetime.combine(t.date()+timedelta(days=1),datetime.min.time(),timezone.utc):raise ValueError('interval crosses UTC midnight')
    m=p=None
    if q=='valid':
     m=float(r['measured_w_m2']);p=float(r['predicted_w_m2'])
     if not all(math.isfinite(v) and v>=0 for v in [m,p]):raise ValueError('invalid irradiance')
    groups[sid].append((t,end,dt,m,p,q))
   except (ValueError,KeyError,TypeError) as e:raise ValueError(f'row {line}: {e}') from e
 if not groups:raise ValueError('No observations supplied; field validation is incomplete')
 result={}
 for sid,rows in groups.items():
  rows.sort(key=lambda r:r[0])
  if any(b[0]<a[1] for a,b in zip(rows,rows[1:])):raise ValueError(f'{sid}: overlapping/duplicate intervals')
  valid=[r for r in rows if r[5]=='valid'];duration=sum(r[2] for r in valid)
  entry={'validIntervals':len(valid),'validSeconds':duration,'excludedIntervals':len(rows)-len(valid),'excludedSeconds':sum(r[2] for r in rows if r[5]!='valid'),'metrics':None,'days':[]}
  if duration:
   entry['metrics']={k:sum(fn(r[4]-r[3])*r[2] for r in valid)/duration for k,fn in [('biasW_m2',lambda x:x),('maeW_m2',abs),('mse',lambda x:x*x)]}
   entry['metrics']['rmseW_m2']=math.sqrt(entry['metrics'].pop('mse'))
  days=defaultdict(list)
  for r in rows:days[r[0].date()].append(r)
  for day,rr in sorted(days.items()):
   start=datetime.combine(day,datetime.min.time(),timezone.utc)
   complete=rr[0][0]==start and rr[-1][1]==start+timedelta(days=1) and all(r[5]=='valid' for r in rr) and all(a[1]==b[0] for a,b in zip(rr,rr[1:]))
   d={'day':str(day),'complete':complete}
   if complete:
    d.update(measuredKWh_m2=sum(r[3]*r[2]/3600000 for r in rr),predictedKWh_m2=sum(r[4]*r[2]/3600000 for r in rr))
   entry['days'].append(d)
  result[sid]=entry
 return {'status':'metrics only; field acceptance criteria require prior approval','sensors':result}

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('csv');p.add_argument('--output',required=True);a=p.parse_args()
 result=analyze(a.csv)
 with open(a.output,'w') as f:json.dump(result,f,indent=2);f.write('\n')
