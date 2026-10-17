"""Follow-up comparisons, reusing independently generated native Radiance scenes."""
import sys,json,hashlib
from pathlib import Path
import numpy as np
P=Path(__file__).resolve().parent;sys.path.insert(0,str(P.parent/'radiance'))
from run_reference import daily,WORK,metrics,geometry,octree,R
x=json.loads((P/'inputs.json').read_text());old=json.loads((P.parent/'radiance/results.json').read_text());refined=json.loads((P.parent/'radiance/refinement.json').read_text())
assert hashlib.sha256((R/'bin'/'rtrace').read_bytes()).hexdigest()==old['binarySHA256']['rtrace'], 'Radiance version changed: regenerate reference sky factors'
spec=json.loads((P.parent/'radiance/scenes.json').read_text())
for definition in spec['scenes']:octree(definition['id']+'_geometry',geometry(definition))
out={'method':x['method'],'skyDirections':x['skyDirections'],'daily':[],'sky':[],'temporal':[],'spatial':[]}
for scene in x['scenes']:
 sid=scene['id'];sky=[]
 for s in scene['sensors']:
  ref=next(r['radiance16384'] for r in old['sky'] if r['scene']==sid and r['sensor']==s['id'])
  fine=next((r['radiance65536'] for r in refined['sky'] if r['scene']==sid and r['sensor']==s['id']),None)
  if fine is not None:ref=fine
  extra=next((r['radiance65536'] for r in json.loads((P/'sky-refinement.json').read_text()) if r['scene']==sid and r['sensor']==s['id']),None)
  if extra is not None:ref=extra
  sky.append(ref);out['sky'].append({'scene':sid,'sensor':s['id'],'form':s['sky'],'reference':ref,'error':s['sky']-ref,'pass':abs(s['sky']-ref)<=.005})
 for d in x['days']:
  values={}
  for step in [.25,.5,1]:
   a,b=daily(WORK/(sid+'_geometry.oct'),scene['sensors'],d['steps'][str(step)],sky);values[step]=a+b
  for i,s in enumerate(scene['sensors']):
   v=next(r['total'] for r in scene['daily'] if r['day']==d['name'] and r['sensor']==s['id']);ref=float(values[1][i]);out['daily'].append({'scene':sid,'sensor':s['id'],'day':d['name'],'form':v,'reference':ref,'error':v-ref,'pass':abs(v-ref)<=max(.02,.02*ref)})
   for step in [.5,1]:
    ref=float(values[.25][i]);v=float(values[step][i]);out['temporal'].append({'scene':sid,'sensor':s['id'],'day':d['name'],'step':step,'reference15Seconds':ref,'value':v,'change':v-ref,'pass':abs(v-ref)<=max(.01,.01*ref)})
 grids=scene['grids'];fine=next(g for g in grids if g['spacing']==.25)
 for g in grids:
  out['spatial'].append({'scene':sid,**g,'referenceQuarterMetre':fine['mean'],'change':g['mean']-fine['mean'],'pass':abs(g['mean']-fine['mean'])<=max(.01,.01*fine['mean'])})
 print(sid,flush=True)
out['summary']={'daily':{'passed':sum(r['pass'] for r in out['daily']),'cases':len(out['daily']),**metrics([r['form'] for r in out['daily']],[r['reference'] for r in out['daily']])},'sky':{'passed':sum(r['pass'] for r in out['sky']),'cases':len(out['sky']),'maxAbsolute':max(abs(r['error']) for r in out['sky'])},'time':{step:{'passed':sum(r['pass'] for r in out['temporal'] if r['step']==step),'cases':140,'maxChange':max(abs(r['change']) for r in out['temporal'] if r['step']==step)} for step in [.5,1]},'halfMetreGrid':{'passed':sum(r['pass'] for r in out['spatial'] if r['spacing']==.5),'cases':5}}
(P/'results.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out['summary'],indent=2))
