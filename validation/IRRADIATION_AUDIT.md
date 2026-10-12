# FORM irradiation audit — 12 October 2026

**Assessment:** the corrected implementation is independently verified for the numerical cases below. It remains an **unvalidated predictor of real building irradiation**. Use it for transparent method development and explicitly qualified comparative studies; do not cite its outputs as measured solar resource, validated building performance or PV yield.

Baseline: `68062a48e92dea49d3a4c9d120ba99825bb358b6` (59 passing tests). Corrected kernel: `FORM-irradiation-2`. The audit branch contains the reference generator, frozen inputs, baseline and corrected outputs, regression tests and CSV replay tool. Reported numbers are **experiments performed in this audit**, not accuracy specifications from published literature.

## 1. What is being calculated

For an outward unit normal **n**, solar direction **s**, beam visibility **V**, and interval duration Δt in hours:

`H_direct = Σ DNI × max(0, n·s) × V × Δt / 1000`, with beam zero below the geometric horizon.

`H_diffuse = Σ DHI × F_sky × Δt / 1000`.

`F_sky = (1 + n_up)/2 × (Σ visible max(0,n·ω)) / (Σ all max(0,n·ω))` over equal-solid-angle upper-hemisphere directions.

Total is direct plus sky diffuse, in kWh/m². The unobstructed factor matches pvlib's isotropic transposition model [1, 3]. GHI is a weather reference, not an additional component. The angular sky visibility is cosine weighted; it is not an unweighted geometric fraction of visible sky.

Open-Meteo radiation values describe the preceding hour [4]. FORM correctly clips those intervals to the selected fixed-offset day and holds DNI/DHI constant within each interval. Finer geometric steps cannot reconstruct sub-hour cloud variation or the covariance between DNI and solar incidence. Consequently the reconstructed unshaded horizontal integral need not equal the separately supplied hourly GHI; it should not be silently rescaled to enforce equality. Timestamp convention and integration resolution matter [5].

## 2. Findings and corrections

| Finding | Reproduced evidence | Correction / status |
|---|---|---|
| Interior floor plates counted as roofs | A ten-storey closed box yielded only 45 exposed points out of 500 and mean sky factor 0.09; the unobstructed exterior roof factor is 1. | Clip horizontal roof candidates against the FORM mass cross-section **before** area sampling. Preserve exterior shaded balconies/terraces; do not filter by sky visibility. Box, podium, setback and atrium cases are tested. |
| A 20 mm offset could jump over nearby blockers | An opaque plane 10 mm above a roof sample incorrectly transmitted 0.8 direct + 0.1 diffuse kWh/m² in a one-hour synthetic case. | Use a shared 0.1 mm offset. The case now returns zero. Sub-mm features remain outside the verified geometric range. |
| Low-order solar position was insufficient at shadow edges | Across the frozen cases, maximum direction error was 0.4533° versus SPA. Original combined-method shaded daily error reached 0.2106 kWh/m². | Replace fractional-year harmonic equations with NOAA/Meeus Julian-century equations [2, 6]. Also compute declination/equation of time from one consistent UTC instant. |
| Local-clock notation changed the same physical sun instant | Previous fractional-year input depended on caller local hour/date while irradiation used UTC. | UTC normalization, with midnight/year/leap-day regression cases. The former test comparing different instants was corrected. |
| Diffuse resolution had no convergence control | Three finite-obstacle cases had sky-factor errors up to 0.00705 with the original offset/grid. | Default 2048 sky rays; retain 512 and expose 8192. Default maximum error in these cases is 0.002003. Refinement is not monotonically better at every discontinuous edge. |
| Relative colour ranges could exaggerate small differences | A range 1.001–1.004 kWh/m² produced full colour contrast with every tick rounded to 1.00. | Adaptive tick precision; irradiation starts with a common 0–10 kWh/m² scale. Four-decimal point/component readouts disclose small differences. Clipping above a chosen maximum is labelled. Displayed precision is not physical accuracy. |
| Reproduction depended on reconstructing an unspecified mesh/kernel | Old CSV saved project/weather/samples but omitted method version, sky resolution and the actual ray mesh. | CSV includes method ID, full settings, mesh, normals/points, weather intervals, offset, scale settings and components. An offline replay tool checks every numerical column. Keep the exact source revision with the export. |
| Shading was sensitive to temporal sampling | Maximum difference against a one-minute independent reference was 0.21034 kWh/m² at 60 minutes, and 0.09352 at 15 minutes, after geometry corrections. | Expose 1 and 5 minutes; new default is 15 minutes (previously stored settings remain unchanged). Record convergence rather than asserting that any fixed step guarantees accuracy. |

