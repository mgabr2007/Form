"""Independent Radiance geometry/transport reference; never imports FORM.

Input directions are deliberately shared to isolate transport. Native genbox/xform
build reference geometry from dimensions, not from exported FORM triangles.
"""
import csv,hashlib,json,math,os,subprocess,sys,time
from pathlib import Path
import numpy as np
import pyradiance
P=Path(__file__).resolve().parent
R=Path(pyradiance.__file__).parent
ENV={**os.environ,'RAYPATH':str(R/'lib')}
WORK=P/'generated';WORK.mkdir(exist_ok=True)
commands=[]
def cmd(name,args=(),data=None):
 args=[str(x) for x in args];r=subprocess.run([str(R/'bin'/name),*args],input=data,capture_output=True,env=ENV,timeout=180)
 commands.append({'program':name,'args':args,'stderr':r.stderr.decode(errors='replace'),'returncode':r.returncode})
 if r.returncode:raise RuntimeError(f'{name}: {r.stderr.decode()}')
 return r.stdout

def coord(v):return [v[0],v[2],v[1]]
def text_rays(rows):return ''.join(' '.join(format(float(x),'.12g') for x in row)+'\n' for row in rows).encode()
def material(name,rho):return f'void plastic {name}\n0\n0\n5 {rho} {rho} {rho} 0 0\n'
def geometry(scene,reflect=False):
 text=material('wall',.4 if reflect else 0)+material('ground',.2 if reflect else 0)
 for b in scene['boxes']:
  size=[hi-lo for lo,hi in zip(b['min'],b['max'])]
  raw=cmd('genbox',['ground' if b['name']=='ground' else 'wall',b['name'],*coord(size)])
  text+=cmd('xform',['-t',*coord(b['min'])],raw).decode()
 return text

def octree(name,text):
 rad=WORK/(name+'.rad');rad.write_text(text);oct=WORK/(name+'.oct');oct.write_bytes(cmd('oconv',[rad]));return oct

def uniform(dhi=1):
 value=dhi/math.pi
 return f'void glow sky_glow\n0\n0\n4 {value} {value} {value} 0\nsky_glow source sky\n0\n0\n4 0 0 1 180\n'

def source(alt,az,dni):
 if dni==0:return ''
 # Small disk approximates FORM point sun. Source radiance set by projected solid angle.
 radius=math.radians(.0005);value=dni/(math.pi*math.sin(radius)**2)
 a=math.radians(alt);z=math.radians(az);d=[math.cos(a)*math.sin(z),math.cos(a)*math.cos(z),math.sin(a)]
 return f'void light solar_light\n0\n0\n3 {value} {value} {value}\nsolar_light source solar_disk\n0\n0\n4 {d[0]} {d[1]} {d[2]} .001\n'

def irradiances(oct,sensors,ad=4096,ab=1):
 args=['-h','-I+','-ov','-ab',ab,'-aa',0,'-ad',ad,'-as',0,'-av',0,0,0,'-lw',1e-7,'-u-','-dt',0,'-dc',1,'-dj',0,oct]
 raw=cmd('rtrace',args,text_rays([coord(s['origin'])+coord(s['normal']) for s in sensors]))
 a=np.fromstring(raw.decode(),sep=' ').reshape(-1,3)
 if len(a)!=len(sensors) or not np.isfinite(a).all():raise ValueError('Invalid Radiance irradiance output')
 return a.mean(axis=1)

def visibility(oct,sensors,steps):
 rows=[coord(s['origin'])+coord(t['direction']) for s in sensors for t in steps]
 raw=cmd('rtrace',['-h','-oL','-ab',0,oct],text_rays(rows))
 lengths=np.fromstring(raw.decode(),sep=' ').reshape(len(sensors),len(steps))
 return lengths>1e9

def daily(oct,sensors,steps,sky):
 vis=visibility(oct,sensors,steps)
 dirs=np.array([t['direction'] for t in steps]);n=np.array([s['normal'] for s in sensors])
 energy=np.array([t['dni']*t['hours']/1000 if t['altitude']>0 else 0 for t in steps])
 direct=((n@dirs.T).clip(0)*vis*energy).sum(axis=1)
 dhi=sum(t['dhi']*t['hours']/1000 for t in steps)
 return direct,np.asarray(sky)*dhi

def metrics(pred,ref):
 e=np.asarray(pred)-np.asarray(ref)
 return {'n':len(e),'bias':float(e.mean()),'mae':float(np.abs(e).mean()),'rmse':float(np.sqrt(np.mean(e**2))),'maxAbsolute':float(np.abs(e).max())}

