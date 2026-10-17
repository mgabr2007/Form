# FORM scientific verification report — 17 October 2026

> Historical results for the stated baseline. The current follow-up and release decision are in [the release report](../release/REPORT.md).

## Decision

The integrated engine passed matched-model daily comparisons, but the broader accuracy/convergence gates are not all satisfied. Keep PR #1 draft and unmerged pending review. This is numerical verification and sensitivity characterization, not measured validation. No production physics was changed by this validation branch.

## Reproducibility and independence

Baseline `39918542251086992b778c945447a26b282d439e`; RADIANCE 6.0a; pyradiance 1.3.0. Protocol SHA256: `ac3e8869dba515aed5c06967f2ce53f9a9e0f1f0153355e38f9104d4d2119891`. Native Radiance constructs geometry from dimensions independently of FORM triangles. Shared solar vectors and weather intentionally isolate transport; independent solar-position evidence remains in the existing pvlib benchmarks. Five scenes, 35 fixed sensors and four synthetic weather days were used.

The initially attempted output failed on a NumPy boolean serialization; it produced no final report. Before the successful run, the Perez and isotropic configurations were harmonized to use the same 0.001-degree sun source (`gendaylit -s` omits its own source). This isolates sky/reflection effects. Acceptance thresholds were unchanged. The original prospective protocol is retained verbatim. No realistic finite solar-disk penumbra validation is claimed.

## Matched numerical comparisons

| Check | Result |
|---|---|
| Daily totals, matched five-minute steps | 140/140 pass |
| Daily MAE / RMSE | 0.001132 / 0.002285 kWh/m² |
| Daily bias / maximum absolute error | 0.000264 / 0.008258 kWh/m² |
| Native direct-source checks | 140/140 pass |
| Default 2048-direction sky factor | 34/35 pass |
| Initial sky-reference convergence | 34/35 pass |
| Initial physics-reference convergence | 137/140 pass |
| Perez horizontal normalization / sun convention | 4/4 pass |


All 111 existing JavaScript tests passed. Both existing irradiation benchmark commands passed, including the eight audit validation tests. Six new field-data parser tests passed; their synthetic rows are explicitly not measurements.

| Scene | Daily cases | MAE (kWh/m²) | Maximum absolute error |
|---|---:|---:|---:|
| box | 28 | 0.000186 | 0.000498 |
| overhang | 28 | 0.000218 | 0.000883 |
| setback | 28 | 0.001477 | 0.006965 |
| courtyard | 28 | 0.001713 | 0.008258 |
| neighbours | 28 | 0.002064 | 0.007960 |

## Convergence and unresolved sampling limits

Targeted reference refinement to 65,536 ambient divisions (eight bounces for reflections) resolved all initially flagged reference-convergence cases under the unchanged criteria. Original results remain in results.json and follow-up results in refinement.json. This does not prove mathematical convergence for all cases.

The courtyard floor remains outside the default sky-factor criterion: error −0.005951 at 2048 directions versus the refined reference. At 8192 directions the error is +0.000885, which passes. Use the existing high-quality sky setting for such obstructed scenes; do not claim the default is uniformly converged.

| Time step compared with one minute | Cases within diagnostic limit | Maximum daily change (kWh/m²) |
|---|---:|---:|
| 5 minutes | 129/140 | 0.029468 |
| 15 minutes | 110/140 | 0.074951 |
| 30 minutes | 104/140 | 0.154787 |
| 60 minutes | 91/140 | 0.298031 |

Five-minute results pass matched-engine checks but fail the time-resolution diagnostic in 11/140 cases. One minute is a finer reference here, not a demonstrated exact solution; sub-minute/event-based verification remains necessary for stringent shadow-transition accuracy. Coarser steps were diagnostic overrides, not changes to the production five-minute cap.

Spatial sampling uses unweighted probe-plane means, not area-weighted building energy. Changing grids changes receiving points; paired errors are only computed within each grid. Reference grid diffuse calculations used 4096 divisions without a separate per-grid reference refinement, so small grid/reference differences should not be overinterpreted.

| Scene | FORM mean at 4 m | At 2 m | At 1 m | 2→1 m change |
|---|---:|---:|---:|---:|
| box | 1.006407 | 1.006407 | 1.006407 | +0.000000 |
| overhang | 0.545394 | 0.528708 | 0.525427 | -0.003281 |
| setback | 1.006407 | 1.006407 | 1.006407 | +0.000000 |
| courtyard | 0.621384 | 0.485654 | 0.531979 | +0.046326 |
| neighbours | 0.486453 | 0.490417 | 0.484970 | -0.005446 |

Units: kWh/m² for Cairo summer. The courtyard mean changes by about 9.5% from 2 m to 1 m; a 1 m grid cannot be called spatially converged from this study. Further refinement or area-aware integration is required before quantitative whole-façade claims. Near-ties and rankings are not an optimization validation.

## Omitted-physics sensitivity

The following are ranges of instantaneous differences across the 140 chosen cases. Values use refined outputs for the three originally unconverged snapshots. Reflectances (ground 0.2, wall 0.4) are hypothetical; the finite 200 m ground plane and opaque diffuse materials define the experiment. These are not annual biases or measured correction factors.

| Change from isotropic black-scene model | Minimum W/m² | Maximum W/m² |
|---|---:|---:|
| Perez sky only | -25.66 | 53.46 |
| Reflections only | 0.00 | 115.32 |
| Perez plus reflections | -15.48 | 144.50 |

These differences establish that sky anisotropy and interreflection can matter. Production FORM remains an isotropic, nonreflecting irradiation model; adding these effects requires a separate implementation, API/UI provenance update, and validation. Agreement under matched assumptions cannot justify accuracy under different physics.

## Remaining gates

1. Review whether the stated product scope accepts the observed sampling limitations; retain 1-minute/8192-ray options for demanding cases and verify further refinement before quantitative claims. Do not relax thresholds to turn this report green.
2. Resolve spatial convergence for obstructed façade means and investigate sub-minute shadow transitions if required by the intended use.
3. Independently review the integration, exterior-surface handling and export/history semantics; execute browser interaction/heatmap/export checks. A Chromium runtime was unavailable in this environment, so no browser visual pass is claimed.
4. Collect real calibrated observations and execute the held-out measurement protocol. The header-only CSV and analysis script are ready; no site measurements were supplied.
5. Recheck PR head/base and mergeability against current main, satisfy repository checks and obtain reviewer approval before changing draft status or merging.

## Evidence files

- PROTOCOL.md: prospective criteria and scientific references.
- scenes.json / make_scenes.py: dimensional specifications and fixed sensors.
- export_form.mjs / run_reference.py: reproducible production/reference calculations.
- results.json / daily.csv / spatial.csv: full initial results, including failures.
- refinement.json / normalization.json: targeted follow-up and radiometric checks.
- MEASUREMENT_PROTOCOL.md / measurements-template.csv / analyze_measurements.py: field campaign readiness.
