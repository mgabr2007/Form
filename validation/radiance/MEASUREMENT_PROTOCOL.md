# Field validation: prepared, not executed

No measured observations were supplied. These files do not claim empirical validation.

## Before collecting data

1. Select a site with surveyed geometry, true north, coordinates, timezone, obstructions and façade materials. Record geometry and weather-source revisions. Include unobstructed and shaded vertical planes, multiple orientations and a horizontal reference. Choose sensor positions before inspecting model error.
2. Use calibrated plane-of-array pyranometers appropriate for the expected irradiance and mounting geometry. Record instrument model, serial number, calibration date/coefficient, spectral response, cosine response, uncertainty, logger settings and cleaning/shading incidents. ISO 9060 classifies solar-radiation instruments; it does not set a FORM model accuracy threshold.
3. Measure DNI/DHI/GHI locally where feasible. Check weather-input consistency and use the same inputs in both engines. Keep a separate experiment using forecast/reanalysis weather to distinguish weather error from transport error. Do not infer transport accuracy from a comparison with mismatched weather.
4. Log synchronized UTC interval starts, interval durations and interval-mean irradiance (W/m²). Document whether source timestamps are interval start, midpoint or end. Survey sensor azimuth/tilt and position; log unexpected shading. Never compare instantaneous predictions with interval-averaged measurements.
5. Collect clear, overcast and mixed-cloud periods, including shadow transitions and different solar heights. A multiweek campaign is a starting point, not proof of annual/seasonal accuracy. Reserve days as a held-out validation set before tuning. Keep calibration days separate.
6. Define the intended use and allowable errors before viewing results. Set acceptance limits using instrument/input uncertainty and decision needs. The synthetic regression limits in PROTOCOL.md are not field-accuracy limits. A reviewer must approve field limits and campaign coverage before an empirical pass/fail claim.

## Data and analysis

`measurements-template.csv` is intentionally header-only. One row represents one nonoverlapping sensor interval. Populate `measured_w_m2` from observations and `predicted_w_m2` from the frozen FORM version, averaged over exactly that interval. `quality` must be `valid` or an explicit exclusion reason; do not silently remove poor-fitting valid points. Add site/instrument metadata in a separate campaign manifest, linked by sensor_id. Preserve raw observations unchanged.

Run `python validation/radiance/analyze_measurements.py observations.csv --output field-metrics.json`.

The script checks UTC timestamps, finite nonnegative irradiance, unique/nonoverlapping intervals and positive durations. It reports duration-weighted bias, MAE and RMSE by sensor, number/duration of excluded intervals, and daily irradiation only for complete UTC days (including night). Missing periods do not become zeros. A complete day is continuous 00:00–24:00 UTC. Do not feed it records crossing UTC midnight: split them with a documented interval-mean assumption or recompute means from raw samples. No MAPE near zero and no invented accuracy label.

Inspect residuals by orientation, solar height, sky condition and shadow state; compare errors with uncertainty. Use day-block resampling if estimating confidence intervals, since adjacent samples are not independent. Include uncertainty in geometry, orientation, weather and instrumentation. Publish exclusions and held-out results, including failures.

## Remaining human/physical work

Install/calibrate instruments; collect observations; review data quality; set and approve field acceptance limits; run held-out comparisons; obtain independent scientific review. This cannot be completed by a software benchmark.

References:
- ISO 9060:2018: https://www.iso.org/standard/67464.html
- IEC 61724-1:2021 (PV monitoring context, not a universal façade model acceptance test): https://webstore.iec.ch/en/publication/65561
