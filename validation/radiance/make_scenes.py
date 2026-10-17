"""Dimensional scene specifications; no imports from FORM or Radiance."""
import json
from pathlib import Path
P=Path(__file__).parent

def box(name,lo,hi):return dict(name=name,min=lo,max=hi)
def sensor(name,p,n):return dict(id=name,position=p,normal=n)
def common():
 return [sensor('roof',[6,12,6],[0,1,0]),sensor('south_low',[3,2,0],[0,0,-1]),sensor('south_mid',[6,6,0],[0,0,-1]),sensor('south_high',[9,10,0],[0,0,-1]),sensor('east',[12,6,6],[1,0,0]),sensor('north',[6,6,12],[0,0,1]),sensor('west',[0,6,6],[-1,0,0])]
b=box('building',[0,0,0],[12,12,12])
scenes=[dict(id='box',boxes=[b],sensors=common(),probe={'x':[0,12],'height':[0,12],'z':0}),
 dict(id='overhang',boxes=[b,box('overhang',[-2,8,-3],[14,8.3,0])],sensors=common(),probe={'x':[0,12],'height':[0,8],'z':0}),
 dict(id='setback',boxes=[box('lower',[0,0,0],[12,6,12]),box('upper',[3,6,3],[9,12,9])],sensors=[sensor('roof',[6,12,6],[0,1,0]),sensor('terrace_south',[6,6,1.5],[0,1,0]),sensor('terrace_west',[1.5,6,6],[0,1,0]),sensor('south_lower',[6,3,0],[0,0,-1]),sensor('south_upper',[6,9,3],[0,0,-1]),sensor('east_lower',[12,3,6],[1,0,0]),sensor('north_upper',[6,9,9],[0,0,1])],probe={'x':[0,12],'height':[0,6],'z':0}),
 dict(id='courtyard',boxes=[box('west',[0,0,0],[5,10,20]),box('east',[15,0,0],[20,10,20]),box('south',[5,0,0],[15,10,5]),box('north',[5,0,15],[15,10,20])],sensors=[sensor('roof',[10,10,2.5],[0,1,0]),sensor('court_floor',[10,0.0002,10],[0,1,0]),sensor('inner_south',[10,2,15],[0,0,-1]),sensor('inner_south_high',[10,8,15],[0,0,-1]),sensor('inner_east',[5,5,10],[1,0,0]),sensor('inner_west',[15,5,10],[-1,0,0]),sensor('inner_north',[10,5,5],[0,0,1])],probe={'x':[5,15],'height':[0,10],'z':15}),
 dict(id='neighbours',boxes=[b,box('neighbour_south',[-4,0,-15],[16,18,-7]),box('neighbour_east',[18,0,-4],[26,9,16])],sensors=common(),probe={'x':[0,12],'height':[0,12],'z':0})]
# Ground is explicit geometry for both engines, black in matched runs.
for s in scenes:s['boxes'].append(box('ground',[-100,-.2,-100],[100,0,100]))
(P/'scenes.json').write_text(json.dumps({'units':'m','coordinates':'east,up,north','scenes':scenes},indent=2)+'\n')
