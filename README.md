# FORM — integrated tower studio

Live application: https://form-tower-studio.fabled-lily-4445.chatgpt.site

The canonical application source is `public/`, with the hosted API in `server/` and the Vinext/Cloudflare shell in `app/` and `build/`. `dist/` is generated build output, not a second editable application. GitHub and Sites use the same source files.

## Run and verify

Use Node 22.13 or newer. Run `npm ci`, `npm test`, `npm run validate:radiation`, and `npm run build`. Use `npm run dev` for local development. The production root opens the simple welcome page; the studio is `/studio.html`.

The hosted build preserves the R2 project-snapshot binding. Configure weather-provider keys as runtime secrets, never in client files. Open-Meteo is available subject to its usage terms; paid OpenWeather calls require owner sign-in and configuration. PVGIS TMY data retains its provider irradiance timestamps.

## Features

- Parametric massing, modifiers, floor plans, conceptual IFC/GLB, CSV, DXF and image exports.
- Models → Import GLB / IFC: local worker parsing, placement, reference/context/target roles, explicit exterior receiver review, and portable FORM packages.
- Sunlight, irradiation, façade VSC and sky exposure; configurable façade grids, heatmaps, refinement, unfolded views, saved comparisons and replayable CSV.
- Hour/day/date-range studies, weather provenance, site context, location/north controls and weather libraries.
- Project revisions, explicit cloud snapshots and parameter search. Snapshots embed original imported files up to the existing 8 MB total cap; larger designs use FORM packages. Cloud sync is not automatic.
- Experimental structural exploration on the FORM parametric building. Imported geometry does not become a structural frame. Structural runs remain a separate browser store.

## Scientific scope

Irradiation uses NOAA/Meeus solar positions, direct-ray visibility, isotropic sky diffuse radiation with selectable 512/2048/8192 directions, and a shared 0.1 mm ray offset. Date-specific hourly means use geometry steps of one minute or finer. TMY uses hourly quadrature at provider irradiance timestamps. GHI is a check, not an added irradiance component. Exterior parametric roof filtering excludes enclosed floor plates; imported receivers require user review.

No reflections, glazing transmission, PV electrical output, indoor daylight compliance or structural safety certification is implied. Display precision is not physical accuracy. Grid/temporal refinement is necessary for shadow-sensitive scenes.

**Field accuracy and live-site deployment remain unverified.**

The retained disclaimer concerns end-to-end operational and field validation; successful build and hosting publication alone do not establish those. See `/limitations.html`, `/validation.html`, and `validation/INTEGRATED_RELEASE.md` for scope and evidence. Historical reports retain their original revision-specific claims; rerunnable scripts now import `public/`.

## Import limits

Static uncompressed GLB triangles and material colours; IFC geometry supported by bundled web-ifc 0.0.75. No external resources, textures, animation or native RVT import. Limits: 25 MiB/source, 150,000 triangles/source, 12 instances, 300,000 analytical triangles. Inspect units, placement, missing products, normal directions and receiver selections. Rendering visibility is independent of analytical role. Parametric metrics, floor plans and generated IFC/GLB exports describe the FORM building only; FORM packages retain imported originals.

## Rights

Copyright © 2026 Mostafa A. Gabr. FORM rights are described in `COPYRIGHT`. Bundled third-party licences remain beside their assets in `public/vendor/` and `vendor/`.