The roof correction is specific to FORM's procedural mass representation; it is not a general watertight-mesh or BIM exterior-surface classifier. Inclined eligible envelope faces remain eligible. Complex topology transitions and overlapping faces need further scene-level checks.

## 3. Independent reference design

`generate_reference.py` imports **no FORM implementation**. It runs pvlib 0.13.1, with package versions recorded in the fixture and pinned in `requirements.txt`. SPA uses geometric zenith, zero pressure, sea-level altitude and ΔT=67 s. Transposition uses `get_total_irradiance(..., model='isotropic', albedo=0)` so both implementations have the same stated physics. This is a numerical reference comparison, not validation of isotropic sky assumptions [1–3].

The weather is explicitly **synthetic**: UTC-hour DNI is 650 W/m² when the SPA hourly midpoint is above the horizon, otherwise zero; DHI is 80 + 40 sin(altitude) W/m² in those daylight hours, otherwise zero. GHI is calculated at that midpoint. These simple profiles isolate geometry and integration; no values are presented as observations or actual Open-Meteo weather.

Cases: Berlin and Cairo at the March equinox and June/December solstices; Sydney summer; Kathmandu leap day with UTC+5:45; Tromsø polar summer and winter. Each has horizontal roof, north/east/south/west vertical façades and a south-facing 30° plane: **60 daily surface cases**. Sydney and polar cases exercise hemisphere and horizon behavior. All daily comparisons use 15-minute midpoints on clipped UTC weather bins.

Two distinct checks avoid conflating geometry and transposition:

1. Feed frozen SPA directions into FORM's irradiation kernel. Direct, diffuse and total agree with independently calculated pvlib values to the regression tolerance of 1e-11 kWh/m².
2. Use FORM's own sun directions. Compare angular separation and daily energy; the table below reports the resulting discrepancy.

For obstruction, finite horizontal rectangles are located above a differential receiving point:

| Case | Receiver normal | Blocker dimensions and position |
|---|---|---|
| Roof square | Up | 4 × 4 m, centered, 2 m above |
| Roof wide | Up | 16 × 8 m, centered, 3 m above |
| Façade overhang | North | 6 m wide, projects 2 m out from the wall, 1 m above |

Independent beam visibility intersects the analytical rectangle plane and checks x/z limits; it does not use FORM's triangle intersections/BVH. Diffuse obstruction is an independent SciPy integration of `cos(theta_receiver) cos(theta_blocker)/(π r²)` over the rectangle area, subtracted from the unobstructed sky factor. Reported quadrature errors are stored in the fixture. This is a derived projected-area view-factor reference under the same isotropic/no-reflection assumptions [3]. Nine location-date/obstruction combinations are evaluated at 1, 5, 15, 30 and 60 minutes.

## 4. Measured numerical results

| Metric over stated cases | Original commit | Corrected |
|---|---:|---:|
| Maximum solar direction separation from SPA | 0.453286° | 0.008036° |
| Maximum absolute unshaded daily discrepancy | 0.048695 kWh/m² | 0.000565 kWh/m² |
| Unshaded daily RMSE across 60 cases | 0.011726 kWh/m² | 0.000176 kWh/m² |
| Maximum shaded daily discrepancy at matched steps of 5/15/30/60 minutes | 0.210589 kWh/m² | 0.003496 kWh/m² |