def main():
 inputs=json.loads((P/'form-inputs.json').read_text());spec=json.loads((P/'scenes.json').read_text())
 result={'baseline':inputs['baseline'],'method':inputs['method'],'radiance':cmd('rtrace',['-version']).decode().strip(),'pyradiance':__import__('importlib.metadata',fromlist=['version']).version('pyradiance'),'protocolSHA256':hashlib.sha256((P/'PROTOCOL.md').read_bytes()).hexdigest(),'reference':'Native Radiance visibility plus independently coded beam integration; native Radiance isotropic diffuse transport. Shared sun vectors isolate transport.','daily':[],'sky':[],'temporal':[],'spatial':[],'snapshots':[],'normalization':[]}
 assert result['protocolSHA256']==inputs['protocolSHA256']
 # Sanity check miss distance convention and absolute sky normalization first.
 empty=octree('empty','void plastic black\n0\n0\n5 0 0 0 0 0\n')
 assert visibility(empty,[{'origin':[0,0,0],'normal':[0,1,0]}],[{'direction':[0,1,0]}])[0,0]
 unit=octree('unit_sky',uniform())
 refs=[{'origin':[0,1,0],'normal':n} for n in [[0,1,0],[1,0,0],[0,0,-1]]]
 for ad in [4096,16384]:
  val=irradiances(unit,refs,ad)
  result['normalization'].append({'ad':ad,'unitSky':val.tolist(),'analytic':[1,.5,.5]})
  if max(abs(val-np.array([1,.5,.5])))>.0025:raise ValueError('Radiance sky normalization failed')

 conditions=[{'id':'morning','alt':30,'az':135,'dni':800,'dhi':120},{'id':'noon','alt':60,'az':180,'dni':800,'dhi':120},{'id':'afternoon','alt':30,'az':225,'dni':800,'dhi':120},{'id':'overcast','alt':45,'az':180,'dni':0,'dhi':200}]
 for definition,scene in zip(spec['scenes'],inputs['scenes']):
  assert definition['id']==scene['id']
  name=scene['id'];print('Radiance scene:',name,flush=True)
  black=geometry(definition);reflect=geometry(definition,True)
  bare=octree(name+'_geometry',black);sky_oct=octree(name+'_isotropic',black+uniform())
  lo=irradiances(sky_oct,scene['sensors'],4096);hi=irradiances(sky_oct,scene['sensors'],16384)
  for i,s in enumerate(scene['sensors']):
   result['sky'].append({'scene':name,'sensor':s['id'],'radiance4096':float(lo[i]),'radiance16384':float(hi[i]),'referenceConverged':abs(hi[i]-lo[i])<=.0025,'form':s['sky'],'pass2048':abs(s['sky']['2048']-hi[i])<=.005})
  for day in inputs['days']:
   energies={}
   for step in [1,5,15,30,60]:
    direct,diffuse=daily(bare,scene['sensors'],day['steps'][str(step)],hi)
    energies[step]=direct+diffuse
    for i,s in enumerate(scene['sensors']):
     f=next(r for r in scene['daily'] if r['day']==day['name'] and r['sensor']==s['id'] and r['step']==step)
     ref=float(direct[i]+diffuse[i]);error=f['total']-ref
     result['daily'].append({'scene':name,'sensor':s['id'],'normal':s['normal'],'day':day['name'],'step':step,'formDirect':f['direct'],'referenceDirect':float(direct[i]),'formDiffuse':f['diffuse'],'referenceDiffuse':float(diffuse[i]),'form':f['total'],'reference':ref,'error':error,'pass':abs(error)<=max(.02,.02*ref)})
   for i,s in enumerate(scene['sensors']):
    for step in [5,15,30,60]:
     ref=float(energies[1][i]);value=float(energies[step][i]);result['temporal'].append({'scene':name,'sensor':s['id'],'day':day['name'],'step':step,'oneMinute':ref,'value':value,'change':value-ref,'converged':abs(value-ref)<=max(.01,.01*ref)})
   # Sky-resolution sensitivity at the fixed five-minute sensor positions.
   dhi=sum(t['dhi']*t['hours']/1000 for t in day['steps']['5'])
   for i,s in enumerate(scene['sensors']):
    for item in result['sky']:
     if item['scene']==name and item['sensor']==s['id']:
      item.setdefault('dailyResolution',[]).append({'day':day['name'],'512to2048':(s['sky']['2048']-s['sky']['512'])*dhi,'2048to8192':(s['sky']['8192']-s['sky']['2048'])*dhi})
  for grid in scene['grids']:
   sk=irradiances(sky_oct,grid['samples'],4096);day=next(d for d in inputs['days'] if d['name']=='Cairo_summer')
   a,b=daily(bare,grid['samples'],day['steps']['5'],sk)
   result['spatial'].append({'scene':name,'spacing':grid['spacing'],'count':len(a),'formMean':grid['mean'],'referenceMean':float((a+b).mean()),'paired':metrics(grid['values'],a+b)})
  for c in conditions:
   print('  physics:',c['id'],flush=True)
   sun=source(c['alt'],c['az'],c['dni'])
   direct=irradiances(octree(name+'_'+c['id']+'_beam',black+sun),scene['sensors'],4096,0) if sun else np.zeros(len(scene['sensors']))
   a=math.radians(c['alt']);z=math.radians(c['az']);d=[math.cos(a)*math.sin(z),math.sin(a),math.cos(a)*math.cos(z)]
   vis=visibility(bare,scene['sensors'],[{'direction':d}])[:,0]
   independent=np.maximum(0,np.array([s['normal'] for s in scene['sensors']])@d)*c['dni']*vis
   perez=cmd('gendaylit',['-ang',c['alt'],c['az']-180,'-W',c['dni'],c['dhi'],'-O',1,'-g',0,'-s']).decode()
   # Generated skyfunc modifies this upper-hemisphere source; no luminous ground.
   perez+=sun+'\nskyfunc glow perez_glow\n0\n0\n4 1 1 1 0\nperez_glow source upper_sky\n0\n0\n4 0 0 1 180\n'
   configs={'isotropic_black':black+uniform(c['dhi'])+sun,'perez_black':black+perez,'isotropic_reflective':reflect+uniform(c['dhi'])+sun,'perez_reflective':reflect+perez}
   values={}
   for label,rad in configs.items():
    oc=octree(name+'_'+c['id']+'_'+label,rad)
    low=irradiances(oc,scene['sensors'],4096,3 if 'reflective' in label else 1)
    high=irradiances(oc,scene['sensors'],16384,6 if 'reflective' in label else 1)
    values[label]=(low,high)
   for i,s in enumerate(scene['sensors']):
    value={label:float(v[1][i]) for label,v in values.items()}
    result['snapshots'].append({'scene':name,'sensor':s['id'],'condition':c,'directRadiance':float(direct[i]),'directIndependent':float(independent[i]),'beamPass':abs(direct[i]-independent[i])<=max(1,.01*independent[i]),'W_m2':value,'convergenceW_m2':{k:float(v[1][i]-v[0][i]) for k,v in values.items()},'referenceConverged':all(abs(v[1][i]-v[0][i])<=max(2,.02*v[1][i]) for v in values.values()),'skyEffect':value['perez_black']-value['isotropic_black'],'reflectionEffect':value['isotropic_reflective']-value['isotropic_black'],'combinedEffect':value['perez_reflective']-value['isotropic_black']})

 matched=[r for r in result['daily'] if r['step']==5]
 result['summary']={'matchedFiveMinute':metrics([r['form'] for r in matched],[r['reference'] for r in matched]),'dailyPassed':sum(r['pass'] for r in matched),'dailyCases':len(matched),'sky2048Passed':sum(r['pass2048'] for r in result['sky']),'skyCases':len(result['sky']),'referenceSkyConverged':sum(r['referenceConverged'] for r in result['sky']),'beamPassed':sum(r['beamPass'] for r in result['snapshots']),'snapshotCases':len(result['snapshots']),'physicsReferenceConverged':sum(r['referenceConverged'] for r in result['snapshots'])}
 result['binarySHA256']={name:hashlib.sha256((R/'bin'/name).read_bytes()).hexdigest() for name in ['rtrace','oconv','genbox','xform','gendaylit']}
 (P/'results.json').write_text(json.dumps(result,indent=2,default=lambda x:x.item() if isinstance(x,np.generic) else str(x))+'\n')
 (P/'commands.json').write_text(json.dumps(commands,indent=2)+'\n')
 for name,rows in [('daily',result['daily']),('spatial',result['spatial'])]:
  with (P/(name+'.csv')).open('w') as f:
   w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator="\n");w.writeheader();w.writerows(rows)
 print(json.dumps(result['summary'],indent=2,default=lambda x:x.item() if isinstance(x,np.generic) else str(x)),flush=True)
 # Characterization failures remain data, not silently changed tolerances.

if __name__ == "__main__":
 main()
