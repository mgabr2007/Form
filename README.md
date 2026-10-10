# FORM — Parametric Tower Studio

A static, browser-based architectural massing tool. All geometry and project storage run on the visitor's device. No backend, API keys, paid computation, or package installation is needed to serve it.

## Run or host

Serve the `dist/` folder with a static web server. The entry point is `dist/index.html`. ES modules require HTTP(S), so opening the file directly with `file://` is not supported.

For Cloudflare Pages Direct Upload, upload the contents of `dist/`, or a ZIP whose root contains `index.html`, `app.js`, `geometry.js`, `style.css`, and `vendor/`. Use the free plan for static hosting. A Cloudflare account is required for that deployment. Hosting-specific deployment identity is excluded from this portable source repository.

## Features

- Rectangular, rounded, elliptical and hexagonal footprints; dimensions, orientation, tower storeys, floor height and independent podium.
- Up to 12 enabled/disabled twist, taper, lean, bend, bulge and setback modifiers with floor ranges.
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

The 2D Plans tab shows individual podium and tower floor outlines, their base elevations, area and optional axis-aligned overall dimensions. Optional dashed overlays show the immediately preceding floor. It is independent of WebGL. Export the selected floor as an annotated SVG or PNG, or a closed DXF outline in metres. These are conceptual floor outlines, not room layouts.

## BIM export and copyright

Export → IFC creates an IFC4 file containing the Project/Site/Building/Storey hierarchy, IfcSlab floor and roof elements, and an explicitly labelled conceptual envelope as IfcBuildingElementProxy with triangulated surface geometry. Uses metre units, Z-up, the same X/Y plan coordinates as DXF, and nominal slab thicknesses of 0.23 m (tower) and 0.30 m (podium). Parameters and modelled floor areas are exported as FORM properties. The envelope is an open surface, not a detailed wall assembly. This is a conceptual BIM exchange, not a native RVT file or a construction-ready model.

Copyright © 2026 Mostafa A. Gabr. All rights reserved for the FORM application. Third-party Three.js components retain their MIT licence.
