"""Render labelled explanatory motion graphics; requires Pillow and ffmpeg.
Run welcome-geometry.mjs first to produce the geometry JSON argument.
"""
from PIL import Image,ImageDraw,ImageFont
import math,json,subprocess,sys
from pathlib import Path
frames=json.loads(Path(sys.argv[1]).read_text());out=Path('public/media');out.mkdir(exist_ok=True)
W,H=960,600
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
f=lambda n:ImageFont.truetype(font,n)
F={n:f(n) for n in [11,13,15,18,22,32,44]}
ink='#243c33'; muted='#718378';lime='#d8f49c'
def text(d,p,t,n=15,c=ink):d.text(p,t,font=F[n],fill=c)
def project(p,y,cx,base,scale,angle):
 x,z=p;u=x*math.cos(angle)-z*math.sin(angle);v=x*math.sin(angle)+z*math.cos(angle)
 return (cx+scale*u,base+scale*(.34*v-.96*y))
def tower(d,rings,cx=600,base=500,scale=2.9,angle=.58,dark=False):
 for r in rings:
  pts=[project(p,r['y'],cx,base,scale,angle) for p in r['points']]
  d.polygon(pts,fill='#557467' if dark else '#d2e0c6')
  d.line(pts+[pts[0]],fill='#b1c59d' if dark else '#688272',width=1)
 # Ground datum
 d.line([(cx-130,base+38),(cx+160,base+38)],fill='#5c7664' if dark else '#b4c1ad',width=1)
def shape(i):
 im=Image.new('RGB',(W,H),'#eef2e7');d=ImageDraw.Draw(im)
 for x in range(-600,1200,60):d.line([(x,600),(x+900,300)],fill='#e0e7d7',width=1)
 text(d,(45,40),'FORM / GEOMETRY IN MOTION',13)
 text(d,(45,112),'One footprint.',32);text(d,(45,157),'Many possibilities.',32)
 text(d,(45,235),'TWIST + TAPER',13,muted)
 t=(1-math.cos(i/160*math.pi*2))/2
 for y,label,v in [(292,'Twist',t),(365,'Taper',.08+.22*t)]:
  text(d,(45,y-28),label,15);d.rounded_rectangle((45,y,285,y+5),radius=2,fill='#c9d5bd');d.rounded_rectangle((45,y,45+max(4,240*v),y+5),radius=2,fill='#63824c');d.ellipse((39+240*v,y-5,51+240*v,y+7),fill=ink)
 tower(d,frames[i]);text(d,(45,545),'Generated from FORM floor-plate geometry',13,muted)
 return im
def solar(i):
 im=Image.new('RGB',(W,H),'#20392f');d=ImageDraw.Draw(im)
 text(d,(40,32),'FORM / READ THE FAÇADE',13,lime);text(d,(40,69),'See the pattern. Inspect the sample.',32,'#f2f6eb')
 phase=i/160*math.pi*2
 palette=['#314f73','#407f8b','#7eac7a','#cee182','#edb965','#ce8052']
 for face,name in enumerate(['NORTH','EAST','SOUTH','WEST']):
  x0=42+face*232;text(d,(x0,155),name,13,'#c9d8c0')
  for y in range(15):
   for x in range(9):
    q=(math.sin(x*.26+y*.12+phase+face)+1)/2;k=min(5,int(q*6))
    xx=x0+x*20;yy=192+y*19;d.rectangle((xx,yy,xx+17,yy+16),fill=palette[k])
  if face==1:
   xx=x0+4*20;yy=192+7*19;d.rectangle((xx-3,yy-3,xx+20,yy+19),outline='#fff',width=2)
 d.line((320,345,380,506),fill='#d8f49c',width=1);text(d,(385,495),'Inspect a cell',15,lime)
 text(d,(40,548),'ILLUSTRATIVE COLOUR PATTERN · NOT CALCULATED RESULTS',13,'#c9d8c0')
 return im
def compare(i):
 im=Image.new('RGB',(W,H),'#e9eee3');d=ImageDraw.Draw(im)
 text(d,(40,32),'FORM / COMPARE DESIGN OPTIONS',13);text(d,(40,70),'Keep the question. Change the form.',32)
 for j,k in enumerate([0,40,80]):
  cx=165+j*315;d.rounded_rectangle((cx-135,148,cx+135,523),radius=12,fill='#f7f9f2',outline='#d0daca')
  tower(d,frames[k],cx,470,2.1,.5+math.sin(i/160*math.pi*2)*.13)
  text(d,(cx-105,172),['A / BASE','B / TWIST','C / TWIST + TAPER'][j],13)
 text(d,(40,552),'Geometry alternatives · calculate compatible studies before ranking.',13,muted)
 return im
for name,fn in [('form-morph',shape),('facade-pattern',solar),('design-options',compare)]:
 proc=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s','960x600','-r','20','-i','-','-an','-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',str(out/(name+'.mp4'))],stdin=subprocess.PIPE)
 for i in range(160):
  im=fn(i)
  if i==40:im.save(out/(name+'.webp'),quality=88)
  proc.stdin.write(im.tobytes())
 proc.stdin.close();assert proc.wait()==0
 print(name, (out/(name+'.mp4')).stat().st_size)
