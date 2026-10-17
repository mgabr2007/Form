# Prospective numerical verification protocol

Recorded before running the new scene comparisons, 17 October 2026.
Baseline: FORM commit 39918542251086992b778c945447a26b282d439e.

## Scope and criteria

Five independently described architectural scenes: box, overhang, setback, courtyard, neighbours. FORM triangulates boxes in JavaScript; Radiance constructs the same dimensional specification with native genbox/xform. Radiance coordinates are (east,north,up); FORM coordinates are (east,up,north). Fixed explicit roof/façade sensors provide paired comparisons. This checks idealized scene occlusion, not automatic BIM/FORM exterior classification.

Four synthetic weather days reuse frozen Berlin/Cairo summer/winter cases. FORM solar directions are shared deliberately to isolate transport; existing independent pvlib SPA checks remain the solar-position verification. Radiance direct visibility is evaluated with native rtrace first-intersection distances, followed by independently coded cosine projection/time integration in Python. Selected instantaneous direct irradiances are also checked with Radiance's radiometric source calculation. Isotropic diffuse irradiance is calculated by rtrace -I under a uniform upper-hemisphere radiance DHI/pi, with black opaque geometry and no lower sky emission. No photometric 179 lm/W conversion is used.

Project-specific, prospective regression criteria, NOT standards or field-accuracy specifications:
- Matched five-minute daily total: absolute error <= max(0.02 kWh/m², 2% reference) per sensor/day.
- Isotropic sky factor: absolute error <= 0.005 at 2048 FORM directions.
- Reference sky convergence, 4096 -> 16384 Radiance ambient divisions: absolute sky-factor change <= 0.0025.
- Instantaneous direct: absolute difference <= max(1 W/m², 1% reference).
- Time/sky daily convergence diagnostic: change <= max(0.01 kWh/m², 1% finer result); report failures without changing criteria.
- Spatial grid means: report unweighted 4/2/1 m-grid sensitivity on one defined south-facing receiving plane per scene; means are not paired point errors or whole-building energy. Ranking stability is illustrative across these different scenes, not an optimization validation.

Run time refinement at fixed sensors (1/5/15/30/60 min; coarse characterization explicitly overrides production cap). Run sky refinement at fixed sensors (512/2048/8192). Refine Radiance independently. Retain failures and local error distributions rather than only an overall average.

## Omitted-physics sensitivity

At fixed instantaneous sun/weather conditions, run a factorial comparison: isotropic vs Perez sky, each with black geometry vs proposed ground reflectance 0.2 / wall reflectance 0.4. These are hypothetical material parameters, not observations. Use gendaylit -ang ... -W DNI DHI -O 1 -g 0; finite explicitly modelled ground supplies reflection (do not double count a luminous lower hemisphere). Compare 3 vs 6 ambient bounces and 4096 vs 16384 divisions. Evaluate unshaded horizontal normalization and cardinal azimuth conventions. Record finite sun-disk vs point-sun boundary differences.

This phase characterizes limitations; it does not silently add physics to production FORM. Convergence is checked before interpreting sensitivity values.

## Exclusions

No empirical accuracy claim, measured weather, annual yield, PV conversion, glazing transmission, thermal response or regulatory compliance. No borrowed acceptance thresholds from whole-building energy calibration. No claim that agreement between two engines proves agreement with reality. Export exact scene specifications, sensors, radiance inputs, executable versions, hashes, settings, per-case results and metrics. Keep original PR draft until its separate review gates are satisfied.

References:
- Radiance rtrace manual: https://www.radiance-online.org/learning/documentation/manual-pages/pdfs/rtrace.pdf
- Radiance gendaylit manual: https://www.radiance-online.org/learning/documentation/manual-pages/pdfs/gendaylit.pdf
- Paul et al. (2022), Energy and Buildings 255, 111622. https://doi.org/10.1016/j.enbuild.2021.111622
- Elmalky & Araji (2023), Energy and Buildings 298, 113491. https://doi.org/10.1016/j.enbuild.2023.113491
