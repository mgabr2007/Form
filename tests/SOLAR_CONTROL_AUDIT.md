# Solar control audit — 2026-10-13

Scope: source-level review of all Solar controls and their event handlers, dependency invalidation, enable/disable rules, exports and asynchronous cancellation. No browser interaction or visual verification was available.

| Controls | Review |
| --- | --- |
| Study selector; target selector | Eligible surfaces enforced on changes and saved-state loading. |
| Latitude, longitude, UTC, north, date | Limits/required inputs, change handlers, calculation dependencies reviewed; edits invalidate active output. |
| Map click, draggable marker, zoom, centre, use centre, browser location | Handlers reviewed; late geolocation callbacks guarded. Browser gestures, tile loading and permission prompts unverified. |
| Station retry; show site + station | Lookup cancellation, coordinate changes, marker availability reviewed. |
| Preview toggle and clock | Do not invalidate calculations; preview suppressed for sky studies. |
| Context add/remove and x/y/width/depth/height | Five-block limit; decimal input and range validation; edits clear obsolete results. |
| Façade width/height; ground extent; time step; sky resolution | Study/target visibility, bounds and calculation dependencies reviewed. |
| Weather source; current access check; load TMY | Provider routing and coordinate validation reviewed. Paid OpenWeather access not exercised. |
| TMY JSON/CSV | Matching-location guard, disabled states and metadata reviewed. |
| Calculate/cancel | Preflight, invalid fields, worker termination, late response guard and recovery reviewed. |
| Colour scale and fixed maximum | Recolour only; valid numeric range; maximum shown only for fixed radiation scale. |
| Cells, points, outlines, building, neutral view, opacity | Display handlers reviewed; do not modify physical occluders. |
| Point/cell selection | Pointer movement threshold, hit mapping and value/colour readout reviewed; picking unverified in browser. |
| Finer grid | Minimum spacing, retained weather, comparison report and sample cap reviewed. |
| Analysis CSV | Enabled only for active result; settings, units and provenance reviewed. |
| Saved results | Name/save, baseline, delete, close, comparison CSV and full JSON reviewed; storage error handling present. |
| Expanders and reference links | Source markup and destinations reviewed; external navigation not clicked. |

Verification: 99 existing tests passed after initial fixes; new saved-settings compatibility regression passed separately. These tests do not establish scientific prediction accuracy or replace browser interaction checks.
