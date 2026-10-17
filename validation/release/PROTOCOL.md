# Release verification protocol — 17 October 2026

Follow-up to the retained Radiance study. Criteria are set before this follow-up run; none of the earlier failure records are replaced.

- Increase production irradiation sky default to 8192 directions and cap geometry integration at one minute. Preserve explicitly saved sky choices. Add 15/30-second options and façade grids down to 0.25 m, with existing point/resource limits retained.
- Repeat the same five dimensional scenes and four synthetic days. Compare 8192-direction fixed-sensor sky factors against independently refined native Radiance (16384 divisions, 65536 for previously flagged sensors). Require absolute difference <=0.005, unchanged.
- Compare matched one-minute daily totals against native Radiance visibility and isotropic diffuse transport. Require <=max(0.02 kWh/m²,2% reference), unchanged.
- Compare 1 and 0.5 minutes with 0.25-minute native Radiance integration at fixed sensors. Require <=max(0.01 kWh/m²,1% finer result), unchanged diagnostic. Do not infer actual weather variability below hourly inputs or exact convergence below 15 seconds.
- Extend the same Cairo summer probe-plane study to 0.5 and 0.25 m, using one-minute irradiation and 8192 sky directions. Apply <=max(0.01 kWh/m²,1% finer mean) as a new prospective project-level spatial diagnostic. Retain the point-mean interpretation; these are not whole-building energy totals. Every new grid receives its own values, never interpolate the old coarse heatmap.
- Run the application in Chromium with a software WebGL2 renderer. Exercise all four modes, façade cell selection/colour controls, refinement, cancellation, saved comparisons and downloaded CSV replay. Use a deterministic, explicitly synthetic weather response to test the weather/UI contract. This does not validate the live weather provider or hardware/device coverage.
- Keep defaults, replay method version and history compatibility synchronized. Existing JavaScript regression suites and independent pvlib benchmarks must pass. Publish failing cases; do not increase limits after seeing outcomes.

Release may proceed as a conceptual, numerically verified tool if these gates pass and limitations remain explicit. Field accuracy, reflections, anisotropic production skies, PV output, annual yield and regulatory compliance are outside this release claim. Real measurements remain a separate empirical-validation gate.

## Follow-up amendment recorded before the new ray-pattern run

The first follow-up retained the regular latitude/azimuth sky lattice. Although all time and spatial criteria passed, 3/35 sky-factor cases missed the unchanged 0.005 limit at 8192 directions (results retained in regular-grid-attempt.json). Refine those native references to 65536 divisions and replace the irradiation ray lattice with a deterministic spherical Fibonacci distribution: equally spaced vertical coordinates and golden-angle azimuth progression. Preserve cosine normalization to the unobstructed analytic tilt factor and the same allowed ray counts. Repeat all comparisons and browser CSV replay; no threshold relaxation. This changes sampling, not sky radiance physics. It does not alter daylight/VSC sampling.

Sampling rationale: González, Á. (2010), *Measurement of Areas on a Sphere Using Fibonacci and Latitude–Longitude Lattices*, Mathematical Geosciences 42, 49–64. https://doi.org/10.1007/s11004-009-9257-x. This supports the distribution choice; its reported error reductions are not assumed to transfer to FORM. FORM acceptance is based on the independent case comparisons here.
