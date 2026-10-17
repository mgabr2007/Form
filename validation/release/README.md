# Release follow-up

Read [REPORT.md](REPORT.md) and [PROTOCOL.md](PROTOCOL.md). The earlier full factorial Radiance study remains in `validation/radiance/`; its observations are historical, not overwritten by this follow-up.

From the repository root, using Python 3.12 and Node:

```sh
python -m venv /tmp/form-radiance-env
/tmp/form-radiance-env/bin/pip install -r validation/radiance/requirements.txt
node validation/release/export_cases.mjs
/tmp/form-radiance-env/bin/python validation/release/refine_sky.py
/tmp/form-radiance-env/bin/python validation/release/compare_reference.py
npm test
npm run validate:radiation
```

The exporter uses the committed dimensional scene specification and synthetic weather fixture. The reference runner builds native Radiance geometry independently and verifies its rtrace binary hash against the frozen sky-reference run. Point-sun directions are shared to isolate transport; the separate pvlib suite verifies solar position. `regular-grid-attempt.json` preserves the initially failed 8192-ray regular-lattice attempt. `sky-refinement.json` records the follow-up reference refinement. Thresholds were not changed.

For browser checks, install Playwright and a compatible Chromium (or use a preinstalled runtime), then run:

```sh
node validation/release/browser-check.mjs
```

Optional environment variables: `FORM_PLAYWRIGHT_MODULE` for an absolute Playwright module path; `FORM_CHROMIUM_PATH` for a browser executable; `FORM_CHROMIUM_MODULE` for the @sparticuz/chromium module when its serverless launch arguments are needed. The recorded environment used Playwright 1.62.1 and @sparticuz/chromium 153.0.0 with system fontconfig. The script serves the local application itself and intercepts weather with the committed synthetic fixture; no external site or account is changed. Outputs include browser-results.json, downloaded exports and desktop/mobile screenshots. After all checks have run, `python validation/release/build_report.py` generates the report and hash manifest and refuses failed release gates. Screenshot inspection supplements assertions; a mobile viewport is not an actual iPhone test.

For sub-metre studies on a full tower, the 6,000-point safety limit may require selecting a smaller model or coarser spacing. Point means and centre-value heatmaps do not represent area-integrated façade energy; missing edge-cell centres remain uncoloured. Further design-specific refinement may still be necessary.