RMSE here is a numerical comparison statistic across synthetic cases, **not field RMSE or a confidence interval**. The corrected routine remains a NOAA/Meeus approximation rather than a port of SPA: no atmospheric refraction or topocentric parallax is included. Bounds apply only to the tested dates/locations.

Example daily totals demonstrate that the orientations are differentiated:

| Synthetic case / surface | pvlib (kWh/m²) | FORM (kWh/m²) |
|---|---:|---:|
| Cairo summer / roof | 7.089230 | 7.089434 |
| Cairo summer / north | 1.935813 | 1.935814 |
| Cairo summer / east | 3.570793 | 3.570800 |
| Cairo summer / south | 1.006561 | 1.006541 |
| Cairo summer / west | 3.631184 | 3.631055 |
| Berlin winter / roof | 1.453525 | 1.453696 |
| Berlin winter / south | 4.529909 | 4.529886 |

Equal outputs can still be physically consistent within this model: coplanar unshaded roof points share normals/weather, and all unobstructed vertical façades have the same isotropic diffuse factor 0.5. Direct irradiation distinguishes orientation; similarly coloured points alone do not prove equal total irradiation. Earlier direct-sun-hours results were a different quantity.

Temporal convergence is a separate source of discrepancy. Over the nine shaded cases, maximum total differences from the one-minute SPA/analytical-visibility reference were:

| FORM step | Maximum difference (kWh/m²) |
|---|---:|
| 60 minutes | 0.210342 |
| 30 minutes | 0.054087 |
| 15 minutes | 0.093515 |
| 5 minutes | 0.018395 |

The non-monotonic 15/30-minute values illustrate shadow-boundary aliasing. A one-minute calculation is itself a numerical reference, not exact continuous integration. For a research case, refine time, sky and spatial sampling until changes are small relative to the effect being claimed; use absolute tolerances near zero and report the chosen tolerances as study decisions.

## 5. Verified, assumed and unresolved

**Verified for the fixtures:** units and summation; unobstructed tilt/orientation transposition; solar geometry against SPA at 960 quarter-hour instants; selected rectangle beam/diffuse obstruction; local-day/UTC offsets; direct/diffuse separation; basic procedural exterior roof extraction; worker execution; colour mapping logic; reproducible CSV round trip. Regression budgets are 0.02° angular, 0.002 kWh/m² unshaded absolute (and 0.5% when reference exceeds 0.5 kWh/m²), 0.005 default sky-factor absolute, and 0.01 kWh/m² matched-step shaded total. These are explicitly project regression criteria, not ISO/ASHRAE acceptance limits.

**Assumptions retained:** isotropic sky; opaque surfaces; no ground reflection or interreflection; homogeneous weather across the scene; hourly inputs held constant; no terrain horizon; fixed UTC offset; geometric point sun; incident irradiation only (no glazing transmission, PV conversion or indoor comfort calculation). Open-Meteo data are gridded model outputs; historical ERA5 and recent best-match forecasts are distinct products. Re-fetching a forecast can change its values [4].

**Not established:** actual weather accuracy at the building; complex urban-canyon/reflection effects; arbitrary architectural geometry; independently validated spatial sampling adequacy; façade mesh overlap/duplicate-area behavior; field or independent whole-scene engine agreement; annual yield or extrapolation from one day. There are still 500 deterministic surface points, with no user-facing spatial-resolution control. Façade candidates include eligible envelope/slab edges and opening faces, rather than a rigorously deduplicated exterior energy-balance mesh. The sample mean must not be multiplied by gross façade/roof area and reported as a validated whole-building solar-energy total.

