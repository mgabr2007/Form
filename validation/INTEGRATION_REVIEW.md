# FORM PR #1 conflict resolution — 17 October 2026

> Historical results for the stated baseline. The current follow-up and release decision are in [the release report](release/REPORT.md).

**Disposition: integrated patch ready for review; keep PR #1 in draft pending rendered browser acceptance. No merge or production deployment is authorized by this report.**

This review integrates the exact main tip `6c4a5334fe408ab6f7165a57081b7dea8b2908dd` with audit tip `ebfec7f2311b4ec1613a18b9970a8f673ca1d360`. Their common ancestor is `68062a48e92dea49d3a4c9d120ba99825bb358b6`. The audit is one commit ahead and five behind. GitHub reported PR #1 open, draft, unmerged and not mergeable when inspected. There were no PR comments, status checks or check runs on its audit head.

Sources: [PR #1](https://github.com/mgabr2007/Form/pull/1), [inspected main commit](https://github.com/mgabr2007/Form/commit/6c4a5334fe408ab6f7165a57081b7dea8b2908dd), and the committed implementation, independent fixtures and test outputs described below. Quantities in this report are reproduced numerical experiments, not published accuracy claims.

## Resolution decisions

A real three-way merge produced seven textual conflicts: `README.md`, `dist/radiation.js`, `dist/solar-ui.js`, `dist/solar-worker.js`, `dist/solar.js`, `package.json`, and `tests/radiation.test.js`. `dist/solar-display.js` merged automatically. The resolution starts from main's UI and feature structure, then incorporates the audit kernel and roof corrections.

| Area | Integrated behavior | Evidence |
|---|---|---|
| Solar geometry and close blockers | Audit NOAA/Meeus UTC-normalized solar position and 0.1 mm ray offset. The newer daylight engine also uses the shared offset. | SPA direction comparisons, UTC rollover tests, centimetre blocker tests for irradiation and daylight. |
| Time integration | Preserve main's five-minute production cap; allow one minute. Retain explicit benchmark-only override for identical 15/30/60-minute reference intervals. Weather stays hourly. | Main cap test plus worker tests against independent five-minute shaded references for all coarse requests. |
| Sky API | Irradiation `skyFactor` uses direction counts 512/2048/8192, default 2048. Main's benchmark caller converts row counts explicitly. Daylight retains row counts 16/32/64. | Both fixture suites and per-mode worker tests. |
| Roof and façade geometry | Exclude enclosed floor plates using the audit's procedural cross-section clipping. Preserve main's configurable clipped façade grid, cells, point mapping, grid outlines and refinement. | Box/podium/setback/atrium/balcony tests; unchanged main grid/cell/refinement tests. |
| Colour scales | Fixed initial irradiation scale, distinct narrow-range ticks, four-decimal irradiation readouts, retained façade cell colouring and selection code. | Scale tests; rendered interaction remains a gate. |
| Exports | One versioned CSV supports sunlight, irradiation, VSC and horizontal sky view. Retains grid row/column/triangle, settings, mesh, weather, effective step, sky resolution, scale and refinement summary. Copy mesh before transferring its buffer to the worker. | Exact offline replay for all four modes with actual façade-grid samples and horizontal probes. |
| Saved comparisons | Preserve history and exports. New engine ID prevents comparisons across changed numerical methods; sky-ray count now participates in irradiation compatibility checks. | History roundtrip, cross-engine and sky-resolution rejection tests. Old histories are retained, not migrated or deleted. |
| Benchmark reporting | Keep both independent fixture datasets and generators. Run both suites through `validate:radiation`; regenerate the main UI JSON and audit result JSON. Distinguish raw matched-step characterization from production. | Both suites pass, frozen fixture bytes remain unchanged. |

Kernel/CSV method ID is now `FORM-irradiation-3`. Old exports require the matching old source; the new replay tool rejects them instead of quietly replaying a different method. The original audit report is preserved with a current-status note.

## Executed verification

Runtime: Node.js v24.19.0. Tests need no network or external dependencies.

| Check | Result |
|---|---|
| Original main baseline | 86/86 Node tests pass; 144/144 pvlib comparisons pass its existing tolerance. |
| Integrated suite | 111/111 Node tests pass: both original suites plus six integration tests. |
| Main independent pvlib suite | 144/144 cases pass. Maximum absolute daily-total discrepancy: **0.000388087 kWh/m²**; maximum relative discrepancy: **0.01105568%**. Before integration: 0.04805637 kWh/m² and 1.7472112%. |
| Audit independent pvlib suite | 60 surface cases pass. Maximum absolute daily-total discrepancy: **0.000565396 kWh/m²**; maximum solar-direction separation: **0.00803583°**. |
| Audit analytical obstruction checks | Maximum default 2048-ray sky-factor discrepancy: **0.00200240**. Maximum matched-step shaded discrepancy over 5/15/30/60-minute characterization: **0.00349562 kWh/m²**. |
| CSV replay | Zero absolute numerical discrepancy for sunlight, irradiation, VSC and sky-view integration fixtures. Grid identities and refinement metadata retained. |
| Syntax and whitespace | All 42 top-level JS/MJS implementation, script and test files pass `node --check`; `git diff --check` passes. |

The original numerical tolerances are retained; no fixture values or acceptance bounds were relaxed. The audit's coarse references deliberately call `radiationSteps(records, settings, 60)` so their solar directions and time bins remain matched. Separate tests exercise the normal capped production path. Main's original ray-box fixture retains its 20 mm reference offset; the integrated kernel uses 0.1 mm and still passes the existing 0.011 sky-factor tolerance. The audit's separate projected-area quadrature cases cover the corrected offset.

Temporal convergence remains separate from same-step numerical agreement: main's maximum five-versus-one-minute difference is 0.02159079 kWh/m² unshaded and 0.01174773 kWh/m² in its six box-shaded cases. Passing the benchmark does not prove a particular façade mesh or sampling density adequate.

Reproduce from the repository root:

```sh
npm test
npm run validate:radiation
node validation/replay_csv.mjs exported-analysis.csv
```

`dist/radiation-validation.json` and `validation/results.json` contain the detailed outputs. Python fixture regeneration was not run in this session; the existing independent frozen datasets were reused, and both generators are retained. Their methodology and published/official references are in `validation/IRRADIATION_AUDIT.md` and the generators.

## Remaining merge gates and limits

1. **Rendered desktop/mobile interaction acceptance remains open.** Chromium is not installed; the Playwright headless download returned unusable archive data. No rendered browser pass is claimed. Verify mode switching, fixed-scale selection on load, cells/points/outlines, cell picking, roof selection, cancellation, grid refinement, history save/quota errors and CSV download/replay. In particular, exercise a dense grid at 8192 rays: the worker remains cancellable, but this larger default workload and retained mesh can increase runtime and storage size.
2. **PR #1 itself is still unchanged and conflicted.** The isolated integration commit includes both histories. After review, its commit can fast-forward the audit branch without rewriting history. Re-fetch both tips first; rerun the comparison if main or the audit changes. Keep the draft state until acceptance is complete. Branch-protection requirements were not established; there were no existing checks on the original PR head.
3. **Live weather was not tested.** The numerical tests use frozen synthetic records. Provider availability, live API payloads and real weather accuracy are outside this session.
4. **Scientific scope is unchanged.** No field measurements or whole-scene Radiance/EnergyPlus comparison was performed. Isotropic sky, omitted reflections/transmission/PV conversion, procedural roof classification, façade overlap/slab edges, unsampled partial cells and unweighted sample means remain explicit limitations. These do not invalidate the numerical patch, but they prevent interpreting it as validated building performance or whole-building solar energy.

## Patch application

The review package supplies two alternative unified patches, both with full blob identifiers:

- `FORM-main-integration.patch`: apply only to main `6c4a5334fe408ab6f7165a57081b7dea8b2908dd`.
- `FORM-PR1-resolution.patch`: apply only to audit `ebfec7f2311b4ec1613a18b9970a8f673ca1d360`; includes main's five newer commits as file changes plus the reconciled code.

Use only the patch matching the checkout. Run `git apply --check PATH.patch`, then `git apply PATH.patch`, `npm test` and `npm run validate:radiation` on a new review branch. Applying a unified patch reproduces the integrated tree but does not itself retain merge ancestry; use the isolated two-parent integration commit when preserving both histories is required.
