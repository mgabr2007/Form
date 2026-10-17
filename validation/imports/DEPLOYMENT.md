# Deployment integration status — 17 October 2026

The import implementation targets GitHub `mgabr2007/Form` main at `2de4f60f5a8fe45c739c0d4f384b0b0a83f7a0cc`.

A read-only source inspection found that the existing public Site (`https://form-tower-studio.fabled-lily-4445.chatgpt.site`, version 46) now uses a different repository and framework/Worker architecture. Its fetched source head was `20d2886009ef150915fb1e6fe5f9ade1b422b4ab`. The current asset root is `public/`, entry is `studio.html`, and its hosting manifest has an R2 binding. It includes project storage, weather/station workflows, multi-period analysis, comparison dashboards, location/site tools, façade unfolding, structural tools and a landing page that are absent from GitHub main. The old local static Site checkout was stale.

No public deployment, remote Site source change or audience change was made for this import work. Replacing that application with GitHub's `dist/` would discard functionality and is not a safe deployment path.

Before live release:

1. Re-fetch the current Site source and preserve all existing features, storage routes and hosting configuration.
2. Port the asset/parser/scene/package modules to `public/`; integrate Models into the current studio layout and project lifecycle. Keep original-file packages distinct from the hosted project API unless that API explicitly stores the assets.
3. Integrate imported receivers/context with the current solar workflow, including multi-day periods, site context, history, search, façade unfolding and comparison. Preserve source hashes, transforms and sampling provenance in each pathway; prevent incompatible comparisons.
4. Port the audited numerical corrections and limitations link that remain absent from that source, preserving its new weather and period behavior. Reconcile API and data-model differences explicitly.
5. Run the Site's own tests and the import/numerical suites against the combined code. Exercise old project loading, hosted persistence, old and imported targets, structural tools, comparison and package restoration. Record browser/deployment verification limits separately.
6. Build and package with the existing manifest, publish a saved version, and verify the exact returned deployment/version. Retain a rollback version.

This is an integration dependency, not a merge conflict in the GitHub import branch. Field accuracy and live-site deployment remain unverified.