Browser interaction/visual QA was unavailable in this environment. The worker, colour-scale functions, data export, model sampling and JS syntax were checked; rendered layout, point picking and long-run responsiveness have not been independently inspected. No live Open-Meteo retrieval or field dataset was used in this validation exercise.

## 6. Reproduction and remaining validation work

From the repository root:

```sh
npm test
npm run validate:radiation
python -m venv /tmp/form-reference
/tmp/form-reference/bin/pip install -r validation/requirements.txt
/tmp/form-reference/bin/python validation/generate_reference.py
node validation/compare.mjs > validation/results.json
node validation/replay_csv.mjs your-export.csv
```

Node tests and comparison need no network, Python or pvlib installation; they consume the frozen independently generated fixture. Regeneration uses Python 3.12 with the pinned numerical packages. CSV replay uses raw saved inputs and the current versioned kernel, without re-fetching weather or rebuilding geometry. JSON files contain full per-case values. To reproduce original discrepancies, use the same fixture/comparison script with `dist/solar.js` and `dist/radiation.js` from the baseline commit; the original kernel always uses 512 sky rays.

Before treating a particular architectural study as quantitatively reliable:

1. Verify its mesh orientation/exterior sampling, units, location, clock convention and weather provenance; preserve the mesh and inputs.
2. Compare time, sky and spatial refinements at identical points. Record numerical changes and whether proposed design rankings persist. More rays alone do not prove convergence.
3. Compare selected roof/façade/canyon scenes to an independently constructed Radiance shortwave model under a matched uniform sky and zero-reflectance materials; then isolate the additional effect of realistic sky/reflections. Radiance is a separate ray-tracing transport implementation [7], not something run in this audit.
4. For absolute prediction claims, acquire time-aligned calibrated plane-of-array measurements, document sensor uncertainty and weather representativeness, and report bias/RMSE by orientation and shading condition on independent periods. No such measurements have been supplied or inferred here.

## References

1. Anderson, K. S., Hansen, C. W., Holmgren, W. F., Jensen, A. R., Mikofski, M. A., & Driesse, A. (2023). *pvlib python: 2023 project update*. Journal of Open Source Software, 8(92), 5994. https://doi.org/10.21105/joss.05994
2. Reda, I., & Andreas, A. (2004). *Solar position algorithm for solar radiation applications*. Solar Energy, 76(5), 577–589. https://doi.org/10.1016/j.solener.2003.12.003 . Reference implementation used here: https://pvlib-python.readthedocs.io/en/v0.13.1/reference/generated/pvlib.solarposition.spa_python.html
3. pvlib 0.13.1 official implementation documentation: https://pvlib-python.readthedocs.io/en/v0.13.1/reference/generated/pvlib.irradiance.isotropic.html ; https://pvlib-python.readthedocs.io/en/v0.13.1/reference/generated/pvlib.irradiance.get_total_irradiance.html
4. Open-Meteo, Historical Weather API, hourly parameter definitions and data models: https://open-meteo.com/en/docs/historical-weather-api ; forecast API: https://open-meteo.com/en/docs
5. pvlib, *Modeling with interval averages*: https://pvlib-python.readthedocs.io/en/stable/gallery/irradiance-transposition/plot_interval_transposition_error.html
6. NOAA Global Monitoring Laboratory, *Solar Calculation Details*: https://gml.noaa.gov/grad/solcalc/calcdetails.html ; equation implementation inspected: https://gml.noaa.gov/grad/solcalc/main.js . NOAA identifies Meeus's *Astronomical Algorithms* as the basis. Its legacy calculator is no longer maintained; the SPA comparisons here are therefore essential rather than an appeal to a blanket NOAA accuracy claim.
7. Ward, G. J. (1994). *The RADIANCE lighting simulation and rendering system*. SIGGRAPH proceedings, 459–472. https://doi.org/10.1145/192161.192286 ; author-hosted paper: https://radsite.lbl.gov/radiance/papers/sg94.1/paper.html
