# Reproducible Radiance verification

Read [REPORT.md](REPORT.md) for results and unresolved gates, and [PROTOCOL.md](PROTOCOL.md) for the prospective criteria. Field validation is **not completed**.

From repository root (Python 3.12 and Node required):

```sh
python3 -m venv /tmp/form-radiance-env
/tmp/form-radiance-env/bin/pip install -r validation/radiance/requirements.txt
python3 validation/radiance/make_scenes.py
node validation/radiance/export_form.mjs
/tmp/form-radiance-env/bin/python validation/radiance/run_reference.py
/tmp/form-radiance-env/bin/python validation/radiance/check_normalization.py
/tmp/form-radiance-env/bin/python validation/radiance/refine_reference.py
python3 validation/radiance/build_report.py
python3 -m unittest discover -s validation/radiance -p 'test_*.py'
npm test
npm run validate:radiation
```

Pyradiance includes native Radiance executables. The runner records executable hashes, versions, protocol hash, all commands and stderr. Generated `.rad` geometry/sky inputs and `.oct` octrees are recreated in `generated/`; `form-inputs.json` preserves the production-exported positions, weather and directions for each run. These generated inputs are intentionally regenerated rather than maintained as a second source of truth. Commands refer to the local generated paths. All comparisons use radiometric units.

The report's existing-test statements describe the recorded 17 October run; report generation does not itself execute npm tests. Threshold misses are retained as data: the benchmark script completing successfully does **not** mean all scientific criteria passed. See the summary and explicit false flags. The measurement script refuses an empty template and never creates synthetic observations. Its unit tests use synthetic data solely to verify parser/error calculations.

The production baseline is fixed to commit 39918542251086992b778c945447a26b282d439e. This branch adds validation artifacts; it does not alter the production irradiation engine. If production changes, update the declared baseline and regenerate all evidence.
