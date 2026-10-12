# FORM — Parametric Tower Studio

A static, browser-based architectural massing tool. All geometry and project storage run on the visitor's device. No backend, API keys, paid computation, or package installation is needed to serve it.

## Run or host

Serve the `dist/` folder with a static web server. The entry point is `dist/index.html`. ES modules require HTTP(S), so opening the file directly with `file://` is not supported.

For Cloudflare Pages Direct Upload, upload the contents of `dist/`, or a ZIP whose root contains `index.html`, `app.js`, `geometry.js`, `style.css`, and `vendor/`. Use the free plan for static hosting. A Cloudflare account is required for that deployment. This source also includes the manifest for its ChatGPT Site deployment.

## Features

- Rectangular, rounded, elliptical and hexagonal footprints; dimensions, orientation, tower storeys, floor height and independent podium.
- Up to 12 enabled/disabled twist, taper, lean, bend, bulge, setback, shape transition, corner treatment, wave, stepped terraces and floor offset modifiers with floor ranges.
- Perspective orbit and orthographic front/side/top views, auto-rotate, façade/mass/floor views.
- Six presets, 30 browser-local saved alternatives, comparison and undo/redo (Ctrl/Cmd-Z, Shift-Ctrl/Cmd-Z).
- Project JSON, binary glTF/GLB, PNG viewport, CSV calculations, and DXF floor-outline exports.
- Autosave where browser storage is permitted. Export JSON for durable backups.

## Geometry and units

Metres and degrees. Floor outlines have 48 vertices. The model applies scale modifiers, combined rotation, then centreline offsets. A modifier begins at the base of its starting floor and completes at the top of its ending floor. Setbacks apply from their starting floor through the roof. At an intermediate setback, the envelope includes a horizontal terrace.

Reported area is the sum of modelled floor outlines, including podium floors but excluding the roof plate. No wall, core, atrium or void deductions are made. Curved outline areas are polygon approximations. The tower storey count excludes the podium. The model is conceptual; there is no structural, environmental or regulatory validation.

GLB uses metres with Y up and exports only the current building, excluding reference comparisons and the scene environment. JSON preserves editable parameters. DXF uses metres, with closed 2D polylines superimposed at their actual plan coordinates on named per-floor layers; use layer isolation to inspect individual floors. CSV includes parameters and modelled areas, not code-defined GFA.

## Verification

`node --test tests/*.test.js`

Analytical tests cover area, height, podium accounting, area-preserving transformations, taper, terraces, combined modifiers and project round-tripping. Browser visual QA was unavailable in the authoring environment; verify interaction and file opening in your target browsers/CAD tools before professional use.

## Dependencies

Three.js 0.180.0 is bundled under its MIT licence (`dist/vendor/LICENSE.txt`). Includes OrbitControls and GLTFExporter from that release.

## 2D Plans

The 2D Plans tab shows individual podium and tower floor outlines, their base elevations, area and optional axis-aligned overall dimensions. Solid grey overlays can show one or all lower floors, masked inside the selected floor outline. It is independent of WebGL. Export the selected floor as an annotated SVG or PNG, or a closed DXF outline in metres. These are conceptual floor outlines, not room layouts.

## BIM export and copyright

Export → IFC creates an IFC4 file containing the Project/Site/Building/Storey hierarchy, IfcSlab floor and roof elements, and an explicitly labelled conceptual envelope as IfcBuildingElementProxy with triangulated surface geometry. Uses metre units, Z-up, the same X/Y plan coordinates as DXF, and nominal slab thicknesses of 0.23 m (tower) and 0.30 m (podium). Parameters and modelled floor areas are exported as FORM properties. The envelope is an open surface, not a detailed wall assembly. This is a conceptual BIM exchange, not a native RVT file or a construction-ready model.

Copyright © 2026 Mostafa A. Gabr. All rights reserved for the FORM application. Third-party Three.js components retain their MIT licence.

## Additional form modifiers
Shape transition blends to a target footprint. Corner treatment rounds toward a chosen radius (percentage of half the shorter dimension). These footprint operations run in list order before global scale, rotation and translation. Wave shifts floor centres along X or Y with cycle and phase controls and smooth zero displacement at range boundaries. Stepped terraces inset all or one side every N floors and retain at least 20% width/depth; the final inset persists above the range. Floor offsets alternate unshifted/shifted groups every N floors and return to the original centre above the range. Discontinuous changes have horizontal envelope transitions. All new settings survive project JSON, browser storage and IFC parameters; CSV includes options JSON.

