# Imported geometry verification protocol

Scope: static GLB context, explicitly selected imported receivers, and IFC import. These are numerical/software gates; no measured field accuracy is claimed.

Prespecified gates for this implementation:

- Keep existing regression tests and independent pvlib benchmark gates unchanged.
- GLB known dimensions, nested transforms and mirrored orientation: coordinate error <= 1e-6 m on the supplied small synthetic fixtures.
- IFC synthetic metre/millimetre fixtures: bounding dimensions within 1e-5 m, preserved element GlobalId/class/storey and available scalar properties. Source-authoring-tool interoperability is a separate claim.
- Decode five existing Radiance benchmark scenes through the actual GLB browser worker. Reconstruct source placement; require maximum coordinate difference <= 1e-5 m. Do not loosen daily/sky gates because of import.
- Compare imported-scene daily irradiation against the archived independent native Radiance references in validation/release/results.json: abs(error) <= max(0.02 kWh/m², 2% reference). Sky-factor error <= 0.005. Reference values were generated before model-import implementation; this check reuses them, it does not claim a new Radiance run.
- Record direct/diffuse results and source identities. Replay every downloaded analysis CSV to the existing absolute 1e-9 criterion.
- Verify time-step, sky and façade-grid refinements for imported geometry, without interpreting agreement as a universal error bound.
- Browser acceptance: real worker decoding, malformed file rejection, target-role changes, review gate, heatmap selection, all four analysis modes, roof receiver mapping, context placement, undo/redo, reload, portable package restoration in a fresh context, IFC properties, cancellation, and responsive controls.
- Verify resource caps and failure handling; record performance on the actual environment. Fixed limits are conservative implementation budgets, not guarantees for arbitrary files or physical mobile devices.
- Physical-device Safari, arbitrary Revit/other authoring exports, external field data and public-site deployment must be listed separately if untested.
