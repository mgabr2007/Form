# Reproduce import verification

Read PROTOCOL.md before running checks and REPORT.md for the recorded scope. Run from the repository root with Node and an available Playwright/Chromium installation:

```sh
npm test
npm run validate:radiation
node validation/imports/make-scenes.mjs
node validation/imports/decode-scenes.mjs
node validation/imports/compare-imported-scenes.mjs
node validation/imports/browser-check.mjs
FORM_BROWSER_OUTPUT="$PWD/validation/imports/native" node validation/release/browser-check.mjs
```

The first generator also produces the deterministic metre/millimetre IFC fixtures. `decode-scenes.mjs` exercises the actual browser GLB worker; comparison reuses the independently generated, archived Radiance references in `validation/release/results.json`, without running Radiance again. Full numerical comparison may take several minutes. It does not change acceptance thresholds.

Browser runners accept `FORM_PLAYWRIGHT_MODULE` (module path), `FORM_CHROMIUM_PATH` (executable) and `FORM_CHROMIUM_MODULE` (optional @sparticuz/chromium launch arguments). Weather requests are intercepted with the synthetic pvlib fixture. Desktop and 390×844 viewports use software WebGL; this is not physical-device validation. Native regression outputs are kept in `native/`, leaving prior release evidence unchanged.

The optional interoperability sample is not redistributed. To reproduce that check, obtain `examples/example.ifc` from ThatOpen/engine_web-ifc and save it as `validation/imports/external/thatopen-ifc2x3.ifc`. The recorded Git blob is `55a27807218b3d9076fd9be09dd51d4b7279df4a`; the required SHA-256 is `db372f3f57796e2f572958c1c144bf3d8be7912493738636a2152cf18f08a14d`. Public source: https://github.com/ThatOpen/engine_web-ifc/blob/main/examples/example.ifc . The runner verifies the SHA-256 and fails if upstream content changes. The file header identifies Autodesk Revit 2021 and IFC2X3; one such sample does not establish general Revit support.

`browser-results.json` contains counts, dimensions, hashes, timings, coverage diagnostics and replay results. `numerical-results.json` records all comparison cases. CSV exports and the small portable package are synthetic artifacts. `evidence-manifest.json` hashes the implementation and evidence for this change; historical release evidence has its own scope.