## Openings, balconies and local form controls
- Atrium/courtyard: rectangular or elliptical subtraction, with X/Y offsets and a floor range. Overlapping openings are merged by polygon operations; openings reaching the façade become recesses and can split a floor into separate regions.
- Façade cut-out: depth, opening width, selected plan-axis side and along-side position. Coordinates are plan X/Y axes, relative to each floor's bounding box, and do not rotate independently with its façade.
- Local rotation: rotates only the chosen group of floors; upper floors return to their original orientation.
- Balconies: separate conceptual slab extensions, selected side and every-N-floor repetition. Projection uses an expanded floor outline (axis-based extension, not a constant normal offset on curves). Balcony area is shown separately and excluded from modelled tower floor area. No railings or structural detailing.
- Slenderness: multiplies width/depth ratio progressively while preserving area before other modifiers and openings.

3D caps are triangulated with holes and concave boundaries. IFC slabs use profiles with voids and separate slab parts for disconnected regions; balconies are separate slabs. SVG/PNG plans use even-odd fill and DXF exports include interior rings. For models containing openings, the envelope lofts clipped sections at quarter-storey intervals. Changes in polygon topology are refined to narrow stepped strips and flagged in the interface; this is a sampled concept mesh, not an exact solid-boolean CAD surface. The podium is unchanged. A cut can remove an entire floor; its area then reads zero and no slab is exported for that floor. Roof openings persist when the range ends at the top storey.

Polygon boolean operations use polygon-clipping 0.15.7 (MIT); its license is bundled in `dist/vendor/polygon-clipping-LICENSE.txt`. Browser visual QA remains unavailable in the authoring environment.

## Geometry review
The 3D viewer and IFC proxy share one envelope triangulation. Floor-area calculations and slab profiles remain based on floor sections. Removed or disconnected floors are identified in the controls; empty models use safe camera bounds. Roof/opening and abrupt modifier boundaries include horizontal transition surfaces. Numerical regression tests cover mixed openings/twist/taper, unequal polygon vertex counts and topology changes; interactive browser and target-application verification are still required.

## Modifier editing
Progressive modifiers offer linear, ease-in (t²), ease-out (1−(1−t)²), and smooth S-curve (3t²−2t³) transitions across their floor range. Existing projects default to linear and preserve their geometry. For waves, bend and bulge, the curve remaps progress through the existing profile. Discrete floor-group modifiers retain exact floor boundaries and do not show a transition selector.

Copy inserts an independent modifier immediately after the original; Up/Down works on mobile and keyboard, while the handle supports desktop drag-and-drop. Edits participate in undo/redo and JSON/browser saves. The established evaluation stages are preserved: outline operations (shape transition, corners, slenderness, terraces) execute in list order, then combined scale, rotation, translation, openings and balconies. Moving cards between stages does not change that stage order; each card and the panel explain this. CSV now records transition curves explicitly.

## Browser solar studies
The Solar panel calculates approximate sun position using NOAA's General Solar Position Calculations (https://gml.noaa.gov/grad/solcalc/solareqns.PDF). It uses latitude, east-positive longitude, user-entered UTC offset (including any daylight saving), date, local clock time and model north rotation. North 0° follows plan +Y; positive rotation turns north toward +X. No atmospheric refraction is applied.

Enable sun path/shadows, optionally add up to five opaque rectangular context buildings, and calculate direct sunlight hours for one selected day. Ground uses a 25×25 point grid; roof/upward and façade targets use 500 deterministic area-weighted samples. Analysis rays use a dedicated full mass model, independent of display mode, and include envelope/slabs/balconies/podium/context; comparison designs are excluded. Rays originate 20 mm off each surface to reduce self-intersection. Midpoint time steps are 15, 30 or 60 minutes. A local Web Worker performs double-sided triangle occlusion with a bounding-volume hierarchy; cancellation terminates it. Geometry/settings changes clear stale results.

Results are geometric direct-sun hours, not weather-adjusted sunshine, irradiance, electricity or indoor daylight. All surfaces are opaque, with no clouds, diffuse sky, reflections, terrain or glazing transmission. Roof means all upward-facing eligible surfaces; façade means near-vertical surfaces, including internal opening faces. The point map is a sampled study, not a continuous façade solution. Refine the time step and compare runs; mesh approximations and surface sampling limit accuracy. Visual shadows use shadow maps and can differ from analysis rays. Nearby context is for solar analysis only and is not added to building GLB/IFC exports. Project JSON/browser saves include solar settings/context. Solar CSV contains coordinates, normals, exposure, inputs, context and project JSON; results are not persisted. No paid API or remote simulation server is called. Browser visual QA remains unavailable.

