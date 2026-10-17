import sys,json
from pathlib import Path
P=Path(__file__).resolve().parent;sys.path.insert(0,str(P.parent/'radiance'))
from run_reference import irradiances,WORK,geometry,octree,uniform
for definition in json.loads((P.parent/'radiance/scenes.json').read_text())['scenes']:octree(definition['id']+'_isotropic',geometry(definition)+uniform())
x=json.loads((P/'inputs.json').read_text());r=json.loads((P/'regular-grid-attempt.json').read_text());out=[]
for row in r['sky']:
 if row['pass']:continue
 sensor=next(s for c in x['scenes'] if c['id']==row['scene'] for s in c['sensors'] if s['id']==row['sensor'])
 v=float(irradiances(WORK/(row['scene']+'_isotropic.oct'),[sensor],65536,1)[0]);out.append({**row,'radiance65536':v,'referenceChange':v-row['reference'],'referenceConverged':abs(v-row['reference'])<=.0025})
(P/'sky-refinement.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
