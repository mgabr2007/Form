# Imported geometry verification — 17 October 2026

Status: the GitHub implementation passes the recorded software/numerical gates. It has not been deployed to the separate live Site. See [DEPLOYMENT.md](DEPLOYMENT.md) for the current source divergence and integration steps.

**Field accuracy and live-site deployment remain unverified.**

## Implementation scope

GLB/IFC preview and import; source-unit normalization; nested/mirrored transforms; shared origins and placement; reference/context/target roles; explicit exterior receiver review; façade heatmaps and refinement; four environmental modes; source identity in CSV; undo/redo; browser asset storage; and portable original-file packages. Existing parametric plans, metrics, exports and scientific equations retain their defined scope. The limitations page explains these distinctions.

## Recorded gates

| Gate | Result |
| --- | --- |
| Unit/regression tests | 126/126 passed; baseline was 115 |
| Existing main pvlib benchmark | 144/144 passed; max absolute difference 0.0003880872 kWh/m² |
| Existing audit regression suite | 8/8 passed (also included in the full unit suite); independent comparison command completed |
| Imported GLB benchmark geometry bounds | 5/5 within 1e-5 m |
| Imported daily irradiation vs archived native Radiance | 140/140; maximum absolute difference 0.0016988887 kWh/m² |
| Imported sky factor vs archived native Radiance | 35/35; maximum absolute difference 0.0010421899 |
| One-minute vs 15-second imported irradiation | 140/140 within max(0.01 kWh/m², 1% finer value) |
| 0.5 m vs 0.25 m imported façade-grid mean | 5/5 within max(0.01 kWh/m², 1% finer mean) |
| Import browser workflow | 25/25 passed; no page errors |
| Existing browser workflow | 20/20 passed; no page or console errors |
| Additional malformed GLB cases | 6/6 rejected |

The imported Radiance gate remains abs(error) <= max(0.02 kWh/m², 2% reference) for daily totals and <= 0.005 for sky factor. References are the independently produced values already archived in `validation/release/results.json`; this is **not a new Radiance run**. Frozen scenes cover box, overhang, setback, courtyard and neighbours. Sky sensitivity at 512/2048/8192 rays is recorded, without claiming a universal convergence bound. Full cases are in [numerical-results.json](numerical-results.json).

Browser runs used Chromium 153.0.8010.0 with software WebGL2, desktop and 390×844 mobile viewports. Weather was intercepted with synthetic fixture records, not obtained from a live provider. Downloaded imported façade irradiation/sunlight/VSC/sky and roof-sky CSVs all replay to the existing 1e-9 criterion. Native exports were checked separately in `native/`. Screenshots were visually inspected.

The worker decoded a 150,000-triangle, 5,400,368-byte synthetic GLB in 363 ms in the recorded environment. This measures one decoding run, not analysis/rendering speed, peak memory or physical-device performance. Over-size input, missing browser assets, missing packaged source, checksum mismatch and unexpected ZIP paths all produce explicit failures. Workers support cancellation. External GLB resources, unsupported compression, animation, cycles and excessive allocations are rejected.

## IFC evidence and limits

Deterministic IFC4 metre and millimetre fixtures retain dimensions within 1e-5 m, source GlobalId/class/storey and scalar property sets. One hash-pinned example whose header identifies Autodesk Revit 2021/IFC2X3 also parsed: 27,660 retained triangles across 119 mesh parts; source millimetres converted to metres. This establishes one-file interoperability only.

That sample has 116 represented products and 115 producing triangle geometry; the coverage diagnostic identifies #9989, an IFCSPACE, as having no imported triangles. Ninety zero-area triangles are removed. These diagnostics are disclosed; they do not certify complete tessellation, semantic correctness, openings or analytical suitability. Original files remain in packages and source hashes remain in results. IFC4X3 is parser-accepted but untested here. Other RVT/IFC authoring workflows, curves, complex relationships and arbitrary production files need separate review.

Receiver selection is per mesh/element part, followed by orientation filtering. It cannot infer exterior surfaces or repair mixed interior/exterior meshes. Material transparency is deliberately treated as opaque and must be acknowledged. Use an envelope export when necessary. Imported models do not contribute to parametric area metrics or parametric IFC/GLB/plan exports.

## Remaining release work

No field measurements were supplied. Physical Safari/iOS/Android devices, very large production buildings, long-session memory behavior, live weather service behavior and the public deployment remain outside these checks. The current Site source has additional hosted project, weather, comparison and structural features and requires a separate integration, described in [DEPLOYMENT.md](DEPLOYMENT.md). This change does not overwrite that Site or establish live accuracy.

See [README.md](README.md) for commands and the optional third-party fixture hash, [PROTOCOL.md](PROTOCOL.md) for acceptance gates, and [evidence-manifest.json](evidence-manifest.json) for source/evidence SHA-256 hashes. Historical reports retain their original scope.
