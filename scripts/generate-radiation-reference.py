"""Regenerate independent reference: python -m pip install pvlib==0.13.1
No FORM functions imported. Synthetic hourly forcing isolates numerical correctness.
"""
import json, math
from pathlib import Path
import numpy as np
import pandas as pd
import pvlib
assert pvlib.__version__=='0.13.1'
surfaces=[('roof',0,0),('north',90,0),('east',90,90),('south',90,180),('west',90,270),('tilted south',30,180)]
result={'pvlib_version':pvlib.__version__,'description':'Synthetic hourly weather, geometric NREL SPA, isotropic sky, zero ground reflection. Not measured weather or field validation.','cases':[]}
for city,lat,lon,utc in [('Cairo',30.0444,31.2357,2),('Berlin',52.52,13.405,1),('Riyadh',24.7136,46.6753,3),('Sydney',-33.8688,151.2093,10)]:
 for date in ['2026-03-20','2026-06-21','2026-12-21']:
  start=int(pd.Timestamp(date,tz='UTC').timestamp())-utc*3600
  hourly=pd.to_datetime(start+np.arange(24)*3600+1800,unit='s',utc=True)
  sun=pvlib.solarposition.spa_python(hourly,lat,lon)
  records=[]
  for i,alt in enumerate(sun.elevation):
   dni=float(650*(.8+.2*math.cos(i))) if alt>0 else 0.; dhi=120. if alt>0 else 0.
   records.append(dict(start=start+i*3600,end=start+(i+1)*3600,dni=dni,dhi=dhi,ghi=dhi+dni*max(0,math.sin(math.radians(alt)))))
  case=dict(city=city,settings=dict(date=date,lat=lat,lon=lon,utc=utc,north=0),records=records,reference=[])
  for step in [1,5,15,30,60]:
   times=pd.to_datetime(start+np.arange(1440//step)*step*60+step*30,unit='s',utc=True)
   sol=pvlib.solarposition.spa_python(times,lat,lon)
   dni=np.repeat([r['dni'] for r in records],60//step);dhi=np.repeat([r['dhi'] for r in records],60//step)
   output=[]
   for name,tilt,az in surfaces:
    direct=pvlib.irradiance.beam_component(tilt,az,sol.zenith,sol.azimuth,dni).to_numpy();direct[sol.elevation.to_numpy()<=0]=0
    diffuse=pvlib.irradiance.isotropic(tilt,dhi)
    output.append(dict(name=name,normal=[math.sin(math.radians(tilt))*math.sin(math.radians(az)),math.cos(math.radians(tilt)),math.sin(math.radians(tilt))*math.cos(math.radians(az))],direct=float(direct.sum()*step/60000),diffuse=float(diffuse.sum()*step/60000)))
   case['reference'].append(dict(step=step,surfaces=output))
  result['cases'].append(case)
# Independent ray/AABB intersection, equal-solid-angle numerical reference.
lo=np.array([5.,0.,-5.]);hi=np.array([15.,20.,5.]);m=256;n=512
up=(np.arange(m)+.5)/m;az=(np.arange(n)+.5)*2*np.pi/n
xx=np.sqrt(1-up[:,None]**2)*np.cos(az);zz=np.sqrt(1-up[:,None]**2)*np.sin(az)
dirs=np.stack([xx,np.broadcast_to(up[:,None],xx.shape),zz],axis=-1).reshape(-1,3)
result['obstruction']=dict(box_min=lo.tolist(),box_max=hi.tolist(),reference_rays=m*n,samples=[])
for position,normal in [([0,1,0],[1,0,0]),([0,1,0],[0,1,0]),([0,15,0],[1,0,0]),([0,25,0],[0,1,0])]:
 norm=np.array(normal);origin=np.array(position)+.02*norm
 a=(lo-origin)/dirs;b=(hi-origin)/dirs
 blocked=(np.max(np.minimum(a,b),axis=1)<=np.min(np.maximum(a,b),axis=1))&(np.min(np.maximum(a,b),axis=1)>0)
 w=np.maximum(0,dirs@norm)
 value=(1+norm[1])/2*w[~blocked].sum()/w.sum()
 result['obstruction']['samples'].append(dict(position=position,normal=normal,sky=float(value)))
Path('tests/fixtures/radiation-reference.json').write_text(json.dumps(result,indent=2)+'\n')
