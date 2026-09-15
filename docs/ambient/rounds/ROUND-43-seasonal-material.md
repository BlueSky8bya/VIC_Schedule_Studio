# R43 — Seasonal play materials

2026-09-15 user rejects spring petals, summer leaves and winter snowflake sprites as artificial stickers beside the terrain. Supersedes R41 visual acceptance, preserving its readable size and interaction behavior.

Bake six deterministic material variants per season: muted botanical pigments, irregular silhouettes, folded shading and broken pigment clusters. Summer reuses autumn leaf species paths with restrained veins. Winter uses irregular ice-grain aggregates with white lit faces and blue-grey underside instead of outlined snowflake symbols. No bold uniform contour or decorative white petal stripe. Appearance RNG is separate from particle simulation.

Unchanged: size/hit radius, drag/release, population/performance budgets, whole-sprite perspective softness, motion gates, mobile exclusion, KST/season resolution and server/public boundaries. Only cached Canvas artwork changed; no downloaded/generated raster assets or per-frame material computation. Six 64px caches retained. No push requested.

Final production build (including lint/type checking), standalone lint/typecheck and 8 affected unit tests passed. Final three seasons day/night captures and grab/drag/release passed without browser errors. Winter underside contrast strengthened after the first capture showed pale clumps disappearing into snow. Harness and diff checks passed. B/C independent reviews found no size/cache/lifecycle/time/motion regression. Evidence: `.scratch-pw/qa/r43`, before `.scratch-pw/qa/r41`.

A final review: spring/summer integration improved; winter initial visibility finding resolved by darker underside in final noon/night captures. Near-view objects remain findable; middle/far objects deliberately soften. No remaining scoped blocker.
