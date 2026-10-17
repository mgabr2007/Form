# Integrated release — 2026-10-17

Base: live Sites v47, commit 714c32f4147efbc0ce67940b8ef56b1e4d57ec1c.
Integrated import/audit source: GitHub main 2f7b57849e93121017d73eb28771bd1ef02ef113 (PR #2, tree 06a43402b2f660784e8f673ca872b084790c35da).

The live code is the base: its period weather, weighted comparisons, façade unfolds, project/revision APIs, R2 snapshots, parameter search, structural tools and concise landing page remain. Audit corrections and GLB/IFC imports are integrated into that code. `public/` is canonical; generated `dist/` must not be hand-maintained or published as a divergent static application.

## Verification on the combined source

- 203 Node tests passed, none skipped, including existing hosted feature suites and audit/import suites.
- Added cross-feature tests: v2 revisions preserve structure/period/identity; portable snapshots embed original source files once; imported receiver grids reconstruct exactly; TMY CSV replay preserves provider-timestamp quadrature; parametric search rejects imported targets.
- 144 independent archived pvlib comparison cases pass the existing engineering regression gates. This uses archived independent references, not a fresh installation of pvlib or Radiance.
- DOM assembly check with LinkeDOM: all import scope controls, the Models and Structure tabs, radiation sampling controls, period controls and exact disclaimer survive layout assembly; element IDs remain unique.
- Production build passed with the retained framework and R2 binding.

Historical Radiance/import browser reports in this directory concern their recorded earlier source versions. They are not new browser acceptance evidence for this integrated release. No browser-control skill was available in this session, so real WebGL interaction, deployed IFC/WASM loading, mobile rendering, authenticated cloud restore and paid weather calls were not exercised end to end. A successful deployment verifies publication, not these workflows.

## Decisions and limits

- Date-specific means: maximum one-minute geometry, selectable finer steps. TMY: retain provider irradiance timestamp and interval duration, not a fabricated subhourly weather profile.
- Model visibility does not remove context from calculations. Reference roles are excluded; exactly one analytical target and explicit imported receiver review are required.
- Saved imported façade views use recorded receiver triangles, and comparison compatibility includes model context, receiver selection, sampling, sky directions, weather and engine version.
- Existing project/cloud backups include original imported files, subject to the existing 8 MB snapshot cap. Larger models use FORM packages. Oversize or missing files produce explicit errors.
- Parameter search varies the parametric building with imported context. Imported targets cannot be varied with parametric modifiers. Structural analysis/exports remain scoped to the parametric building.
- Legacy stored results are retained, with cross-engine comparisons blocked. No claim of field, regulatory, structural or live-browser validation is made.

**Field accuracy and live-site deployment remain unverified.**
