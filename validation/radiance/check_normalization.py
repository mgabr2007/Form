"""Independent unobstructed sky normalization and sun-coordinate diagnostic."""
import json, math
from pathlib import Path
from run_reference import cmd, source, octree, irradiances, uniform
P=Path(__file__).resolve().parent
rows=[]
sensors=[{'origin':[0,1,0],'normal':n} for n in [[0,1,0],[1,0,0],[0,0,-1],[-1,0,0],[0,0,1]]]
for alt,az,dni,dhi in [(30,135,800,120),(60,180,800,120),(30,225,800,120),(45,180,0,200)]:
 sky=cmd('gendaylit',['-ang',alt,az-180,'-W',dni,dhi,'-O',1,'-g',0,'-s']).decode()
 sky+='\nskyfunc glow upper_glow\n0\n0\n4 1 1 1 0\nupper_glow source upper\n0\n0\n4 0 0 1 180\n'
 sun=source(alt,az,dni)
 high=irradiances(octree(f'normalization_{az}_{dni}',sky+sun),sensors,16384,1)
 expected=dni*math.sin(math.radians(alt))+dhi
 beam=irradiances(octree(f'normalization_beam_{az}_{dni}',sun),sensors,4096,0) if dni else [0]*5
 a,z=math.radians(alt),math.radians(az);direction=[math.cos(a)*math.sin(z),math.sin(a),math.cos(a)*math.cos(z)]
 analytic=[dni*max(0,sum(x*y for x,y in zip(s['normal'],direction))) for s in sensors]
 rows.append({'alt':alt,'az':az,'dni':dni,'dhi':dhi,'horizontal':float(high[0]),'expectedHorizontal':expected,'horizontalPass':bool(abs(high[0]-expected)<=max(2,.02*expected)),'cardinalBeam':list(map(float,beam)),'analyticBeam':analytic,'beamPass':all(abs(x-y)<=max(1,.01*y) for x,y in zip(beam,analytic))})
(P/'normalization.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(rows,indent=2))
assert all(r['horizontalPass'] and r['beamPass'] for r in rows)
