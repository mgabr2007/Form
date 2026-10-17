"""Targeted follow-up to initial convergence failures; preserves original results."""
import json
from pathlib import Path
from run_reference import irradiances,WORK
P=Path(__file__).resolve().parent
r=json.loads((P/'results.json').read_text());inputs=json.loads((P/'form-inputs.json').read_text());out={'sky':[],'physics':[]}
def sensor(scene,sid):return next(s for c in inputs['scenes'] if c['id']==scene for s in c['sensors'] if s['id']==sid)
for row in r['sky']:
 if row['pass2048'] and row['referenceConverged']:continue
 high=float(irradiances(WORK/(row['scene']+'_isotropic.oct'),[sensor(row['scene'],row['sensor'])],65536,1)[0])
 out['sky'].append({'scene':row['scene'],'sensor':row['sensor'],'radiance65536':high,'changeFrom16384':high-row['radiance16384'],'converged':abs(high-row['radiance16384'])<=.0025,'form2048Error':row['form']['2048']-high,'form8192Error':row['form']['8192']-high,'pass2048':abs(row['form']['2048']-high)<=.005,'pass8192':abs(row['form']['8192']-high)<=.005})
for row in r['snapshots']:
 if row['referenceConverged']:continue
 values={};changes={}
 for label in row['W_m2']:
  high=float(irradiances(WORK/(row['scene']+'_'+row['condition']['id']+'_'+label+'.oct'),[sensor(row['scene'],row['sensor'])],65536,8 if 'reflective' in label else 1)[0]);values[label]=high;changes[label]=high-row['W_m2'][label]
 out['physics'].append({'scene':row['scene'],'sensor':row['sensor'],'condition':row['condition']['id'],'W_m2':values,'changeFrom16384':changes,'converged':all(abs(changes[k])<=max(2,.02*v) for k,v in values.items())})
(P/'refinement.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
