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
