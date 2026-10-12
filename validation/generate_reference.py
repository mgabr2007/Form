"""Independent fixtures. No FORM imports; pvlib SPA/transposition and SciPy quadrature.

Run: python validation/generate_reference.py
Synthetic irradiance is a numerical benchmark, NOT measured or Open-Meteo weather.
"""
import json
from pathlib import Path
import numpy as np
import pandas as pd
import scipy
from scipy.integrate import dblquad
import pvlib

assert pvlib.__version__ == "0.13.1", "Use validation/requirements.txt"
ROOT = Path(__file__).resolve().parents[1]
cases = []
surfaces = [("roof", 0, 0), ("north", 90, 0), ("east", 90, 90),
            ("south", 90, 180), ("west", 90, 270), ("south_tilt30", 30, 180)]
locations = [
    ("Berlin_equinox", "2026-03-20", 52.52, 13.405, 1),
    ("Berlin_summer", "2026-06-21", 52.52, 13.405, 2),
    ("Berlin_winter", "2026-12-21", 52.52, 13.405, 1),
    ("Cairo_equinox", "2026-03-20", 30.0444, 31.2357, 2),
    ("Cairo_summer", "2026-06-21", 30.0444, 31.2357, 3),
    ("Cairo_winter", "2026-12-21", 30.0444, 31.2357, 2),
    ("Sydney_summer", "2026-12-21", -33.8688, 151.2093, 11),
    ("Kathmandu_leap", "2024-02-29", 27.7172, 85.324, 5.75),
    ("Tromso_summer", "2026-06-21", 69.6492, 18.9553, 2),
    ("Tromso_winter", "2026-12-21", 69.6492, 18.9553, 1),
]
for name, date, lat, lon, utc in locations:
    start = int((pd.Timestamp(date, tz="UTC") - pd.Timedelta(hours=utc)).timestamp())
    # UTC-hour weather bins, clipped to the fixed-offset local day.
    records = []
    for a in range(start // 3600 * 3600, start + 86400, 3600):
        stamp = pd.to_datetime([a + 1800], unit="s", utc=True)
        pos = pvlib.solarposition.spa_python(stamp, lat, lon, altitude=0, pressure=0, delta_t=67)
        up = max(0., np.cos(np.deg2rad(pos.zenith.iloc[0])))
        dni = 650. if up > 0 else 0.
        dhi = 80. + 40. * up if up > 0 else 0.
        records.append(dict(start=max(start, a), end=min(start+86400, a+3600),
                            dni=dni, dhi=dhi, ghi=dni*up+dhi))
    mids, weights, dni, dhi, ghi = [], [], [], [], []
    for rec in records:
        for a in range(rec["start"], rec["end"], 900):
            b = min(a+900, rec["end"])
            mids.append((a+b)/2)
            weights.append((b-a)/3600/1000)
            dni.append(rec["dni"]); dhi.append(rec["dhi"]); ghi.append(rec["ghi"])
    times = pd.to_datetime(mids, unit="s", utc=True)
    pos = pvlib.solarposition.spa_python(times, lat, lon, altitude=0, pressure=0, delta_t=67)
    weights, dni, dhi, ghi = map(np.array, [weights, dni, dhi, ghi])
    # Geometric, not apparent zenith; explicitly suppress beam below horizon.
    dni[pos.elevation.to_numpy() <= 0] = 0
    expected = []
    for label, tilt, az in surfaces:
        poa = pvlib.irradiance.get_total_irradiance(tilt, az, pos.zenith, pos.azimuth,
                                                  dni, ghi, dhi, albedo=0, model="isotropic")
        values = {key: float(np.sum(poa[col].to_numpy()*weights)) for key, col in
                  [("direct", "poa_direct"), ("diffuse", "poa_sky_diffuse"), ("total", "poa_global")]}
        expected.append(dict(name=label, tilt=tilt, azimuth=az, **values))
    cases.append(dict(name=name, settings=dict(date=date, lat=lat, lon=lon, utc=utc, north=0, step=15),
                      records=records, solar=[dict(time=t, altitude=float(p.elevation), azimuth=float(p.azimuth))
                                              for t, (_, p) in zip(mids, pos.iterrows())], expected=expected))

# Finite rectangles: cosine-weighted view factor integral over obstructing area.
# Roof canopy centered above receiver, and facade overhang starting at the wall.
# These are independent area integrals, not hemisphere rays or FORM BVH tests.
obstructions = []
for name, normal, h, w, d in [("roof_square", [0,1,0], 2., 2., 2.),
                             ("roof_wide", [0,1,0], 3., 8., 4.),
                             ("facade_overhang", [0,0,1], 1., 3., 2.)]:
    zmin = -d if normal[1] else 0.
    kernel = lambda z, x: h*(h if normal[1] else z)/(np.pi*(x*x+z*z+h*h)**2)
    obscured, err = dblquad(kernel, -w, w, lambda _: zmin, lambda _: d, epsabs=1e-11, epsrel=1e-11)
    a,b,c,e = [-w,h,zmin],[w,h,zmin],[w,h,d],[-w,h,d]
    obstructions.append(dict(name=name, normal=normal, triangles=a+b+c+a+c+e,
                             expectedSky=(1+normal[1])/2-obscured, quadratureError=err))

data = dict(provenance=dict(pvlib=pvlib.__version__, numpy=np.__version__, pandas=pd.__version__,
                           scipy=scipy.__version__, method="SPA geometric zenith; pressure=0; altitude=0; delta_t=67 s; isotropic; albedo=0",
                           input="Synthetic hourly DNI/DHI; UTC bins; fixed-offset local day; 15-minute midpoints",
                           independence="Python generator imports no FORM code"), cases=cases, obstructions=obstructions)

# Independent visibility for a finite horizontal rectangle: intersect its plane
# and test the resulting x/z coordinates. No triangles or acceleration structure.
# Compare temporal resolutions to one-minute SPA integration of the SAME hourly
# input. This quantifies integration error, not unknown sub-hour cloud variability.
shaded = []
for c in cases[:3]:
    for obs in obstructions:
        verts = np.array(obs["triangles"]).reshape(-1, 3)
        xmin, h, zmin = verts.min(axis=0)
        xmax, _, zmax = verts.max(axis=0)
        for minutes in [1, 5, 15, 30, 60]:
            stamps, dt, dn, dh = [], [], [], []
            for r in c["records"]:
                for a in range(r["start"], r["end"], minutes*60):
                    b = min(r["end"], a+minutes*60)
                    stamps.append((a+b)/2); dt.append((b-a)/3600000)
                    dn.append(r["dni"]); dh.append(r["dhi"])
            p = pvlib.solarposition.spa_python(pd.to_datetime(stamps,unit="s",utc=True), c["settings"]["lat"], c["settings"]["lon"], pressure=0, altitude=0, delta_t=67)
            alt, az = np.deg2rad(p.elevation.to_numpy()), np.deg2rad(p.azimuth.to_numpy())
            directions = np.stack([np.cos(alt)*np.sin(az), np.sin(alt), np.cos(alt)*np.cos(az)],axis=1)
            distance = np.divide(h,directions[:,1],out=np.zeros(len(alt)),where=directions[:,1]>0)
            hit = directions*distance[:,None]
            obstructed = (directions[:,1]>0)&(hit[:,0]>=xmin)&(hit[:,0]<=xmax)&(hit[:,2]>=zmin)&(hit[:,2]<=zmax)
            projection = np.maximum(0, directions@np.array(obs["normal"]))
            direct = float(np.sum(np.array(dn)*projection*(alt>0)*(~obstructed)*dt))
            diffuse = float(np.sum(np.array(dh)*obs["expectedSky"]*dt))
            shaded.append(dict(case=c["name"],obstruction=obs["name"],step=minutes,direct=direct,diffuse=diffuse,total=direct+diffuse))
data["shaded"] = shaded
(ROOT/"tests/fixtures/pvlib-radiation.json").write_text(json.dumps(data, separators=(",", ":"))+"\n")
print(f"Wrote {len(cases)} daily cases / {len(cases)*len(surfaces)} surfaces and {len(obstructions)} view-factor references")