### Reading solar results
The default colour scale spans the actual sample minimum/maximum. Switch to 0–daylight hours to compare runs using the daylight reference. Min/max/mean/spread are displayed; uniform results stay one colour and are labelled explicitly. A narrow range can look high-contrast without representing a large absolute difference. Click/tap points in the 3D viewer to see hours and coordinates. Camera drags do not select points. Show building, opacity and neutral-grey analysis controls affect presentation only; they do not alter occlusion calculations or exported building geometry. GLB export builds a fresh model so hiding/fading the viewer does not hide/fade the exported building.


### Daily weather-based irradiation (research preview)
Solar → Analysis → Solar irradiation fetches Open-Meteo hourly GHI, DNI and DHI. This free endpoint is for personal/academic non-commercial use; no OpenWeather key is needed. Requests disclose latitude, longitude and dates, not building geometry. Attribution: Open-Meteo, CC BY 4.0; historical model ERA5 (ECMWF/Copernicus).

The selected local date is a fixed 24-hour period at the explicitly entered UTC offset (including applicable daylight saving); transition days are not automatic civil 23/25-hour days. API timestamps denote the preceding hourly mean. GMT intervals are clipped to the selected day, including fractional UTC offsets; incomplete, null or negative data aborts the run. Dates older than five days request ERA5 via the archive endpoint; newer dates use best-match forecast data. Availability depends on the provider. Eight datasets are cached in memory for repeated form studies; reload to refresh.

At each surface sample, direct irradiation integrates DNI × max(0, normal·sun direction) × visibility × duration / 1000. Hourly radiation is held constant over the selected geometric substeps. Sky diffuse uses isotropic radiance and 512 equal-solid-angle hemisphere rays, normalizing the cosine-weighted visible fraction to the unobstructed analytic sky factor (1+normal_up)/2. Total = direct + diffuse. GHI is shown as a weather reference, not added again. No ground reflection, interreflection, glazing transmission, anisotropic sky or PV conversion is included. Input is gridded modelled weather, not an on-site measurement. These assumptions limit use to early-design estimates pending independent field/engine validation.

Use fixed kWh/m² colour bounds and unchanged weather/date/location for form comparisons. Statistics are surface-sample means. CSV includes individual direct/diffuse/total values, sky factor, geometry settings, source URL, retrieval time, grid location and hourly input intervals for reproducibility. Results are not saved in project JSON.

References: https://open-meteo.com/en/docs ; https://open-meteo.com/en/docs/historical-weather-api ; https://open-meteo.com/en/pricing ; https://pvlib-python.readthedocs.io/en/stable/reference/generated/pvlib.irradiance.isotropic.html . Numerical checks cover unobstructed tilt factors, incidence, beam blockage, diffuse obstruction, unit conversion, time offsets and missing data. These checks do not establish field accuracy.

### Independent numerical benchmark (12 October 2026)
See `dist/validation.html` and `dist/radiation-validation.json`. Run `npm run validate:radiation` to regenerate the report from the checked-in independent fixture. `scripts/generate-radiation-reference.py` regenerates that fixture with pvlib 0.13.1 (NREL SPA geometric sun position and isotropic transposition), and imports no FORM functions. Weather is synthetic; this is not a field validation.

The 144 comparisons cover four cities, three seasonal dates, six surface orientations and 1/5-minute integration. All meet the project-specific regression gate max(0.02 kWh/m², 2% reference). Maximum absolute difference: 0.04806 kWh/m²; maximum relative difference: 1.7472%. A separate Python ray-box reference checks four obstructed-sky probes at 131,072 directions. Maximum 512-ray sky-factor difference is 1.00 percentage point in this set.

**Correction:** production radiation geometry now uses a maximum five-minute step, regardless of the sunlight-hours step control. CSV records the effective step. The earlier 30-minute Berlin equinox/east synthetic case differed by 10.93% from same-step pvlib near sunrise. Coarse geometric quadrature amplifies horizon/visibility differences; reducing the step improves stability without inventing subhourly weather data. On the benchmark scenarios the largest 5-versus-1-minute daily difference is 0.02150 kWh/m² (unobstructed), and 0.01175 kWh/m² (six box-shaded scenarios). These are observed differences, not universal error bounds. The hourly radiation values are still held constant and the diffuse sky remains isotropic.

Remaining: realistic building/field validation, anisotropic sky comparison, hourly weather-component consistency, spatial/time convergence for complex geometry, and browser interaction QA. Daylight, indoor comfort, annual yield and compliance are not validated by this benchmark.
